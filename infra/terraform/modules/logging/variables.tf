variable "project_name" {
  description = "프로젝트 이름"
  type        = string
}

variable "environment" {
  description = "배포 환경 (dev, prod 등)"
  type        = string
}

variable "log_retention_days" {
  description = "액세스 로그 보관 기간 (일). 이후 자동 삭제됨"
  type        = number
  default     = 90
}
