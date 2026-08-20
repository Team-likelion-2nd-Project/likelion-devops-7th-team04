variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "us-east-1"
}

variable "cluster_name" {
  description = "EKS cluster name"
  type        = string
  default     = "team04-hotel-prod-eks"
}

variable "vpc_id" {
  description = "VPC ID used by AWS Load Balancer Controller"
  type        = string
}

# Pod Identity 대신 IRSA로 전환하며 Helm release가 ServiceAccount에
# eks.amazonaws.com/role-arn annotation을 직접 달아줘야 한다. 이 addons root는
# ../main.tf(메인 prod root)와 별도 state라 module.iam을 직접 참조할 수 없어
# terraform.tfvars에 값을 수동으로 채운다(dev와 동일한 패턴).
variable "alb_controller_role_arn" {
  description = "ARN of the AWS Load Balancer Controller IAM role (IRSA) — `terraform output alb_controller_role_arn` from ../ 로 채울 것"
  type        = string
}

# DEV-196: alb_controller_role_arn과 동일한 이유 — 이 addons root는 ../main.tf와 별도
# state라 module.iam을 직접 참조할 수 없어 terraform.tfvars에 값을 수동으로 채운다.
variable "cluster_autoscaler_role_arn" {
  description = "ARN of the Cluster Autoscaler IAM role (IRSA) — `terraform output cluster_autoscaler_role_arn` from ../ 로 채울 것"
  type        = string
}
