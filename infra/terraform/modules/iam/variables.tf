variable "project_name" {
  description = "Project name used for IAM resource naming"
  type        = string
  default     = "team04-hotel"
}

variable "github_org" {
  description = "GitHub organization name"
  type        = string
  default     = "Team-likelion-2nd-Project"
}

variable "github_repo" {
  description = "GitHub repository name"
  type        = string
  default     = "likelion-devops-7th-team04"
}

variable "github_branch" {
  description = "GitHub branch allowed to assume the CI/CD role"
  type        = string
  default     = "infra"
}

variable "frontend_bucket_arn" {
  description = "ARN of the frontend S3 bucket"
  type        = string
}

variable "cloudfront_distribution_arn" {
  description = "ARN of the frontend CloudFront distribution"
  type        = string
}

variable "vector_index_arn" {
  description = "ARN of the S3 Vectors index used by the chatbot"
  type        = string
}
variable "backend_github_branch" {
  description = "GitHub branch allowed to assume the Backend CD role"
  type        = string
  default     = "develop"
}

variable "backend_ecr_repository_arns" {
  description = "Map of ECR repository ARNs used by Backend CD"
  type        = map(string)
}

# DEV-170: IRSA용 — alb_controller role의 신뢰 정책이 EKS 클러스터의 OIDC provider를
# 참조해야 하므로, eks 모듈에서 만든 OIDC provider 정보를 받아온다.
variable "eks_oidc_provider_arn" {
  description = "ARN of the EKS cluster's IAM OIDC provider (for IRSA trust policies)"
  type        = string
}

variable "eks_oidc_provider_url" {
  description = "EKS cluster OIDC issuer URL without the https:// scheme (used as the Condition key prefix in IRSA trust policies)"
  type        = string
}