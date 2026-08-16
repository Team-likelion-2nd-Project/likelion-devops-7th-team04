variable "environment" {
  description = "Deployment environment (dev, prod)"
  type        = string
}

variable "private_app_subnet_ids" {
  description = "List of Private App Subnet IDs"
  type        = list(string)
}

variable "github_runner_security_group_id" {
  description = "Security Group ID for the GitHub Actions runner"
  type        = string
}

variable "iam_instance_profile_name" {
  description = "IAM Instance Profile name attached to the GitHub runner EC2 instance"
  type        = string
  default     = null
}

variable "instance_type" {
  description = "EC2 Instance Type for the GitHub runner"
  type        = string
  default     = "t3.medium"
}

variable "ebs_volume_size" {
  description = "EBS Volume Size in GB"
  type        = number
  default     = 30
}

variable "ebs_volume_type" {
  description = "EBS Volume Type (gp3, etc.)"
  type        = string
  default     = "gp3"
}
