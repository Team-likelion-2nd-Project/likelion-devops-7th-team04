output "dynamodb_table_name" {
  description = "AI 챗봇 대화 히스토리 DynamoDB 테이블 이름"
  value       = aws_dynamodb_table.chat_history.name
}

output "dynamodb_table_arn" {
  description = "AI 챗봇 대화 히스토리 DynamoDB 테이블 ARN"
  value       = aws_dynamodb_table.chat_history.arn
}

output "vector_store_bucket_name" {
  description = "Vector Store S3 버킷 이름"
  value       = aws_s3_bucket.vector_store.id
}

output "vector_store_bucket_arn" {
  description = "Vector Store S3 버킷 ARN"
  value       = aws_s3_bucket.vector_store.arn
}