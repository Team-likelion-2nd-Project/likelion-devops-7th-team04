# 1. AI 챗봇 대화 세션/히스토리 저장용 DynamoDB 테이블
resource "aws_dynamodb_table" "chat_history" {
  name         = "${var.project_name}-${var.environment}-chat-history"
  billing_mode = "PAY_PER_REQUEST" # 온디맨드 용량 모드
  hash_key     = "SessionId"
  range_key    = "CreatedAt"

  attribute {
    name = "SessionId"
    type = "S"
  }

  attribute {
    name = "CreatedAt"
    type = "S"
  }

  tags = {
    Name        = "${var.project_name}-${var.environment}-chat-history"
    Environment = var.environment
  }
}

# 2. AI Vector Store 및 임베딩 문서 저장용 S3 버킷
resource "aws_s3_bucket" "vector_store" {
  bucket        = "${var.project_name}-${var.environment}-vector-store-bucket"
  force_destroy = true

  tags = {
    Name        = "${var.project_name}-${var.environment}-vector-store-bucket"
    Environment = var.environment
  }
}

# 3. Vector Store S3 버킷 퍼블릭 액세스 차단 (보안 강화)
resource "aws_s3_bucket_public_access_block" "vector_store" {
  bucket = aws_s3_bucket.vector_store.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}