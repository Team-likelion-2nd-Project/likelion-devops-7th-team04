output "s3_bucket_name" {
  description = "프론트엔드 S3 버킷 이름"
  value       = aws_s3_bucket.frontend.id
}

output "cloudfront_domain_name" {
  description = "AWS가 자동 생성한 CloudFront 도메인 주소"
  value       = aws_cloudfront_distribution.frontend.domain_name
}

output "cloudfront_distribution_id" {
  description = "CloudFront Distribution ID (캐시 무효화용)"
  value       = aws_cloudfront_distribution.frontend.id
}