variable "environment" {
  type        = string
  description = "배포 환경 (예: dev, prod)"
}

variable "alarm_email" {
  type        = string
  default     = "team04@example.com" # 알림을 받을 이메일 주소
  description = "CloudWatch 경보 발생 시 SNS 알림을 수신할 이메일 주소"
}

variable "ec2_instance_id" {
  type        = string
  default     = ""
  description = "모니터링할 EC2 인스턴스 ID (선택 사항)"
}

variable "cluster_name" {
  type        = string
  description = "DEV-177 대시보드가 조회할 EKS 클러스터 이름 (Container Insights 메트릭의 ClusterName 차원)"
}