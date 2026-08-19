output "log_bucket_id" {
  description = "로그 버킷 이름"
  value       = aws_s3_bucket.logs.id
}

output "log_bucket_arn" {
  description = "로그 버킷 ARN"
  value       = aws_s3_bucket.logs.arn
}

output "log_bucket_domain_name" {
  description = "로그 버킷의 리전별 도메인 이름 (CloudFront logging_config에 사용)"
  value       = aws_s3_bucket.logs.bucket_domain_name
}
