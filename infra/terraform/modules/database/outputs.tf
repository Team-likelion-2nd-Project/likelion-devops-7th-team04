output "db_instance_id" {
  description = "MariaDB EC2 Instance ID"
  value       = aws_instance.mariadb.id
}

output "db_private_ip" {
  description = "MariaDB EC2 Private IP"
  value       = aws_instance.mariadb.private_ip
}