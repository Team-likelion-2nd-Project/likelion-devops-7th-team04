variable "project_name" {
  type        = string
  default     = "team04"
  description = "프로젝트 이름"
}

variable "environment" {
  type        = string
  description = "배포 환경 (예: dev, prod)"
}

variable "vpc_id" {
  type        = string
  default     = ""
  description = "Neptune DB가 위치할 VPC ID"
}

variable "private_subnet_ids" {
  type        = list(string)
  default     = []
  description = "Neptune DB가 배치될 Private Subnet ID 목록"
}

variable "instance_class" {
  type        = string
  default     = "db.t3.medium"
  description = "Neptune DB 인스턴스 사양"
}

variable "vector_bucket_name" {
  type        = string
  default     = ""
  description = "S3 Vector Bucket 이름 (미지정 시 자동 생성)"
}

variable "vector_index_name" {
  type        = string
  default     = "team04-chatbot-vector-index"
  description = "S3 Vector Index 이름"
}