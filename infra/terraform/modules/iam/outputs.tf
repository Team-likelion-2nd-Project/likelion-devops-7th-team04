output "eks_cluster_role_arn" {
  description = "ARN of the EKS Cluster IAM role"
  value       = aws_iam_role.eks_cluster.arn
}

output "eks_node_role_arn" {
  description = "ARN of the EKS Node IAM role"
  value       = aws_iam_role.eks_node.arn
}

output "cloudwatch_agent_role_arn" {
  description = "ARN of the CloudWatch Agent IAM role"
  value       = aws_iam_role.cloudwatch_agent.arn
}

output "cloudwatch_agent_instance_profile_name" {
  description = "Name of the CloudWatch Agent EC2 instance profile"
  value       = aws_iam_instance_profile.cloudwatch_agent.name
}

output "cloudwatch_agent_instance_profile_arn" {
  description = "ARN of the CloudWatch Agent EC2 instance profile"
  value       = aws_iam_instance_profile.cloudwatch_agent.arn
}

output "alb_controller_role_arn" {
  description = "ARN of the AWS Load Balancer Controller IAM role"
  value       = aws_iam_role.alb_controller.arn
}

output "chatbot_service_role_arn" {
  description = "ARN of the Chatbot Service IAM role"
  value       = aws_iam_role.chatbot_service.arn
}

output "cicd_role_arn" {
  description = "ARN of the CI/CD IAM role"
  value       = aws_iam_role.cicd.arn
}
output "vpc_cni_role_arn" {
  description = "IAM role ARN for the Amazon VPC CNI add-on"
  value       = aws_iam_role.vpc_cni.arn
}
output "backend_cd_role_arn" {
  description = "ARN of the Backend CD IAM role"
  value       = aws_iam_role.backend_cd.arn
}
output "github_runner_role_arn" {
  description = "ARN of the self-hosted GitHub Actions runner IAM role"
  value       = aws_iam_role.github_runner.arn
}
output "github_runner_instance_profile_name" {
  description = "Name of the self-hosted GitHub Actions runner EC2 instance profile"
  value       = aws_iam_instance_profile.github_runner.name
}