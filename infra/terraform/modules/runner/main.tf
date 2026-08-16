# 최신 Amazon Linux 2023 AMI 조회 (database 모듈과 동일한 조회 방식)
data "aws_ami" "amazon_linux_2023" {
  most_recent = true
  owners      = ["amazon"]

  filter {
    name   = "name"
    values = ["al2023-ami-2023*-x86_64"]
  }

  filter {
    name   = "virtualization-type"
    values = ["hvm"]
  }
}

# self-hosted GitHub Actions runner 전용 EC2 인스턴스 (Private App Subnet 첫 번째 AZ에 생성).
# GitHub runner 에이전트 등록(config.sh)은 토큰이 짧은 시간 내 만료되는 일회성 값이라
# Terraform으로 자동화하지 않는다 — apply 후 SSM Session Manager로 접속해 수동으로 1회
# 등록한다. 여기서는 Docker만 설치해둔다.
resource "aws_instance" "github_runner" {
  ami                    = data.aws_ami.amazon_linux_2023.id
  instance_type          = var.instance_type
  subnet_id              = var.private_app_subnet_ids[0]
  vpc_security_group_ids = [var.github_runner_security_group_id]
  iam_instance_profile   = var.iam_instance_profile_name

  root_block_device {
    volume_size           = var.ebs_volume_size
    volume_type           = var.ebs_volume_type
    encrypted             = true
    delete_on_termination = true

    tags = {
      Name = "team04-${var.environment}-github-runner-ebs"
    }
  }

  user_data = <<-EOF
              #!/bin/bash
              dnf update -y
              dnf install -y docker
              systemctl enable --now docker
              usermod -aG docker ec2-user
              EOF

  tags = {
    Name = "team04-${var.environment}-github-runner-ec2"
  }
}
