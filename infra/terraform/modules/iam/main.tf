# =========================
# EKS Cluster Role
# =========================

resource "aws_iam_role" "eks_cluster" {
  name = "${var.project_name}-eks-cluster-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"

    Statement = [
      {
        Effect = "Allow"

        Principal = {
          Service = "eks.amazonaws.com"
        }

        Action = "sts:AssumeRole"
      }
    ]
  })

  tags = {
    Name = "${var.project_name}-eks-cluster-role"
  }
}

resource "aws_iam_role_policy_attachment" "eks_cluster_policy" {
  role       = aws_iam_role.eks_cluster.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonEKSClusterPolicy"
}


# =========================
# EKS Node Role
# =========================

resource "aws_iam_role" "eks_node" {
  name = "${var.project_name}-eks-node-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"

    Statement = [
      {
        Effect = "Allow"

        Principal = {
          Service = "ec2.amazonaws.com"
        }

        Action = "sts:AssumeRole"
      }
    ]
  })

  tags = {
    Name = "${var.project_name}-eks-node-role"
  }
}

resource "aws_iam_role_policy_attachment" "eks_node_worker_policy" {
  role       = aws_iam_role.eks_node.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonEKSWorkerNodePolicy"
}

resource "aws_iam_role_policy_attachment" "eks_node_ecr_policy" {
  role       = aws_iam_role.eks_node.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonEC2ContainerRegistryPullOnly"
}

resource "aws_iam_role_policy_attachment" "eks_node_cloudwatch_policy" {
  role       = aws_iam_role.eks_node.name
  policy_arn = "arn:aws:iam::aws:policy/CloudWatchAgentServerPolicy"
}


# =========================
# CloudWatch Agent Role
# =========================

resource "aws_iam_role" "cloudwatch_agent" {
  name = "${var.project_name}-cloudwatch-agent-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"

    Statement = [
      {
        Effect = "Allow"

        Principal = {
          Service = "ec2.amazonaws.com"
        }

        Action = "sts:AssumeRole"
      }
    ]
  })

  tags = {
    Name = "${var.project_name}-cloudwatch-agent-role"
  }
}

resource "aws_iam_role_policy_attachment" "cloudwatch_agent_policy" {
  role       = aws_iam_role.cloudwatch_agent.name
  policy_arn = "arn:aws:iam::aws:policy/CloudWatchAgentServerPolicy"
}

resource "aws_iam_role_policy_attachment" "cloudwatch_agent_ssm_policy" {
  role       = aws_iam_role.cloudwatch_agent.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
}

resource "aws_iam_instance_profile" "cloudwatch_agent" {
  name = "${var.project_name}-cloudwatch-agent-profile"
  role = aws_iam_role.cloudwatch_agent.name
}

# DEV-102: mariadb EC2가 cloudwatch_agent instance profile을 그대로 쓰고 있어(위 profile),
# user_data가 부팅 시 시딩 번들을 받아올 수 있도록 이 role에 S3 read 권한을 최소 범위로 추가.
resource "aws_iam_policy" "db_seed_s3_read" {
  name        = "${var.project_name}-db-seed-s3-read-policy"
  description = "Read-only access to the DB seed bundle for the MariaDB EC2 instance"

  policy = jsonencode({
    Version = "2012-10-17"

    Statement = [
      {
        Effect   = "Allow"
        Action   = ["s3:GetObject"]
        Resource = "${var.db_seed_bucket_arn}/seed/*"
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "db_seed_s3_read" {
  role       = aws_iam_role.cloudwatch_agent.name
  policy_arn = aws_iam_policy.db_seed_s3_read.arn
}


# =========================
# EKS Fargate Pod Execution Role
# =========================

resource "aws_iam_role" "fargate_pod_execution" {
  name = "${var.project_name}-fargate-pod-execution-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"

    Statement = [
      {
        Effect = "Allow"

        Principal = {
          Service = "eks-fargate-pods.amazonaws.com"
        }

        Action = "sts:AssumeRole"
      }
    ]
  })

  tags = {
    Name = "${var.project_name}-fargate-pod-execution-role"
  }
}

resource "aws_iam_role_policy_attachment" "fargate_pod_execution" {
  role       = aws_iam_role.fargate_pod_execution.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonEKSFargatePodExecutionRolePolicy"
}


# =========================
# AWS Load Balancer Controller Role
# =========================
# DEV-170: Fargate는 DaemonSet(eks-pod-identity-agent)을 스케줄할 수 없어 Pod Identity로는
# 이 role의 자격증명을 Fargate pod가 받을 수 없었다(실측: kubectl debug + curl로 로컬
# 자격증명 엔드포인트 타임아웃 확인, CloudTrail에 AssumeRole 이벤트 0건). DaemonSet에
# 의존하지 않는 IRSA(OIDC federated)로 전환.

resource "aws_iam_role" "alb_controller" {
  name = "${var.project_name}-alb-controller-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"

    Statement = [
      {
        Effect = "Allow"

        Principal = {
          Federated = var.eks_oidc_provider_arn
        }

        Action = "sts:AssumeRoleWithWebIdentity"

        Condition = {
          StringEquals = {
            "${var.eks_oidc_provider_url}:aud" = "sts.amazonaws.com"
            "${var.eks_oidc_provider_url}:sub" = "system:serviceaccount:kube-system:aws-load-balancer-controller"
          }
        }
      }
    ]
  })

  tags = {
    Name = "${var.project_name}-alb-controller-role"
  }
}

resource "aws_iam_policy" "alb_controller" {
  name        = "${var.project_name}-alb-controller-policy"
  description = "IAM policy for AWS Load Balancer Controller"

  policy = file("${path.module}/alb_controller_policy.json")
}

resource "aws_iam_role_policy_attachment" "alb_controller" {
  role       = aws_iam_role.alb_controller.name
  policy_arn = aws_iam_policy.alb_controller.arn
}

# =========================
# CloudWatch Observability (Container Insights) Role
# =========================
# DEV-177: alb_controller와 동일한 이유(Fargate는 eks-pod-identity-agent DaemonSet을 못
# 띄워 Pod Identity 자격증명을 못 받음)로 Pod Identity 대신 IRSA 사용. sub 조건의
# ServiceAccount 이름(amazon-cloudwatch/cloudwatch-agent)은 addon 기본값 기준 — 실제
# 적용 후 `kubectl get sa -n amazon-cloudwatch`로 확인 필요.

resource "aws_iam_role" "cloudwatch_observability" {
  name = "${var.project_name}-cloudwatch-observability-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"

    Statement = [
      {
        Effect = "Allow"

        Principal = {
          Federated = var.eks_oidc_provider_arn
        }

        Action = "sts:AssumeRoleWithWebIdentity"

        Condition = {
          StringEquals = {
            "${var.eks_oidc_provider_url}:aud" = "sts.amazonaws.com"
            "${var.eks_oidc_provider_url}:sub" = "system:serviceaccount:amazon-cloudwatch:cloudwatch-agent"
          }
        }
      }
    ]
  })

  tags = {
    Name = "${var.project_name}-cloudwatch-observability-role"
  }
}

resource "aws_iam_role_policy_attachment" "cloudwatch_observability" {
  role       = aws_iam_role.cloudwatch_observability.name
  policy_arn = "arn:aws:iam::aws:policy/CloudWatchAgentServerPolicy"
}


# =========================
# Chatbot Service Role
# =========================
# DEV-184: chatbot_service도 alb_controller와 동일한 DEV-170 문제를 겪었다 —
# chat-bot-service는 backend 네임스페이스 전체와 함께 Fargate에서 도는데(Fargate는
# DaemonSet을 못 띄우므로 eks-pod-identity-agent가 응답할 수 없음), Pod Identity로
# 자격증명을 받으려다 DynamoDB 호출이 CredentialsProviderError로 매번 실패해 챗봇이
# 503을 반환했다(실측: kubectl logs). alb_controller와 동일하게 DaemonSet에 의존하지
# 않는 IRSA(OIDC federated)로 전환.

resource "aws_iam_role" "chatbot_service" {
  name = "${var.project_name}-chatbot-service-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"

    Statement = [
      {
        Effect = "Allow"

        Principal = {
          Federated = var.eks_oidc_provider_arn
        }

        Action = "sts:AssumeRoleWithWebIdentity"

        Condition = {
          StringEquals = {
            "${var.eks_oidc_provider_url}:aud" = "sts.amazonaws.com"
            "${var.eks_oidc_provider_url}:sub" = "system:serviceaccount:backend:chatbot-service"
          }
        }
      }
    ]
  })

  tags = {
    Name = "${var.project_name}-chatbot-service-role"
  }
}



# =========================
# Chatbot S3 Vectors Policy
# =========================

resource "aws_iam_policy" "chatbot_s3_vectors" {
  name        = "${var.project_name}-chatbot-s3-vectors-policy"
  description = "S3 Vectors read permissions for chatbot service"

  policy = jsonencode({
    Version = "2012-10-17"

    Statement = [
      {
        Effect = "Allow"

        Action = [
          "s3vectors:GetVectors",
          "s3vectors:QueryVectors"
        ]

        Resource = var.vector_index_arn
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "chatbot_s3_vectors" {
  role       = aws_iam_role.chatbot_service.name
  policy_arn = aws_iam_policy.chatbot_s3_vectors.arn
}

# =========================
# Chatbot DynamoDB Policy
# =========================
# DEV-186: chatbot_service role에 DynamoDB 권한이 애초에 없었다 — S3 Vectors 정책만
# 붙어 있어서, Fargate/Pod Identity 문제(DEV-184, IRSA로 전환)를 해결해도
# SessionService/MessageService(ChatSessions/ChatMessages에 PutItem·Query만 사용,
# apps/chat-bot-service/src/session/session.service.ts, message.service.ts 참고)가
# AccessDeniedException으로 막혀 로그인 사용자 챗봇 호출이 계속 503이었다. 실제 사용
# 커맨드에 맞춰 최소 권한만 부여. 테이블 자체는 DEV-187에서 infra/terraform/modules/dynamodb로
# 프로비저닝하지만, 그 모듈은 형제 모듈이라 output을 여기서 직접 참조할 수 없어(둘 다
# environments/dev/main.tf에서만 조립됨) 이 모듈 안에서 계정ID/리전을 조회해 ARN을 조립한다.
# DEV-187: 리전은 원래 ap-northeast-2로 하드코딩했었으나, 이 프로젝트의 다른 인프라
# (EKS/ECR/VPC)가 전부 있는 root module의 기본 provider 리전(us-east-1)으로 테이블도
# 통일하기로 하여 data.aws_region.current로 그 리전을 그대로 따라가게 바꿨다 —
# gitops/backend/base/chat-bot-service/deployment.yaml의 DYNAMODB_REGION도 같이
# us-east-1로 맞춰야 한다(별도 GitOps PR).

data "aws_caller_identity" "current" {}
data "aws_region" "current" {}

locals {
  chatbot_dynamodb_region = data.aws_region.current.name
}

resource "aws_iam_policy" "chatbot_dynamodb" {
  name        = "${var.project_name}-chatbot-dynamodb-policy"
  description = "DynamoDB read/write permissions for chatbot service (ChatSessions/ChatMessages)"

  policy = jsonencode({
    Version = "2012-10-17"

    Statement = [
      {
        Effect = "Allow"

        Action = [
          "dynamodb:PutItem",
          "dynamodb:Query"
        ]

        Resource = [
          "arn:aws:dynamodb:${local.chatbot_dynamodb_region}:${data.aws_caller_identity.current.account_id}:table/${var.chat_sessions_table_name}",
          "arn:aws:dynamodb:${local.chatbot_dynamodb_region}:${data.aws_caller_identity.current.account_id}:table/${var.chat_sessions_table_name}/index/userId-index",
          "arn:aws:dynamodb:${local.chatbot_dynamodb_region}:${data.aws_caller_identity.current.account_id}:table/${var.chat_messages_table_name}"
        ]
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "chatbot_dynamodb" {
  role       = aws_iam_role.chatbot_service.name
  policy_arn = aws_iam_policy.chatbot_dynamodb.arn
}

# =========================
# GitHub Actions OIDC
# =========================

data "aws_iam_openid_connect_provider" "github" {
  url = "https://token.actions.githubusercontent.com"
}


# =========================
# CI/CD Role
# =========================

resource "aws_iam_role" "cicd" {
  name = "${var.project_name}-cicd-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"

    Statement = [
      {
        Effect = "Allow"

        Principal = {
          Federated = data.aws_iam_openid_connect_provider.github.arn
        }

        Action = "sts:AssumeRoleWithWebIdentity"

        Condition = {
          StringEquals = {
            "token.actions.githubusercontent.com:aud" = "sts.amazonaws.com"
            "token.actions.githubusercontent.com:sub" = "repo:${var.github_org}/${var.github_repo}:ref:refs/heads/${var.github_branch}"
          }
        }
      }
    ]
  })

  tags = {
    Name = "${var.project_name}-cicd-role"
  }
}


# =========================
# CI/CD Permission Policy
# =========================

resource "aws_iam_policy" "cicd" {
  name        = "${var.project_name}-cicd-policy"
  description = "IAM policy for frontend deployment via GitHub Actions"

  policy = jsonencode({
    Version = "2012-10-17"

    Statement = [
      {
        Effect = "Allow"

        Action = [
          "s3:ListBucket"
        ]

        Resource = var.frontend_bucket_arn
      },
      {
        Effect = "Allow"

        Action = [
          "s3:PutObject",
          "s3:DeleteObject"
        ]

        Resource = "${var.frontend_bucket_arn}/*"
      },
      {
        Effect = "Allow"

        Action = [
          "cloudfront:CreateInvalidation"
        ]

        Resource = var.cloudfront_distribution_arn
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "cicd_policy" {
  role       = aws_iam_role.cicd.name
  policy_arn = aws_iam_policy.cicd.arn
}
# =========================
# Backend CD Role
# =========================

resource "aws_iam_role" "backend_cd" {
  name = "${var.project_name}-backend-cd-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"

    Statement = [
      {
        Effect = "Allow"

        Principal = {
          Federated = data.aws_iam_openid_connect_provider.github.arn
        }

        Action = "sts:AssumeRoleWithWebIdentity"

        Condition = {
          StringEquals = {
            "token.actions.githubusercontent.com:aud" = "sts.amazonaws.com"
            "token.actions.githubusercontent.com:sub" = "repo:${var.github_org}/${var.github_repo}:ref:refs/heads/${var.backend_github_branch}"
          }
        }
      }
    ]
  })

  tags = {
    Name = "${var.project_name}-backend-cd-role"
  }
}

# =========================
# Backend CD ECR Push Policy
# =========================

resource "aws_iam_policy" "backend_cd_ecr" {
  name        = "${var.project_name}-backend-cd-ecr-policy"
  description = "ECR push permissions for Backend CD via GitHub Actions"

  policy = jsonencode({
    Version = "2012-10-17"

    Statement = [
      {
        Effect = "Allow"

        Action = [
          "ecr:GetAuthorizationToken"
        ]

        Resource = "*"
      },
      {
        Effect = "Allow"

        Action = [
          "ecr:BatchCheckLayerAvailability",
          "ecr:BatchGetImage",
          "ecr:InitiateLayerUpload",
          "ecr:UploadLayerPart",
          "ecr:CompleteLayerUpload",
          "ecr:PutImage"
        ]

        Resource = values(var.backend_ecr_repository_arns)
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "backend_cd_ecr" {
  role       = aws_iam_role.backend_cd.name
  policy_arn = aws_iam_policy.backend_cd_ecr.arn
}

# =========================
# GitHub Runner Role (self-hosted EC2)
# =========================
# 계정 SCP가 OIDC(sts:AssumeRoleWithWebIdentity)를 막고 있어, GitHub-hosted runner +
# backend_cd(OIDC) role 조합을 쓸 수 없다. 대신 EC2 Instance Profile로 동일한 ECR push
# 권한(backend_cd_ecr 정책 재사용)을 self-hosted runner에 직접 부여한다.

resource "aws_iam_role" "github_runner" {
  name = "${var.project_name}-github-runner-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"

    Statement = [
      {
        Effect = "Allow"

        Principal = {
          Service = "ec2.amazonaws.com"
        }

        Action = "sts:AssumeRole"
      }
    ]
  })

  tags = {
    Name = "${var.project_name}-github-runner-role"
  }
}

# SSH 없이 SSM Session Manager로 접속하기 위함 (cloudwatch_agent role과 동일한 패턴)
resource "aws_iam_role_policy_attachment" "github_runner_ssm" {
  role       = aws_iam_role.github_runner.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
}

# backend_cd_ecr 정책을 그대로 재사용 (동일한 ECR push 권한이 필요하므로 정책 중복 생성 안 함)
resource "aws_iam_role_policy_attachment" "github_runner_ecr" {
  role       = aws_iam_role.github_runner.name
  policy_arn = aws_iam_policy.backend_cd_ecr.arn
}

# cicd 정책(S3 배포 + CloudFront 무효화)을 그대로 재사용 (프론트엔드 배포도 같은
# self-hosted runner에서 수행하므로 정책 중복 생성 안 함)
resource "aws_iam_role_policy_attachment" "github_runner_frontend_deploy" {
  role       = aws_iam_role.github_runner.name
  policy_arn = aws_iam_policy.cicd.arn
}

resource "aws_iam_instance_profile" "github_runner" {
  name = "${var.project_name}-github-runner-profile"
  role = aws_iam_role.github_runner.name
}

# =========================
# VPC CNI Role
# =========================

resource "aws_iam_role" "vpc_cni" {
  name = "${var.project_name}-vpc-cni-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"

    Statement = [
      {
        Effect = "Allow"

        Principal = {
          Service = "pods.eks.amazonaws.com"
        }

        Action = [
          "sts:AssumeRole",
          "sts:TagSession"
        ]
      }
    ]
  })

  tags = {
    Name = "${var.project_name}-vpc-cni-role"
  }
}

resource "aws_iam_role_policy_attachment" "vpc_cni" {
  role       = aws_iam_role.vpc_cni.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonEKS_CNI_Policy"
}

# =========================
# Cluster Autoscaler Role
# =========================
# DEV-196: aws_eks_node_group.api_cpu(infra/terraform/modules/eks/main.tf)에 HPA
# (gitops/backend/base/api-gateway/hpa.yaml, minReplicas 2/maxReplicas 10)가 늘리는
# pod를 받을 노드가 자동으로 안 늘어나는 문제 — 이 role은 helm_release로 설치되는
# Cluster Autoscaler(infra/terraform/environments/dev/addons/cluster-autoscaler.tf)가
# 쓴다. alb_controller/cloudwatch_observability와 동일한 이유로 Pod Identity 대신
# IRSA 사용(Fargate의 kube-system에서 뜨므로 eks-pod-identity-agent DaemonSet을 못 씀).
# 정책은 AWS 공식 Cluster Autoscaler 문서 기준 최소 권한.

resource "aws_iam_role" "cluster_autoscaler" {
  name = "${var.project_name}-cluster-autoscaler-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"

    Statement = [
      {
        Effect = "Allow"

        Principal = {
          Federated = var.eks_oidc_provider_arn
        }

        Action = "sts:AssumeRoleWithWebIdentity"

        Condition = {
          StringEquals = {
            "${var.eks_oidc_provider_url}:aud" = "sts.amazonaws.com"
            "${var.eks_oidc_provider_url}:sub" = "system:serviceaccount:kube-system:cluster-autoscaler"
          }
        }
      }
    ]
  })

  tags = {
    Name = "${var.project_name}-cluster-autoscaler-role"
  }
}

resource "aws_iam_policy" "cluster_autoscaler" {
  name        = "${var.project_name}-cluster-autoscaler-policy"
  description = "IAM policy for Kubernetes Cluster Autoscaler (api_cpu node group only, via ASG auto-discovery tags)"

  policy = jsonencode({
    Version = "2012-10-17"

    Statement = [
      {
        Effect = "Allow"

        Action = [
          "autoscaling:DescribeAutoScalingGroups",
          "autoscaling:DescribeAutoScalingInstances",
          "autoscaling:DescribeLaunchConfigurations",
          "autoscaling:DescribeTags",
          "autoscaling:DescribeScalingActivities",
          "ec2:DescribeInstanceTypes",
          "ec2:DescribeLaunchTemplateVersions"
        ]

        Resource = "*"
      },
      {
        Effect = "Allow"

        Action = [
          "autoscaling:SetDesiredCapacity",
          "autoscaling:TerminateInstanceInAutoScalingGroup"
        ]

        Resource = "*"

        # DEV-196: gpu 노드그룹은 auto-discovery 태그를 안 붙였으니 여기 안 걸림 —
        # 그래도 태그 기반으로 명시적으로 한 번 더 좁혀서, 실수로 다른 ASG에
        # scale-in/out을 걸지 않도록 방어한다.
        Condition = {
          StringEquals = {
            "aws:ResourceTag/k8s.io/cluster-autoscaler/enabled" = "true"
          }
        }
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "cluster_autoscaler" {
  role       = aws_iam_role.cluster_autoscaler.name
  policy_arn = aws_iam_policy.cluster_autoscaler.arn
}