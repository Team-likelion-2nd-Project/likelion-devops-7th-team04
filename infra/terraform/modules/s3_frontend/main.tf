# 1. Frontend 호스팅용 S3 Bucket
resource "aws_s3_bucket" "frontend" {
  bucket        = "${var.project_name}-${var.environment}-frontend-bucket"
  force_destroy = true

  tags = {
    Name        = "${var.project_name}-${var.environment}-frontend-bucket"
    Environment = var.environment
  }
}

# 2. S3 Public Access 차단 설정
resource "aws_s3_bucket_public_access_block" "frontend_public_access" {
  bucket                  = aws_s3_bucket.frontend.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# 3. CloudFront Origin Access Control (OAC)
resource "aws_cloudfront_origin_access_control" "frontend_oac" {
  name                              = "${var.project_name}-${var.environment}-frontend-oac"
  description                       = "OAC for Frontend S3 Bucket"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

# DEV-171: CloudFront는 커스텀 도메인용 인증서가 반드시 us-east-1에 있어야 함(이미 충족).
# domain_name이 빈 문자열이면 조회하지 않음(기존처럼 *.cloudfront.net 기본 도메인만 사용).
data "aws_acm_certificate" "frontend" {
  count       = var.domain_name != "" ? 1 : 0
  domain      = var.certificate_domain
  statuses    = ["ISSUED"]
  most_recent = true
}

# 4. CloudFront Distribution
resource "aws_cloudfront_distribution" "frontend" {
  origin {
    domain_name              = aws_s3_bucket.frontend.bucket_regional_domain_name
    origin_id                = "S3-${aws_s3_bucket.frontend.id}"
    origin_access_control_id = aws_cloudfront_origin_access_control.frontend_oac.id
  }

  enabled             = true
  is_ipv6_enabled     = true
  default_root_object = "index.html"
  aliases             = var.domain_name != "" ? [var.domain_name] : null

  default_cache_behavior {
    allowed_methods  = ["GET", "HEAD"]
    cached_methods   = ["GET", "HEAD"]
    target_origin_id = "S3-${aws_s3_bucket.frontend.id}"

    forwarded_values {
      query_string = false
      cookies {
        forward = "none"
      }
    }

    viewer_protocol_policy = "redirect-to-https"
    min_ttl                = 0
    default_ttl            = 3600
    max_ttl                = 86400
  }

  # SPA(React Router) fallback: S3(OAC로 보호된 private 버킷)는 존재하지 않는 키에
  # 403(AccessDenied)을 반환하므로, CloudFront 단에서 index.html로 되돌려 클라이언트
  # 라우터가 경로를 처리하게 한다. 404는 향후 버킷 정책이 바뀌는 경우를 대비한 방어적 설정.
  custom_error_response {
    error_code         = 403
    response_code      = 200
    response_page_path = "/index.html"
  }

  custom_error_response {
    error_code         = 404
    response_code      = 200
    response_page_path = "/index.html"
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  # log_bucket_domain_name이 빈 문자열이면 로깅 비활성화 (domain_name과 동일한 옵션 패턴)
  dynamic "logging_config" {
    for_each = var.log_bucket_domain_name != "" ? [1] : []
    content {
      include_cookies = false
      bucket          = var.log_bucket_domain_name
      prefix          = "cloudfront/"
    }
  }

  viewer_certificate {
    cloudfront_default_certificate = var.domain_name == ""
    acm_certificate_arn            = var.domain_name != "" ? data.aws_acm_certificate.frontend[0].arn : null
    ssl_support_method             = var.domain_name != "" ? "sni-only" : null
    minimum_protocol_version       = var.domain_name != "" ? "TLSv1.2_2021" : null
  }

  tags = {
    Name        = "${var.project_name}-${var.environment}-frontend-cdn"
    Environment = var.environment
  }
}

# 5. S3 Bucket Policy (CloudFront 접근 허용)
resource "aws_s3_bucket_policy" "frontend_bucket_policy" {
  bucket = aws_s3_bucket.frontend.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "AllowCloudFrontServicePrincipalReadOnly"
        Effect = "Allow"
        Principal = {
          Service = "cloudfront.amazonaws.com"
        }
        Action   = "s3:GetObject"
        Resource = "${aws_s3_bucket.frontend.arn}/*"
        Condition = {
          StringEquals = {
            "AWS:SourceArn" = aws_cloudfront_distribution.frontend.arn
          }
        }
      }
    ]
  })
}