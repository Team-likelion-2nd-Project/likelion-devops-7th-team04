variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "us-east-1"
}

variable "cluster_name" {
  description = "EKS cluster name"
  type        = string
  default     = "team04-hotel-dev-eks"
}

variable "vpc_id" {
  description = "VPC ID used by AWS Load Balancer Controller"
  type        = string
}