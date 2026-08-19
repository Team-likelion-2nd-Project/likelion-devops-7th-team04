# 액세스 로그 저장용 S3 버킷 (CloudFront + ALB)
resource "aws_s3_bucket" "logs" {
  bucket        = "${var.project_name}-${var.environment}-access-logs"
  force_destroy = true

  tags = {
    Name        = "${var.project_name}-${var.environment}-access-logs"
    Environment = var.environment
  }
}

resource "aws_s3_bucket_public_access_block" "logs" {
  bucket                  = aws_s3_bucket.logs.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# 오래된 로그 자동 삭제 (비용 관리)
resource "aws_s3_bucket_lifecycle_configuration" "logs" {
  bucket = aws_s3_bucket.logs.id

  rule {
    id     = "expire-old-logs"
    status = "Enabled"

    filter {}

    expiration {
      days = var.log_retention_days
    }
  }
}

# ------------------------------------------------------------------------------
# CloudFront 표준 로깅용 권한 (ACL 기반)
# ------------------------------------------------------------------------------
# CloudFront의 logging_config는 버킷 정책이 아니라 ACL로 전달 권한을 받는 레거시 방식.
# awslogsdelivery라는 AWS 고정 계정(전 리전 공통)에 WRITE/READ_ACP 권한을 부여해야 함.
# 이를 위해 버킷의 Object Ownership을 BucketOwnerPreferred로 완화해 ACL을 활성화한다.

resource "aws_s3_bucket_ownership_controls" "logs" {
  bucket = aws_s3_bucket.logs.id

  rule {
    object_ownership = "BucketOwnerPreferred"
  }
}

data "aws_canonical_user_id" "current" {}

resource "aws_s3_bucket_acl" "logs" {
  depends_on = [aws_s3_bucket_ownership_controls.logs]
  bucket     = aws_s3_bucket.logs.id

  access_control_policy {
    owner {
      id = data.aws_canonical_user_id.current.id
    }

    grant {
      grantee {
        type = "CanonicalUser"
        id   = data.aws_canonical_user_id.current.id
      }
      permission = "FULL_CONTROL"
    }

    # CloudFront 표준 로그 전달 전용 AWS 계정 ID (awslogsdelivery, 전 리전 공통 고정 값)
    grant {
      grantee {
        type = "CanonicalUser"
        id   = "c4c1ede66af53448b93c283ce9448c4ba468c9432aa01d700d3878632f77d2d"
      }
      permission = "WRITE"
    }

    grant {
      grantee {
        type = "CanonicalUser"
        id   = "c4c1ede66af53448b93c283ce9448c4ba468c9432aa01d700d3878632f77d2d"
      }
      permission = "READ_ACP"
    }
  }
}

# ------------------------------------------------------------------------------
# ALB 액세스 로깅용 권한 (버킷 정책 기반)
# ------------------------------------------------------------------------------
# ALB 로그 전달은 리전별 ELB 서비스 계정 + 최신 로그 전달 서비스 주체 둘 다 허용해야
# 안정적으로 동작함 (AWS가 전달 방식을 이관하는 과도기라 두 방식을 함께 명시하는 것이 표준 패턴).

data "aws_elb_service_account" "main" {}

resource "aws_s3_bucket_policy" "logs" {
  bucket = aws_s3_bucket.logs.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "AllowALBLogDeliveryLegacyAccount"
        Effect = "Allow"
        Principal = {
          AWS = data.aws_elb_service_account.main.arn
        }
        Action   = "s3:PutObject"
        Resource = "${aws_s3_bucket.logs.arn}/alb/*"
      },
      {
        Sid    = "AllowALBLogDeliveryServicePrincipal"
        Effect = "Allow"
        Principal = {
          Service = "logdelivery.elasticloadbalancing.amazonaws.com"
        }
        Action   = "s3:PutObject"
        Resource = "${aws_s3_bucket.logs.arn}/alb/*"
        Condition = {
          StringEquals = {
            "s3:x-amz-acl" = "bucket-owner-full-control"
          }
        }
      }
    ]
  })
}
