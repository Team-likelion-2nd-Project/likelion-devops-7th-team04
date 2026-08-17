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

  # 사용자 데이터: MariaDB 자동 설치 + 최초 부팅 시 1회 root 비밀번호/DB 초기화.
  # 영구 볼륨이 없어 인스턴스가 재생성될 때마다 처음부터 다시 실행되므로, 매번 수동으로
  # SSM 접속해 설정할 필요가 없도록 자동화합니다.
  user_data = <<-EOF
              #!/bin/bash
              dnf update -y
              dnf install -y mariadb105-server

              # VPC 내부(EKS pod)에서 접속 가능하도록 (기본은 localhost만 허용)
              sed -i 's/^bind-address.*/bind-address = 0.0.0.0/' /etc/my.cnf.d/mariadb-server.cnf

              systemctl start mariadb
              systemctl enable mariadb

              mysql -u root <<SQL
              ALTER USER 'root'@'localhost' IDENTIFIED BY '${var.db_root_password}';
              CREATE USER IF NOT EXISTS 'root'@'%' IDENTIFIED BY '${var.db_root_password}';
              GRANT ALL PRIVILEGES ON *.* TO 'root'@'%' WITH GRANT OPTION;
              CREATE DATABASE IF NOT EXISTS ${var.db_database_name};
              FLUSH PRIVILEGES;
              SQL
              EOF

  tags = {
    Name = "team04-${var.environment}-mariadb-ec2"
  }
}