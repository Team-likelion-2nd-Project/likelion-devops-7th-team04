terraform {
  required_version = ">= 1.5.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  # 백엔드 설정 (backend-config/dev.hcl 을 통해 주입받음)
  backend "s3" {}
}

# 메인 리전 Provider (us-east-1)
provider "aws" {
  region = var.aws_region
}

# 서브 리전 Provider (us-east-2)
provider "aws" {
  alias  = "secondary"
  region = var.secondary_region
}

variable "aws_region" {
  type    = string
  default = "us-east-1"
}

variable "secondary_region" {
  type    = string
  default = "us-east-2"
}
# DEV-41 Network Module
module "network" {
  source = "../../modules/network"

  project_name = "team04-hotel"
}

# DEV-41 Security Module
module "security" {
  source = "../../modules/security"

  project_name = "team04-hotel"
  vpc_id       = module.network.vpc_id
}

# Database Module (DEV-43)
module "database" {
  source = "../../modules/database"

  environment             = "dev"
  vpc_id                  = module.network.vpc_id
  private_data_subnet_ids = module.network.private_data_subnet_ids
  db_security_group_id    = module.security.db_security_group_id

  instance_type   = "t3.micro"
  ebs_volume_size = 20
  ebs_volume_type = "gp3"
}

# DEV-45 Redis Module (새로 추가할 부분)
module "redis" {
  source = "../../modules/redis"

  environment             = "dev"
  vpc_id                  = module.network.vpc_id
  private_data_subnet_ids = module.network.private_data_subnet_ids
  redis_security_group_id = module.security.redis_security_group_id

  node_type = "cache.t3.micro"
}