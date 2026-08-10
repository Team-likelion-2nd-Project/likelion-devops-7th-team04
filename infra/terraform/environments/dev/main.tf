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