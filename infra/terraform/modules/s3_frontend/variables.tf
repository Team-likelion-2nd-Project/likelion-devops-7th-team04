variable "project_name" {
  description = "프로젝트 이름"
  type        = string
}

variable "environment" {
  description = "배포 환경 (dev, prod 등)"
  type        = string
}

variable "domain_name" {
  description = "CloudFront에 연결할 커스텀 도메인(alias). 빈 문자열이면 *.cloudfront.net 기본 도메인만 사용"
  type        = string
  default     = ""
}

# DEV-171: domain_name을 실제로 CloudFront aliases/viewer_certificate에 연결하며 추가.
# CloudFront는 인증서가 반드시 us-east-1에 있어야 하므로, 이 변수로 조회할 인증서의 도메인을
# 별도로 받는다(와일드카드 인증서 하나로 여러 서브도메인을 커버하는 경우 domain_name과 다를 수
# 있음 — 예: domain_name="www.team04hotel.kro.kr", certificate_domain="*.team04hotel.kro.kr").
variable "certificate_domain" {
  description = "ACM에서 조회할 인증서의 도메인(예: 와일드카드 *.team04hotel.kro.kr). domain_name이 빈 문자열이면 사용되지 않음"
  type        = string
  default     = ""
}