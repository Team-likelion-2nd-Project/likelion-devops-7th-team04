# ------------------------------------------------------------------------------
# 1. Neptune Graph DB 인프라
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
# 2. S3 Vectors 인프라 (awscc 프로바이더 활용 - 실제 S3 Vectors 리소스)
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