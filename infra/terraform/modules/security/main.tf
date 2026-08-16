# ALB Security Group
resource "aws_security_group" "alb" {
  name        = "${var.project_name}-alb-sg"
  description = "Security group for Application Load Balancer"
  vpc_id      = var.vpc_id

  tags = {
    Name = "${var.project_name}-alb-sg"
  }
}

# EKS Node Security Group
resource "aws_security_group" "eks_node" {
  name        = "${var.project_name}-eks-node-sg"
  description = "Security group for EKS worker nodes"
  vpc_id      = var.vpc_id

  tags = {
    Name = "${var.project_name}-eks-node-sg"
  }
}

# Database Security Group
resource "aws_security_group" "db" {
  name        = "${var.project_name}-db-sg"
  description = "Security group for MariaDB"
  vpc_id      = var.vpc_id

  tags = {
    Name = "${var.project_name}-db-sg"
  }
}

# Redis Security Group
resource "aws_security_group" "redis" {
  name        = "${var.project_name}-redis-sg"
  description = "Security group for Redis"
  vpc_id      = var.vpc_id

  tags = {
    Name = "${var.project_name}-redis-sg"
  }
}

# GitHub Runner Security Group
resource "aws_security_group" "github_runner" {
  name        = "${var.project_name}-github-runner-sg"
  description = "Security group for self-hosted GitHub Actions runner"
  vpc_id      = var.vpc_id

  tags = {
    Name = "${var.project_name}-github-runner-sg"
  }
}
# ALB HTTP
resource "aws_vpc_security_group_ingress_rule" "alb_http" {
  security_group_id = aws_security_group.alb.id

  cidr_ipv4   = "0.0.0.0/0"
  from_port   = 80
  to_port     = 80
  ip_protocol = "tcp"

  description = "Allow HTTP from Internet"
}

# ALB HTTPS
resource "aws_vpc_security_group_ingress_rule" "alb_https" {
  security_group_id = aws_security_group.alb.id

  cidr_ipv4   = "0.0.0.0/0"
  from_port   = 443
  to_port     = 443
  ip_protocol = "tcp"

  description = "Allow HTTPS from Internet"
}

# DB - EKS Node에서만 MariaDB 접근 허용
resource "aws_vpc_security_group_ingress_rule" "db_from_eks" {
  security_group_id = aws_security_group.db.id

  referenced_security_group_id = aws_security_group.eks_node.id
  from_port                    = 3306
  to_port                      = 3306
  ip_protocol                  = "tcp"

  description = "Allow MariaDB from EKS nodes"
}

# Redis - EKS Node에서만 Redis 접근 허용
resource "aws_vpc_security_group_ingress_rule" "redis_from_eks" {
  security_group_id = aws_security_group.redis.id

  referenced_security_group_id = aws_security_group.eks_node.id
  from_port                    = 6379
  to_port                      = 6379
  ip_protocol                  = "tcp"

  description = "Allow Redis from EKS nodes"
}
# ALB Outbound
resource "aws_vpc_security_group_egress_rule" "alb_all" {
  security_group_id = aws_security_group.alb.id

  cidr_ipv4   = "0.0.0.0/0"
  ip_protocol = "-1"

  description = "Allow all outbound traffic"
}

# EKS Node Outbound
resource "aws_vpc_security_group_egress_rule" "eks_node_all" {
  security_group_id = aws_security_group.eks_node.id

  cidr_ipv4   = "0.0.0.0/0"
  ip_protocol = "-1"

  description = "Allow all outbound traffic"
}

# DB Outbound
resource "aws_vpc_security_group_egress_rule" "db_all" {
  security_group_id = aws_security_group.db.id

  cidr_ipv4   = "0.0.0.0/0"
  ip_protocol = "-1"

  description = "Allow all outbound traffic"
}

# Redis Outbound
resource "aws_vpc_security_group_egress_rule" "redis_all" {
  security_group_id = aws_security_group.redis.id

  cidr_ipv4   = "0.0.0.0/0"
  ip_protocol = "-1"

  description = "Allow all outbound traffic"
}

# GitHub Runner Outbound (GitHub polling + ECR/AWS API 접근용, 인바운드는 필요 없음)
resource "aws_vpc_security_group_egress_rule" "github_runner_all" {
  security_group_id = aws_security_group.github_runner.id

  cidr_ipv4   = "0.0.0.0/0"
  ip_protocol = "-1"

  description = "Allow all outbound traffic"
}