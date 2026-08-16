output "runner_instance_id" {
  description = "GitHub Runner EC2 Instance ID"
  value       = aws_instance.github_runner.id
}

output "runner_private_ip" {
  description = "GitHub Runner EC2 Private IP"
  value       = aws_instance.github_runner.private_ip
}
