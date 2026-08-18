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

  db_root_password = var.db_root_password
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
}

# =========================
# DEV-50 AI Chatbot Data
# =========================

module "ai_data" {
  source = "../../modules/ai_data"

  project_name = "team04"
  environment  = "dev"

  vpc_id             = module.network.vpc_id
  private_subnet_ids = module.network.private_data_subnet_ids
}

# =========================
# DEV-53 CloudWatch Monitoring
# =========================

module "cloudwatch" {
  source = "../../modules/cloudwatch"

  environment = "dev"
  alarm_email = var.alarm_email

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
  cluster_role_arn        = module.iam.eks_cluster_role_arn
  node_role_arn           = module.iam.eks_node_role_arn
  vpc_cni_role_arn        = module.iam.vpc_cni_role_arn
  alb_controller_role_arn = module.iam.alb_controller_role_arn

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