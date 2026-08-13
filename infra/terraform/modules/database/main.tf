# 최신 Amazon Linux 2023 AMI 조회 (ami_id가 지정되지 않은 경우 사용)
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

# MariaDB 전용 EC2 인스턴스 (Private Data Subnet 첫 번째 AZ에 생성)
resource "aws_instance" "mariadb" {
  ami                    = var.ami_id != "" ? var.ami_id : data.aws_ami.amazon_linux_2023.id
  instance_type          = var.instance_type
  subnet_id              = var.private_data_subnet_ids[0]
  vpc_security_group_ids = [var.db_security_group_id]
  iam_instance_profile   = var.iam_instance_profile_name

  # Root EBS Volume 설정 (성능/용량 세팅)
  root_block_device {
    volume_size           = var.ebs_volume_size
    volume_type           = var.ebs_volume_type
    encrypted             = true
    delete_on_termination = true

    tags = {
      Name = "team04-${var.environment}-mariadb-ebs"
    }
  }

  # 사용자 데이터: MariaDB 자동 설치 및 서비스 활성화
  user_data = <<-EOF
              #!/bin/bash
              dnf update -y
              dnf install -y mariadb105-server
              systemctl start mariadb
              systemctl enable mariadb
              EOF

  tags = {
    Name = "team04-${var.environment}-mariadb-ec2"
  }
}