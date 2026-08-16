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
    "user-service"
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

  chatbot_namespace       = "chatbot"
  chatbot_service_account = "chatbot-service"

  # EKS Cluster / Node는 Private App Subnet에 배치
  subnet_ids = module.network.private_app_subnet_ids

  cluster_version = "1.35"

  # -------------------------
  # CPU Node Group
  # -------------------------

  node_instance_types = [
    "t3.medium"
  ]

  desired_size = 1
  min_size     = 1
  max_size     = 2

  # -------------------------
  # GPU Node Group
  # -------------------------

  gpu_instance_types = [
    "g4dn.xlarge"
  ]

  # 개발 환경에서는 GPU 비용 방지를 위해 기본 0대
  gpu_desired_size = 0
  gpu_min_size     = 0
  gpu_max_size     = 1
}