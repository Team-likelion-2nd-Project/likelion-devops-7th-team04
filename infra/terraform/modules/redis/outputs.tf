output "redis_endpoint" {
  description = "Redis Cluster Primary Endpoint Address"
  value       = aws_elasticache_cluster.redis.cache_nodes[0].address
}

output "redis_port" {
  description = "Redis Cluster Port"
  value       = aws_elasticache_cluster.redis.port
}