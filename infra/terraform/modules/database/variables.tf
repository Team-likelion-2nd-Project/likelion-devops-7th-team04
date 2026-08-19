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

variable "db_root_password" {
  description = "Root password to configure for the MariaDB instance on first boot"
  type        = string
  sensitive   = true
}

variable "db_database_name" {
  description = "Initial database name to create on first boot"
  type        = string
  default     = "hotel_service"
}

# DEV-102: backend/scripts/seed.ts를 그대로 실행하기 위한 값들. 로컬 db-seed(docker-compose)의
# SEED_ADMIN_* 환경변수와 동일한 역할 — terraform.tfvars로 값을 채운다.
variable "seed_admin_email" {
  description = "관리자 계정으로 시딩할 이메일 (backend/scripts/seed.ts의 SEED_ADMIN_EMAIL과 동일)"
  type        = string
}

variable "seed_admin_password" {
  description = "관리자 계정으로 시딩할 비밀번호 (backend/scripts/seed.ts의 SEED_ADMIN_PASSWORD와 동일)"
  type        = string
  sensitive   = true
}

variable "seed_admin_name" {
  description = "관리자 계정 이름 (backend/scripts/seed.ts의 SEED_ADMIN_NAME과 동일)"
  type        = string
  default     = "관리자"
}

variable "seed_bundle_s3_uri" {
  description = "build-seed-bundle.sh로 미리 빌드해 업로드해 둔 시딩 번들(tar.gz)의 s3:// URI"
  type        = string
}

# DEV-102: seed 관련 소스 파일들의 해시. user_data에 주석으로 삽입해, 이 값이 바뀌면
# user_data 문자열 자체가 바뀌어 user_data_replace_on_change가 실제로 replace(재시딩)를
# 트리거하게 만든다 — S3에 새 번들을 올리는 것만으로는 이미 떠 있는 인스턴스가 이를
# 감지할 방법이 없기 때문 (environments/dev/main.tf의 null_resource.seed_bundle 참고).
variable "seed_bundle_hash" {
  description = "시딩 번들 소스 파일들의 해시 (변경 감지용, 값 자체엔 의미 없음)"
  type        = string
}