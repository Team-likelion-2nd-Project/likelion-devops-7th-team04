output "dynamodb_table_name" {
  description = "DynamoDB Chat History Table Name"
  value       = aws_dynamodb_table.chat_history.name
}

output "dynamodb_table_arn" {
  description = "DynamoDB Chat History Table ARN"
  value       = aws_dynamodb_table.chat_history.arn
}

output "vector_store_bucket_name" {
  description = "Vector Store S3 Bucket Name"
  value       = aws_s3_bucket.vector_store.id
}

output "vector_store_bucket_arn" {
  description = "Vector Store S3 Bucket ARN"
  value       = aws_s3_bucket.vector_store.arn
}