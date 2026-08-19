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

    # DEV-170: eks 모듈의 OIDC provider(IRSA)용 thumbprint 조회에 필요
    tls = {
      source  = "hashicorp/tls"
      version = "~> 4.0"
    }

    # DEV-102: null_resource.seed_bundle(local-exec로 build-seed-bundle.sh 자동 실행)에 필요
    null = {
      source  = "hashicorp/null"
      version = "~> 3.0"
    }
  }

  # backend-config/dev.hcl 을 통해 실제 설정 주입
  backend "s3" {}
}

# =========================
# Providers
# =========================

# 메인 리전 Provider
provider "aws" {
  region = var.aws_region
}

# 서브 리전 Provider
provider "aws" {
  alias  = "secondary"
  region = var.secondary_region
}

# S3 Vectors용 AWSCC Provider
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

# DEV-102: backend/scripts/seed.ts의 SEED_ADMIN_* 환경변수와 동일한 역할 — mariadb user_data가
# 그대로 넘겨받아 admin 계정을 시딩한다.
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
# =========================
# DEV-41 Network Module
# =========================

module "network" {
  source = "../../modules/network"

  project_name = "team04-hotel"
}

# =========================
# DEV-41 Security Module
# =========================

module "security" {
  source = "../../modules/security"

  project_name = "team04-hotel"
  vpc_id       = module.network.vpc_id

  # CPU 워크로드가 Fargate로 전환되며 DB/Redis가 Fargate pod(EKS 클러스터 기본 보안그룹)의
  # 트래픽도 허용해야 함
  eks_cluster_security_group_id = module.eks.cluster_security_group_id
}

# =========================
# DEV-102 DB Seed Artifacts Bucket
# =========================
# backend/scripts/build-seed-bundle.sh로 빌드한 시딩 번들(node_modules + seed.ts 등)을
# 올려두는 버킷. mariadb는 private_data 서브넷이라 인터넷/NAT가 없고 S3 Gateway Endpoint만
# 뚫려 있어, 시딩 산출물은 반드시 S3를 거쳐 전달해야 한다(module.database 참고).

resource "aws_s3_bucket" "db_seed_artifacts" {
  bucket        = "team04-dev-db-seed-artifacts"
  force_destroy = true

  tags = {
    Name        = "team04-dev-db-seed-artifacts"
    Environment = "dev"
  }
}

resource "aws_s3_bucket_public_access_block" "db_seed_artifacts" {
  bucket                  = aws_s3_bucket.db_seed_artifacts.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# DEV-102: build-seed-bundle.sh를 사람이 순서를 기억해 수동으로 돌려야 했던 문제를 없애기
# 위해, 이 스크립트 실행 자체를 terraform apply 안으로 편입시킨다. seed 관련 소스가 실제로
# 바뀌었을 때만(triggers.source_hash 변경) Docker로 재빌드+S3 업로드가 실행되고, 이 값은
# module.database에도 그대로 흘러들어가 mariadb user_data를 바꿔 재시딩을 트리거한다.
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
# DEV-43 Database Module
# =========================

module "database" {
  source = "../../modules/database"

  environment             = "dev"
  vpc_id                  = module.network.vpc_id
  private_data_subnet_ids = module.network.private_data_subnet_ids
  db_security_group_id    = module.security.db_security_group_id

  # DEV-57 CloudWatch Agent / SSM Instance Profile
  iam_instance_profile_name = module.iam.cloudwatch_agent_instance_profile_name

  instance_type   = "t3.micro"
  ebs_volume_size = 20
  ebs_volume_type = "gp3"

  # DEV-102: MariaDB 데이터(/var/lib/mysql) 전용 영구 볼륨 — 인스턴스 replace와 무관하게 보존됨
  data_volume_size = 20
  data_volume_type = "gp3"

  db_root_password = var.db_root_password

  # DEV-102: backend/scripts/seed.ts를 user_data 부팅 시 그대로 실행
  seed_admin_email    = var.seed_admin_email
  seed_admin_password = var.seed_admin_password
  seed_admin_name     = var.seed_admin_name
  seed_bundle_s3_uri  = "s3://${aws_s3_bucket.db_seed_artifacts.bucket}/seed/seed-bundle.tar.gz"
  seed_bundle_hash    = local.seed_bundle_hash

  # null_resource.seed_bundle이 S3에 번들을 실제로 올려둔 뒤에만 mariadb가 생성/재생성되도록
  # Terraform 의존성 그래프로 순서를 강제한다 (사람이 순서를 기억할 필요 없음).
  depends_on = [null_resource.seed_bundle]
}

# =========================
# DEV-45 Redis Module
# =========================

module "redis" {
  source = "../../modules/redis"

  environment             = "dev"
  vpc_id                  = module.network.vpc_id
  private_data_subnet_ids = module.network.private_data_subnet_ids
  redis_security_group_id = module.security.redis_security_group_id

  node_type = "cache.t3.micro"
}

# =========================
# DEV-47 Frontend S3 / CloudFront
# =========================

module "s3_frontend" {
  source = "../../modules/s3_frontend"

  project_name = "team04"
  environment  = "dev"

  # DEV-171: www.team04hotel.kro.kr을 CloudFront에 alias로 연결. DNS(kro.kr)는 팀원이
  # 별도로 CNAME 등록 — 여기서는 CloudFront/ACM 쪽만 처리.
  domain_name        = "www.team04hotel.kro.kr"
  certificate_domain = "*.team04hotel.kro.kr"

  # DEV-185: CloudFront 액세스 로그를 modules/logging의 로그 버킷에 저장
  log_bucket_domain_name = module.logging.log_bucket_domain_name
}

# =========================
# DEV-185 Logging Module (CloudFront + ALB 액세스 로그)
# =========================

module "logging" {
  source = "../../modules/logging"

  project_name = "team04"
  environment  = "dev"
}

# =========================
# DEV-50 AI Chatbot Data
# =========================

module "ai_data" {
  source = "../../modules/ai_data"

  project_name = "team04"
  environment  = "dev"
}

# =========================
# DEV-187 Chatbot DynamoDB Tables
# =========================
# chat-bot-service가 기대하는 ChatSessions/ChatMessages 테이블이 이 저장소 어디에도
# 프로비저닝된 적이 없어(코드 주석은 "infra/terraform으로 프로비저닝됩니다"라고
# 되어 있었지만 실제로는 존재하지 않았음), IRSA 자격증명(DEV-184)과 IAM 권한(DEV-186)을
# 다 고친 뒤에도 ResourceNotFoundException으로 로그인 사용자 챗봇 호출이 계속
# 503을 반환했다(실측 확인). backend/scripts/dynamodb-init.ts(로컬 dynamodb-local용)와
# 동일한 스키마로 실제 AWS DynamoDB에 생성한다.
#
# 리전은 별도 provider 없이 메인 provider(us-east-1)를 그대로 쓴다 — 원래
# DYNAMODB_REGION이 ap-northeast-2였지만, EKS/ECR/VPC 등 이 프로젝트의 다른 인프라가
# 전부 us-east-1이라 굳이 두 번째 리전을 쓸 이유가 없어 us-east-1로 통일한다.
# (gitops/backend/base/chat-bot-service/deployment.yaml의 DYNAMODB_REGION도 같이
# us-east-1로 맞춰야 함 — 별도 GitOps PR)
module "dynamodb" {
  source = "../../modules/dynamodb"

  project_name = "team04-hotel"
  environment  = "dev"
}

# =========================
# DEV-53 CloudWatch Monitoring
# =========================

module "cloudwatch" {
  source = "../../modules/cloudwatch"

  environment  = "dev"
  alarm_email  = var.alarm_email
  cluster_name = module.eks.cluster_name

  # 실제 EC2 모니터링 연동 시 사용
  # ec2_instance_id = module.database.db_instance_id
}

# =========================
# DEV-57 IAM Module
# =========================

module "iam" {
  source = "../../modules/iam"

  project_name  = "team04-hotel"
  github_org    = "Team-likelion-2nd-Project"
  github_repo   = "likelion-devops-7th-team04"
  github_branch = "infra"

  # Backend CD는 develop 브랜치에서 수동 실행
  backend_github_branch = "develop"

  frontend_bucket_arn         = module.s3_frontend.frontend_bucket_arn
  cloudfront_distribution_arn = module.s3_frontend.cloudfront_distribution_arn
  vector_index_arn            = module.ai_data.vector_index_arn

  # DEV-46 ECR Repository와 Backend CD IAM 연결
  backend_ecr_repository_arns = module.ecr.repository_arns

  # DEV-170: alb_controller role의 신뢰 정책(IRSA)이 eks 모듈의 OIDC provider를 참조.
  # module.eks가 module.iam의 다른 role ARN들(cluster/node/vpc_cni/chatbot)에 의존하는
  # 반대 방향 참조와는 별개 리소스 체인이라 순환 의존은 아님(alb_controller role만 해당).
  eks_oidc_provider_arn = module.eks.oidc_provider_arn
  eks_oidc_provider_url = module.eks.oidc_provider_url

  # DEV-102: mariadb EC2(cloudwatch_agent instance profile)가 시딩 번들을 S3에서 받아올 수 있게
  db_seed_bucket_arn = aws_s3_bucket.db_seed_artifacts.arn
}

# =========================
# DEV-46 ECR Module
# =========================

module "ecr" {
  source = "../../modules/ecr"

  project_name = "team04"
  environment  = "dev"

  repository_names = [
    "api-gateway",
    "auth-service",
    "booking-service",
    "chat-bot-service",
    "hotel-service",
    "payment-service",
    "pg-mock-service",
    "user-service",
    # langchain_rag/ollama, langchain_rag/llm-service 이미지용 (n8n은 퍼블릭
    # n8nio/n8n 이미지를 그대로 쓰므로 ECR repo 불필요)
    "ollama",
    "llm-service"
  ]
}

# =========================
# DEV-46 EKS Module
# =========================

module "eks" {
  source = "../../modules/eks"

  project_name = "team04-hotel"
  environment  = "dev"

  # DEV-57 IAM Role 연동
  # alb_controller_role_arn은 더 이상 넘기지 않음 — DEV-170에서 IRSA로 전환하며
  # eks 모듈은 이 role을 몰라도 됨(대신 module.iam이 eks의 OIDC provider를 참조함)
  cluster_role_arn = module.iam.eks_cluster_role_arn
  node_role_arn    = module.iam.eks_node_role_arn
  vpc_cni_role_arn = module.iam.vpc_cni_role_arn

  chatbot_role_arn = module.iam.chatbot_service_role_arn

  # chat-bot-service가 backend 네임스페이스로 통합되어 Pod Identity 연결도 함께 갱신
  chatbot_namespace       = "backend"
  chatbot_service_account = "chatbot-service"

  # langchain AI 파이프라인(llm-service/n8n/ollama, gitops/langchain/)의 Fargate profile
  # label selector 대상 네임스페이스 — compute=fargate 라벨이 있는 pod(llm-service, n8n)만
  # 여기서 Fargate로 뜨고, ollama는 GPU node group으로 감(위 CPU Fargate Profile 주석 참고)
  langchain_namespace = "langchain"

  # EKS Cluster / Node는 Private App Subnet에 배치
  subnet_ids = module.network.private_app_subnet_ids

  cluster_version = "1.35"

  # -------------------------
  # CPU: EKS Fargate Profile (기존 EC2 관리형 노드 그룹에서 전환 — pod 수용량 한계 대응)
  # -------------------------

  fargate_pod_execution_role_arn = module.iam.fargate_pod_execution_role_arn

  # -------------------------
  # GPU Node Group
  # -------------------------

  gpu_instance_types = [
    "g4dn.xlarge"
  ]

  # GPU 노드 실제 기동 테스트를 위해 1대로 설정 (g4dn.xlarge 비용 발생 — 테스트가
  # 끝나면 다시 0으로 내려서 비용을 막으세요)
  gpu_desired_size = 1
  gpu_min_size     = 0
  gpu_max_size     = 1

  # DEV-177: Container Insights addon의 IRSA role
  cloudwatch_observability_role_arn = module.iam.cloudwatch_observability_role_arn
}

# =========================
# DEV-146 GitHub Runner Module
# =========================
# 계정 SCP가 GitHub Actions OIDC(sts:AssumeRoleWithWebIdentity)를 막고 있어
# GitHub-hosted runner로는 backend_cd role을 assume할 수 없었다. self-hosted runner를
# EC2에 띄우고 Instance Profile로 동일한 ECR push 권한을 직접 부여해 우회한다.

module "runner" {
  source = "../../modules/runner"

  environment                     = "dev"
  private_app_subnet_ids          = module.network.private_app_subnet_ids
  github_runner_security_group_id = module.security.github_runner_security_group_id
  iam_instance_profile_name       = module.iam.github_runner_instance_profile_name

  instance_type = "t3.medium"
}