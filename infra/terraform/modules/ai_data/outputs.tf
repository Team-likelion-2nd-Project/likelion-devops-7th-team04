output "neptune_endpoint" {
  value       = aws_neptune_cluster.ai_data.endpoint
  description = "Neptune Graph DB 접속 엔드포인트"
}

# ------------------------------------------------------------------------------
# DEV-57 Chatbot Role IAM 권한 연결용 S3 Vectors Output (실제 리소스 참조)
# ------------------------------------------------------------------------------

output "vector_index_arn" {
  description = "S3 Vector Index ARN for Chatbot IAM Policy"
  value       = awscc_s3vectors_index.vector_index.index_arn
}

output "vector_bucket_arn" {
  description = "S3 Vector Bucket ARN"
  value       = awscc_s3vectors_vector_bucket.vector_bucket.vector_bucket_arn
}

output "vector_bucket_name" {
  description = "S3 Vector Bucket Name"
  value       = awscc_s3vectors_vector_bucket.vector_bucket.vector_bucket_name
}

output "vector_index_name" {
  description = "S3 Vector Index Name"
  value       = awscc_s3vectors_index.vector_index.index_name
}