# =========================
# EKS Cluster
# =========================

resource "aws_eks_cluster" "main" {
  name     = "${var.project_name}-${var.environment}-eks"
  role_arn = var.cluster_role_arn
  version  = var.cluster_version

  vpc_config {
    subnet_ids = var.subnet_ids

    endpoint_private_access = true
    endpoint_public_access  = true
  }

  tags = {
    Name        = "${var.project_name}-${var.environment}-eks"
    Environment = var.environment
    Project     = var.project_name
  }
}

# =========================
# CPU Fargate Profile
# =========================
# EC2 관리형 노드 그룹 대신 Fargate로 전환 (pod 수 증가로 인한 노드 수용량 한계 대응).
# kube-system/argocd/backend 네임스페이스의 pod가 전부 여기서 스케줄됩니다.
# chat-bot-service도 backend 네임스페이스로 통합되어 별도 selector가 필요 없습니다.
#
# langchain 네임스페이스(llm-service/n8n/ollama)는 label 기반 selector로 부분적으로만
# 매칭합니다: `compute=fargate` 라벨이 붙은 pod(llm-service, n8n)만 여기서 Fargate로
# 뜨고, 그 라벨이 없는 ollama pod는 이 selector에 걸리지 않아 일반 스케줄러를 거쳐
# GPU node group(nodeSelector+taint toleration, 아래 aws_eks_node_group.gpu)으로 갑니다.
# Fargate는 GPU를 지원하지 않으므로 네임스페이스 전체를 매칭하면 ollama가 스케줄 불가능한
# 상태가 되어, 이렇게 같은 네임스페이스 안에서 label로 갈라야 합니다.

resource "aws_eks_fargate_profile" "cpu" {
  cluster_name           = aws_eks_cluster.main.name
  fargate_profile_name   = "${var.project_name}-${var.environment}-cpu-fargate"
  pod_execution_role_arn = var.fargate_pod_execution_role_arn
  subnet_ids             = var.subnet_ids

  selector {
    namespace = "kube-system"
  }
  selector {
    namespace = "argocd"
  }
  selector {
    namespace = "backend"
  }
  selector {
    namespace = var.langchain_namespace
    labels = {
      compute = "fargate"
    }
  }

  tags = {
    Name        = "${var.project_name}-${var.environment}-cpu-fargate"
    Environment = var.environment
    Project     = var.project_name
  }

  depends_on = [
    aws_eks_cluster.main,
    aws_eks_addon.vpc_cni
  ]
}
# =========================
# GPU Managed Node Group
# =========================

resource "aws_eks_node_group" "gpu" {
  cluster_name    = aws_eks_cluster.main.name
  node_group_name = "${var.project_name}-${var.environment}-gpu-nodes"
  node_role_arn   = var.node_role_arn
  subnet_ids      = var.subnet_ids

  ami_type       = "AL2023_x86_64_NVIDIA"
  instance_types = var.gpu_instance_types
  capacity_type  = "ON_DEMAND"

  # 기본값(20GB)이 langchain_rag/ollama/Dockerfile이 굽는 이미지(7B 채팅 모델 +
  # nomic-embed-text 임베딩 모델, 수 GB)를 담기엔 너무 작아서 kubelet이
  # node.kubernetes.io/disk-pressure:NoSchedule taint를 자동으로 붙이고 ollama
  # pod가 영원히 스케줄 안 되는 문제가 실제로 발생했다 (DEV-163).
  disk_size = var.gpu_disk_size

  scaling_config {
    desired_size = var.gpu_desired_size
    min_size     = var.gpu_min_size
    max_size     = var.gpu_max_size
  }

  update_config {
    max_unavailable = 1
  }

  labels = {
    workload    = "chatbot"
    accelerator = "nvidia"
  }

  taint {
    key    = "nvidia.com/gpu"
    value  = "true"
    effect = "NO_SCHEDULE"
  }

  tags = {
    Name        = "${var.project_name}-${var.environment}-gpu-nodes"
    Environment = var.environment
    Project     = var.project_name
  }

  depends_on = [
    aws_eks_cluster.main,
    aws_eks_addon.vpc_cni
  ]
}
# =========================
# EKS Add-ons
# =========================

resource "aws_eks_addon" "coredns" {
  cluster_name = aws_eks_cluster.main.name
  addon_name   = "coredns"

  resolve_conflicts_on_create = "OVERWRITE"
  resolve_conflicts_on_update = "PRESERVE"

  depends_on = [
    aws_eks_fargate_profile.cpu
  ]
}

resource "aws_eks_addon" "kube_proxy" {
  cluster_name = aws_eks_cluster.main.name
  addon_name   = "kube-proxy"

  resolve_conflicts_on_create = "OVERWRITE"
  resolve_conflicts_on_update = "PRESERVE"

  depends_on = [
    aws_eks_cluster.main
  ]
}

resource "aws_eks_addon" "pod_identity_agent" {
  cluster_name = aws_eks_cluster.main.name
  addon_name   = "eks-pod-identity-agent"

  resolve_conflicts_on_create = "OVERWRITE"
  resolve_conflicts_on_update = "PRESERVE"

  depends_on = [
    aws_eks_cluster.main
  ]
}
resource "aws_eks_addon" "vpc_cni" {
  cluster_name = aws_eks_cluster.main.name
  addon_name   = "vpc-cni"

  resolve_conflicts_on_create = "OVERWRITE"
  resolve_conflicts_on_update = "PRESERVE"

  pod_identity_association {
    role_arn        = var.vpc_cni_role_arn
    service_account = "aws-node"
  }

  depends_on = [
    aws_eks_addon.pod_identity_agent
  ]
}
# =========================
# AWS Load Balancer Controller Pod Identity
# =========================

resource "aws_eks_pod_identity_association" "alb_controller" {
  cluster_name    = aws_eks_cluster.main.name
  namespace       = "kube-system"
  service_account = "aws-load-balancer-controller"
  role_arn        = var.alb_controller_role_arn

  depends_on = [
    aws_eks_addon.pod_identity_agent
  ]
} # =========================
# AWS Load Balancer Controller Pod Identity
# =========================

# =========================
# Chatbot Pod Identity
# =========================

resource "aws_eks_pod_identity_association" "chatbot" {
  cluster_name    = aws_eks_cluster.main.name
  namespace       = var.chatbot_namespace
  service_account = var.chatbot_service_account
  role_arn        = var.chatbot_role_arn

  depends_on = [
    aws_eks_addon.pod_identity_agent
  ]
}