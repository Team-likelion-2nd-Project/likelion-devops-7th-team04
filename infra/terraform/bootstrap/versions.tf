terraform {
  required_version = ">= 1.5.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

# 메인 리전 (us-east-1)
provider "aws" {
  region = var.aws_region
}

# 서브 리전 (us-east-2)
provider "aws" {
  alias  = "secondary"
  region = var.secondary_region
}