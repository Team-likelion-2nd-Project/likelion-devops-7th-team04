output "cluster_name" {
  description = "Name of the EKS cluster"
  value       = aws_eks_cluster.main.name
}

output "cluster_arn" {
  description = "ARN of the EKS cluster"
  value       = aws_eks_cluster.main.arn
}

output "cluster_endpoint" {
  description = "Endpoint of the EKS cluster"
  value       = aws_eks_cluster.main.endpoint
}

output "cluster_certificate_authority_data" {
  description = "Certificate authority data of the EKS cluster"
  value       = aws_eks_cluster.main.certificate_authority[0].data
  sensitive   = true
}

output "cluster_security_group_id" {
  description = "Security group ID created for the EKS cluster"
  value       = aws_eks_cluster.main.vpc_config[0].cluster_security_group_id
}

output "cpu_node_group_name" {
  description = "Name of the CPU managed node group"
  value       = aws_eks_node_group.cpu.node_group_name
}

output "cpu_node_group_arn" {
  description = "ARN of the CPU managed node group"
  value       = aws_eks_node_group.cpu.arn
}
output "gpu_node_group_name" {
  description = "Name of the GPU managed node group"
  value       = aws_eks_node_group.gpu.node_group_name
}

output "gpu_node_group_arn" {
  description = "ARN of the GPU managed node group"
  value       = aws_eks_node_group.gpu.arn
}