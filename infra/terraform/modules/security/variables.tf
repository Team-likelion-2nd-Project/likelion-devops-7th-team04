variable "project_name" {
  description = "Project name used for AWS resource naming"
  type        = string
  default     = "team04-hotel"
}

variable "vpc_id" {
  description = "VPC ID where security groups will be created"
  type        = string
}

variable "eks_cluster_security_group_id" {
  description = "EKS cluster security group ID (used by Fargate pods for network traffic)"
  type        = string
}