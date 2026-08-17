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

resource "aws_iam_role" "alb_controller" {
  name = "${var.project_name}-alb-controller-role"

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
# Chatbot Service Role
# =========================

resource "aws_iam_role" "chatbot_service" {
  name = "${var.project_name}-chatbot-service-role"

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