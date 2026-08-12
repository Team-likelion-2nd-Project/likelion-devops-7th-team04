variable "environment" {
  description = "Deployment environment (dev, prod)"
  type        = string
}

variable "vpc_id" {
  description = "VPC ID where DB EC2 will be deployed"
  type        = string
}

variable "private_data_subnet_ids" {
  description = "List of Private Data Subnet IDs"
  type        = list(string)
}

variable "db_security_group_id" {
  description = "Security Group ID for MariaDB"
  type        = string
}

variable "instance_type" {
  description = "EC2 Instance Type for MariaDB"
  type        = string
  default     = "t3.micro"
}

variable "ami_id" {
  description = "AMI ID for MariaDB EC2 (Amazon Linux 2023)"
  type        = string
  default     = "" # 값이 없을 경우 main.tf의 latest AMI 사용
}

variable "ebs_volume_size" {
  description = "EBS Volume Size in GB"
  type        = number
  default     = 20
}

variable "ebs_volume_type" {
  description = "EBS Volume Type (gp3, etc.)"
  type        = string
  default     = "gp3"
}
variable "iam_instance_profile_name" {
  description = "IAM Instance Profile name attached to the MariaDB EC2 instance"
  type        = string
  default     = null
}