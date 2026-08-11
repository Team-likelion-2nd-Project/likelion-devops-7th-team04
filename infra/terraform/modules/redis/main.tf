# Redis 서브넷 그룹 생성 (Private Data Subnets 묶음)
resource "aws_elasticache_subnet_group" "redis" {
  name       = "team04-${var.environment}-redis-subnet-group"
  subnet_ids = var.private_data_subnet_ids

  tags = {
    Name = "team04-${var.environment}-redis-subnet-group"
  }
}

# ElastiCache Redis 단일 클러스터 생성
resource "aws_elasticache_cluster" "redis" {
  cluster_id           = "team04-${var.environment}-redis"
  engine               = "redis"
  node_type            = var.node_type
  num_cache_nodes      = var.num_cache_nodes
  parameter_group_name = var.parameter_group_name
  engine_version       = var.engine_version
  port                 = 6379

  subnet_group_name  = aws_elasticache_subnet_group.redis.name
  security_group_ids = [var.redis_security_group_id]

  tags = {
    Name = "team04-${var.environment}-redis"
  }
}