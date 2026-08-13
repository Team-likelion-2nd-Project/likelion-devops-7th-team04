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