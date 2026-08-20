variable "project_name" {
  description = "Project name used for ECR repository naming"
  type        = string
}

variable "environment" {
  description = "Deployment environment"
  type        = string
}

variable "repository_names" {
  description = "List of ECR repository names"
  type        = list(string)
}