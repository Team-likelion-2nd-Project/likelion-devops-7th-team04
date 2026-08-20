# ------------------------------------------------------------------------------
# S3 Vectors 인프라 (awscc 프로바이더 활용 - 실제 S3 Vectors 리소스)
# ------------------------------------------------------------------------------

# 1) S3 Vector Bucket 리소스 생성
resource "awscc_s3vectors_vector_bucket" "vector_bucket" {
  vector_bucket_name = var.vector_bucket_name != "" ? var.vector_bucket_name : "${var.project_name}-${var.environment}-vector-bucket"
}

# 2) S3 Vector Index 리소스 생성 (챗봇 임베딩 모델 설정 연동)
resource "awscc_s3vectors_index" "vector_index" {
  vector_bucket_name = awscc_s3vectors_vector_bucket.vector_bucket.vector_bucket_name
  index_name         = var.vector_index_name != "" ? var.vector_index_name : "${var.project_name}-${var.environment}-vector-index"

  # 임베딩 모델 기준 속성 정의 (variables.tf 연동)
  dimension       = var.vector_dimension
  data_type       = var.vector_data_type
  distance_metric = var.vector_distance_metric
}