output "neptune_endpoint" {
  value       = aws_neptune_cluster.ai_data.endpoint
  description = "Neptune Graph DB 접속 엔드포인트"
}

# DEV-57 IAM 연결용 필수 Output
output "vector_bucket_arn" {
  value       = awscc_s3express_directory_bucket.vector_bucket.arn
  description = "S3 Vector Bucket ARN"
}

output "vector_bucket_name" {
  value       = awscc_s3express_directory_bucket.vector_bucket.bucket_name
  description = "S3 Vector Bucket Name"
}

output "vector_index_arn" {
  value       = "${awscc_s3express_directory_bucket.vector_bucket.arn}/index/${var.vector_index_name}"
  description = "S3 Vector Index ARN (DEV-57 Chatbot Role IAM 연동 필수값)"
}

output "vector_index_name" {
  value       = var.vector_index_name
  description = "S3 Vector Index Name"
}