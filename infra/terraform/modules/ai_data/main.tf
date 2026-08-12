# ------------------------------------------------------------------------------
# 1. Neptune Graph DB 인프라 (기존)
# ------------------------------------------------------------------------------

# Neptune Subnet Group
resource "aws_neptune_subnet_group" "ai_data" {
  name       = "team04-${var.environment}-neptune-subnet-group"
  subnet_ids = var.private_subnet_ids
}

# Neptune 보안 그룹 (기본 포트 8182)
resource "aws_security_group" "ai_data_sg" {
  name        = "team04-${var.environment}-neptune-sg"
  description = "Security group for Neptune Graph DB"
  vpc_id      = var.vpc_id

  ingress {
    from_port   = 8182
    to_port     = 8182
    protocol    = "tcp"
    cidr_blocks = ["10.0.0.0/16"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

# Neptune DB 클러스터 생성
resource "aws_neptune_cluster" "ai_data" {
  cluster_identifier                  = "team04-${var.environment}-neptune-cluster"
  engine                              = "neptune"
  neptune_subnet_group_name           = aws_neptune_subnet_group.ai_data.name
  vpc_security_group_ids              = [aws_security_group.ai_data_sg.id]
  skip_final_snapshot                 = true
  iam_database_authentication_enabled = false
}

# Neptune DB 클러스터 인스턴스 노드 생성
resource "aws_neptune_cluster_instance" "ai_data_instance" {
  count              = 1
  identifier         = "team04-${var.environment}-neptune-instance-${count.index}"
  cluster_identifier = aws_neptune_cluster.ai_data.id
  instance_class     = var.instance_class
  engine             = "neptune"
}

# ------------------------------------------------------------------------------
# 2. S3 Vectors 인프라 (awscc 프로바이더 활용)
# ------------------------------------------------------------------------------

# S3 Vector Bucket 생성
resource "awscc_s3express_directory_bucket" "vector_bucket" {
  bucket_name     = var.vector_bucket_name != "" ? var.vector_bucket_name : "team04-${var.environment}-vector-bucket--ap-northeast-2a--x-s3"
  location_name   = "apne2-az1"
  data_redundancy = "SingleAvailabilityZone"
}

# 참고: AWS S3 Vectors 및 S3 Express Directory Bucket의 구체적인 awscc 스키마 사양이나 환경별 설정에 맞춰 리소스 명칭을 조정할 수 있습니다.