variable "aws_region" {
  type    = string
  default = "us-east-1"
}

variable "secondary_region" {
  type    = string
  default = "us-east-2"
}

# 1. State 저장용 S3 버킷 생성 (team04-hotel-tf-state-2026)
resource "aws_s3_bucket" "terraform_state" {
  bucket        = "team04-hotel-tf-state-2026" # 팀 공용 버킷명 지정
  force_destroy = false
}

# 2. S3 버킷 버저닝 활성화 (사고 복구/이력 관리용)
resource "aws_s3_bucket_versioning" "terraform_state" {
  bucket = aws_s3_bucket.terraform_state.id
  versioning_configuration {
    status = "Enabled"
  }
}

# 3. S3 버킷 암호화 설정
resource "aws_s3_bucket_server_side_encryption_configuration" "terraform_state" {
  bucket = aws_s3_bucket.terraform_state.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

output "s3_bucket_name" {
  value = aws_s3_bucket.terraform_state.id
}