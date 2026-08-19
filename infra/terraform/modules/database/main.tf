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

  # user_data가 바뀌면 인스턴스를 재생성해 cloud-init이 다시 실행되도록 강제합니다.
  # 기본값(false)이면 in-place로 user_data 속성만 갱신되고 cloud-init은 최초 부팅 때
  # 한 번만 실행되므로, 이후 user_data 변경(예: 비밀번호 로직 수정)이 실제로 반영되지 않습니다.
  user_data_replace_on_change = true

  # DEV-102: AMI가 최신으로 바뀔 때마다(most_recent 조회) 매 plan에서 replace가 뜨는 걸
  # 방지. mariadb는 영구 볼륨이 없어 replace = 데이터 유실이라 실수로 발생하면 안 됨.
  # 의도적으로 AMI를 올리고 싶을 때는 `terraform taint`로 명시적으로 재생성할 것.
  lifecycle {
    ignore_changes = [ami]
  }

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
  #
  # DEV-183: mariadb105-server의 서버 기본 charset이 latin1(latin1_swedish_ci)이라, DB/테이블을
  # charset 지정 없이 만들면 한글 같은 멀티바이트 문자를 저장할 때
  # "Incorrect string value" 에러가 남(회원가입 등에서 실제로 재현됨). character-set-server를
  # utf8mb4로 서버 기본값 자체를 바꾸고, CREATE DATABASE에도 명시적으로 utf8mb4를 지정한다.
  user_data = <<-EOF
              #!/bin/bash
              # DEV-102: 중간에 어떤 단계든 실패하면 즉시 중단 — 예를 들어 시딩 번들을
              # S3에서 못 받아오는데도 조용히 넘어가 mariadb만 정상으로 뜨고 admin 계정은
              # 안 생기는 상황을 방지한다(과거엔 set -e가 없어 이게 실제로 조용히
              # 발생했었음). 정상 경로에서는 null_resource.seed_bundle이 먼저 번들을
              # 올려두는 걸 Terraform이 보장하므로, 이 set -e는 그 보장이 어떤 이유로든
              # 깨졌을 때(IAM/네트워크 문제 등)를 위한 이중 안전장치다.
              set -e
              dnf update -y
              dnf install -y mariadb105-server

              # VPC 내부(EKS pod)에서 접속 가능하도록 (기본은 localhost만 허용)
              sed -i 's/^bind-address.*/bind-address = 0.0.0.0/' /etc/my.cnf.d/mariadb-server.cnf

              # 서버 기본 charset을 utf8mb4로 (기본값 latin1은 한글 등 멀티바이트 문자 저장 불가)
              sed -i '/^\[mysqld\]/a character-set-server = utf8mb4\ncollation-server = utf8mb4_unicode_ci' /etc/my.cnf.d/mariadb-server.cnf

              systemctl start mariadb
              systemctl enable mariadb

              mysql -u root <<SQL
              ALTER USER 'root'@'localhost' IDENTIFIED BY '${var.db_root_password}';
              CREATE USER IF NOT EXISTS 'root'@'%' IDENTIFIED BY '${var.db_root_password}';
              GRANT ALL PRIVILEGES ON *.* TO 'root'@'%' WITH GRANT OPTION;
              CREATE DATABASE IF NOT EXISTS ${var.db_database_name} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
              FLUSH PRIVILEGES;
              SQL

              # DEV-102: 로컬 docker-compose의 db-seed와 동일한 backend/scripts/seed.ts를
              # 그대로 실행해 admin 계정 + 샘플 호텔/객실 데이터를 심는다. seed.ts 자체가
              # TypeORM synchronize:true로 필요한 테이블을 스스로 만들기 때문에, EKS의
              # 실제 NestJS 서비스가 먼저 떠 있을 필요가 없다(로컬 db-seed도 mariadb만
              # healthy하면 바로 실행되는 것과 동일). 이 서브넷은 인터넷/NAT 라우트가 없어
              # S3 Gateway Endpoint로만 산출물을 받을 수 있으므로, backend/scripts/
              # build-seed-bundle.sh로 미리 빌드해 올려둔 번들을 그대로 받아서 실행한다.
              # seed.ts는 idempotent라 매 부팅(replace)마다 재실행돼도 안전 — 이미 있으면
              # 스킵 로그만 남는다.
              dnf install -y nodejs20
              aws s3 cp ${var.seed_bundle_s3_uri} /tmp/seed-bundle.tar.gz
              mkdir -p /opt/db-seed
              tar xzf /tmp/seed-bundle.tar.gz -C /opt/db-seed
              cd /opt/db-seed
              DB_HOST=127.0.0.1 \
              DB_PORT=3306 \
              DB_USERNAME=root \
              DB_PASSWORD='${var.db_root_password}' \
              DB_DATABASE='${var.db_database_name}' \
              SEED_ADMIN_EMAIL='${var.seed_admin_email}' \
              SEED_ADMIN_PASSWORD='${var.seed_admin_password}' \
              SEED_ADMIN_NAME='${var.seed_admin_name}' \
              npx ts-node --transpile-only -r tsconfig-paths/register scripts/seed.ts

              # DEV-102: seed-bundle-hash: ${var.seed_bundle_hash}
              # (위 해시가 바뀌면 이 user_data 문자열 자체가 바뀌어 user_data_replace_on_change가
              # replace를 트리거한다 — 실행되는 명령은 아니고, 변경 감지 전용 주석.)
              EOF

  tags = {
    Name = "team04-${var.environment}-mariadb-ec2"
  }
}