output "alb_security_group_id" {
  description = "Security Group ID for ALB"
  value       = aws_security_group.alb.id
}

output "eks_node_security_group_id" {
  description = "Security Group ID for EKS nodes"
  value       = aws_security_group.eks_node.id
}

output "db_security_group_id" {
  description = "Security Group ID for MariaDB"
  value       = aws_security_group.db.id
}

output "redis_security_group_id" {
  description = "Security Group ID for Redis"
  value       = aws_security_group.redis.id
}

output "github_runner_security_group_id" {
  description = "Security Group ID for the self-hosted GitHub Actions runner"
  value       = aws_security_group.github_runner.id
}