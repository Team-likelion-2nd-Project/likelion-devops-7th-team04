variable "project_name" {
  description = "프로젝트 이름"
  type        = string
}

variable "environment" {
  description = "배포 환경 (dev, prod 등)"
  type        = string
}

variable "domain_name" {
  description = "서비스 도메인 이름"
  type        = string
  default     = ""
}