terraform {
  required_version = ">= 1.5.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }

    awscc = {
      source  = "hashicorp/awscc"
      version = "~> 1.0"
    }

    tls = {
      source  = "hashicorp/tls"
      version = "~> 4.0"
    }

    null = {
      source  = "hashicorp/null"
      version = "~> 3.0"
    }
  }

  # backend-config/prod.hcl 을 통해 실제 설정 주입 (dev와 같은 S3 버킷, 다른 key prefix)
  backend "s3" {}
}

# =========================
# Providers
# =========================

provider "aws" {
  region = var.aws_region
}

provider "aws" {
  alias  = "secondary"
  region = var.secondary_region
}

provider "awscc" {
  region = var.aws_region
}

# =========================
# Region Variables
# =========================

variable "aws_region" {
  type    = string
  default = "us-east-1"
}

variable "secondary_region" {
  type    = string
  default = "us-east-2"
}

variable "alarm_email" {
  description = "Email address for CloudWatch SNS alarm notifications"
  type        = string
}

variable "db_root_password" {
  description = "Root password to configure for the MariaDB instance on first boot"
  type        = string
  sensitive   = true
}

variable "seed_admin_email" {
  description = "관리자 계정으로 시딩할 이메일"
  type        = string
}

variable "seed_admin_password" {
  description = "관리자 계정으로 시딩할 비밀번호"
  type        = string
  sensitive   = true
}

variable "seed_admin_name" {
  description = "관리자 계정 이름"
  type        = string
  default     = "관리자"
}

variable "team_member_arns" {
  description = "EKS 클러스터 접근을 허용할 팀원 IAM User ARN 목록"
  type        = list(string)
}

# main.tf 자체는 dev/prod가 동일한 코드를 유지하도록 값을 여기서 선언만 하고
# terraform.tfvars(환경별 로컬 파일, git 미추적)에서 주입받는다 — dev/main.tf와 동일한
# 패턴. 실제 도메인이 붙으려면 kro.kr DNS에 CNAME이 별도로 등록되어 있어야 한다
# (Terraform 밖, 리포에 aws_route53_record가 없어 수동 관리).
variable "domain_name" {
  description = "CloudFront에 alias로 연결할 프론트엔드 도메인 (환경별 terraform.tfvars에서 주입)"
  type        = string
}

variable "certificate_domain" {
  description = "ACM에서 조회할 인증서 도메인 (환경별 terraform.tfvars에서 주입)"
  type        = string
}

# =========================
# Network Module
# =========================
# 주의: network/security/iam 세 모듈은 environment 변수가 없고 project_name만으로
# 리소스 이름을 짓는다(dev에도 environment 파라미터가 없었음 — 모듈 자체의 기존 한계).
# IAM Role 이름은 계정 전체에서 유일해야 하므로, dev와 같은 project_name("team04-hotel")을
# 쓰면 prod apply가 dev와 이름이 겹쳐 EntityAlreadyExists로 실패한다.
# 그래서 이 세 모듈만 project_name 자체를 "team04-hotel-prod"로 분리한다
# (모듈 코드는 건드리지 않아 dev 쪽엔 영향 없음). 나머지 모듈은 environment 변수로
# 이미 이름이 분리되므로 project_name은 dev와 동일하게 두고 environment만 "prod".

module "network" {
  source = "../../modules/network"

  project_name = "team04-hotel-prod"
}

# =========================
# Security Module
# =========================

module "security" {
  source = "../../modules/security"

  project_name = "team04-hotel-prod"
  vpc_id       = module.network.vpc_id

  eks_cluster_security_group_id = module.eks.cluster_security_group_id
}

# =========================
# DB Seed Artifacts Bucket
# =========================

resource "aws_s3_bucket" "db_seed_artifacts" {
  bucket        = "team04-prod-db-seed-artifacts"
  force_destroy = true

  tags = {
    Name        = "team04-prod-db-seed-artifacts"
    Environment = "prod"
  }
}

resource "aws_s3_bucket_public_access_block" "db_seed_artifacts" {
  bucket                  = aws_s3_bucket.db_seed_artifacts.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

locals {
  backend_dir = "${path.module}/../../../../backend"

  seed_source_files = concat(
    [
      "${local.backend_dir}/scripts/seed.ts",
      "${local.backend_dir}/package.json",
      "${local.backend_dir}/package-lock.json",
    ],
    [for f in fileset("${local.backend_dir}/apps/hotel-service/src/entities", "*.ts") : "${local.backend_dir}/apps/hotel-service/src/entities/${f}"],
    [for f in fileset("${local.backend_dir}/apps/user-service/src/admin/entities", "*.ts") : "${local.backend_dir}/apps/user-service/src/admin/entities/${f}"],
    [for f in fileset("${local.backend_dir}/apps/auth-service/src/entities", "*.ts") : "${local.backend_dir}/apps/auth-service/src/entities/${f}"],
  )

  seed_bundle_hash = sha1(join("", [for f in local.seed_source_files : filesha1(f)]))
}

resource "null_resource" "seed_bundle" {
  triggers = {
    source_hash = local.seed_bundle_hash
  }

  provisioner "local-exec" {
    interpreter = ["bash", "-c"]
    command     = "bash '${local.backend_dir}/scripts/build-seed-bundle.sh' '${aws_s3_bucket.db_seed_artifacts.bucket}'"
  }

  depends_on = [aws_s3_bucket_public_access_block.db_seed_artifacts]
}

# =========================
# Database Module
# =========================
# dev와 동일한 사이징/가용성 구성을 그대로 유지 (Multi-AZ/백업 정책 강화는 이번 범위 제외 — 별도 과제)

module "database" {
  source = "../../modules/database"

  environment             = "prod"
  vpc_id                  = module.network.vpc_id
  private_data_subnet_ids = module.network.private_data_subnet_ids
  db_security_group_id    = module.security.db_security_group_id

  iam_instance_profile_name = module.iam.cloudwatch_agent_instance_profile_name

  instance_type   = "t3.micro"
  ebs_volume_size = 20
  ebs_volume_type = "gp3"

  data_volume_size = 20
  data_volume_type = "gp3"

  db_root_password = var.db_root_password

  seed_admin_email    = var.seed_admin_email
  seed_admin_password = var.seed_admin_password
  seed_admin_name     = var.seed_admin_name
  seed_bundle_s3_uri  = "s3://${aws_s3_bucket.db_seed_artifacts.bucket}/seed/seed-bundle.tar.gz"
  seed_bundle_hash    = local.seed_bundle_hash

  depends_on = [null_resource.seed_bundle]
}

# =========================
# Redis Module
# =========================
# dev와 동일한 사이징 그대로 유지 (replication group 전환은 이번 범위 제외)

module "redis" {
  source = "../../modules/redis"

  environment             = "prod"
  vpc_id                  = module.network.vpc_id
  private_data_subnet_ids = module.network.private_data_subnet_ids
  redis_security_group_id = module.security.redis_security_group_id

  node_type = "cache.t3.micro"
}

# =========================
# Frontend S3 / CloudFront
# =========================

module "s3_frontend" {
  source = "../../modules/s3_frontend"

  project_name = "team04"
  environment  = "prod"

  # 실제 도메인 값은 var.domain_name/var.certificate_domain으로 terraform.tfvars에서
  # 주입된다(위 변수 선언부 주석 참고) — prod는 기존 서비스 도메인을 그대로 계승한다.
  domain_name        = var.domain_name
  certificate_domain = var.certificate_domain

  log_bucket_domain_name = module.logging.log_bucket_domain_name
}

# =========================
# Logging Module (CloudFront + ALB 액세스 로그)
# =========================

module "logging" {
  source = "../../modules/logging"

  project_name = "team04"
  environment  = "prod"
}

# =========================
# AI Chatbot Data
# =========================

module "ai_data" {
  source = "../../modules/ai_data"

  project_name = "team04"
  environment  = "prod"
}

# =========================
# Chatbot DynamoDB Tables
# =========================

module "dynamodb" {
  source = "../../modules/dynamodb"

  project_name = "team04-hotel"
  environment  = "prod"
}

# =========================
# CloudWatch Monitoring
# =========================

module "cloudwatch" {
  source = "../../modules/cloudwatch"

  environment  = "prod"
  alarm_email  = var.alarm_email
  cluster_name = module.eks.cluster_name
}

# =========================
# IAM Module
# =========================

module "iam" {
  source = "../../modules/iam"

  project_name  = "team04-hotel-prod"
  github_org    = "Team-likelion-2nd-Project"
  github_repo   = "likelion-devops-7th-team04"
  github_branch = "infra"

  # TODO(Step 7 - CI/CD): prod 배포를 트리거할 브랜치/태그 전략이 아직 정해지지 않음.
  # develop을 그대로 두면 dev CD가 prod ECR에도 push할 수 있는 권한을 갖게 되어 위험하므로
  # 우선 존재하지 않는 값("main")으로 잠가둔다 — 실제 prod용 워크플로가 main 브랜치에서
  # 이 role을 assume하기 전까지는 아무 CI도 이 role을 쓸 수 없어 안전한 기본값이다.
  backend_github_branch = "main"

  frontend_bucket_arn         = module.s3_frontend.frontend_bucket_arn
  cloudfront_distribution_arn = module.s3_frontend.cloudfront_distribution_arn
  vector_index_arn            = module.ai_data.vector_index_arn

  backend_ecr_repository_arns = module.ecr.repository_arns

  eks_oidc_provider_arn = module.eks.oidc_provider_arn
  eks_oidc_provider_url = module.eks.oidc_provider_url

  db_seed_bucket_arn = aws_s3_bucket.db_seed_artifacts.arn
}

# =========================
# ECR Module
# =========================

module "ecr" {
  source = "../../modules/ecr"

  project_name = "team04"
  environment  = "prod"

  repository_names = [
    "api-gateway",
    "auth-service",
    "booking-service",
    "chat-bot-service",
    "hotel-service",
    "payment-service",
    "pg-mock-service",
    "user-service",
    "ollama",
    "llm-service",
    "n8n"
  ]
}

# =========================
# EKS Module
# =========================

module "eks" {
  source = "../../modules/eks"

  project_name = "team04-hotel"
  environment  = "prod"

  cluster_role_arn = module.iam.eks_cluster_role_arn
  node_role_arn    = module.iam.eks_node_role_arn
  vpc_cni_role_arn = module.iam.vpc_cni_role_arn

  chatbot_role_arn = module.iam.chatbot_service_role_arn

  chatbot_namespace       = "backend"
  chatbot_service_account = "chatbot-service"

  langchain_namespace = "langchain"

  subnet_ids = module.network.private_app_subnet_ids

  cluster_version = "1.35"

  fargate_pod_execution_role_arn = module.iam.fargate_pod_execution_role_arn

  gpu_instance_types = [
    "g4dn.xlarge"
  ]

  # dev와 동일하게 유지 — g4dn.xlarge 비용이 apply 시점부터 바로 발생한다는 점 참고.
  gpu_desired_size = 1
  gpu_min_size     = 0
  gpu_max_size     = 1

  cloudwatch_observability_role_arn = module.iam.cloudwatch_observability_role_arn
}

# =========================
# GitHub Runner Module
# =========================

module "runner" {
  source = "../../modules/runner"

  environment                     = "prod"
  private_app_subnet_ids          = module.network.private_app_subnet_ids
  github_runner_security_group_id = module.security.github_runner_security_group_id
  iam_instance_profile_name       = module.iam.github_runner_instance_profile_name

  instance_type = "t3.medium"
}