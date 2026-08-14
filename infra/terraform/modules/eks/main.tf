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
# CPU Managed Node Group
# =========================

resource "aws_eks_node_group" "cpu" {
  cluster_name    = aws_eks_cluster.main.name
  node_group_name = "${var.project_name}-${var.environment}-cpu-nodes"
  node_role_arn   = var.node_role_arn
  subnet_ids      = var.subnet_ids

  instance_types = var.node_instance_types
  capacity_type  = "ON_DEMAND"

  scaling_config {
    desired_size = var.desired_size
    min_size     = var.min_size
    max_size     = var.max_size
  }

  update_config {
    max_unavailable = 1
  }

  labels = {
    workload = "backend"
  }

  tags = {
    Name        = "${var.project_name}-${var.environment}-cpu-nodes"
    Environment = var.environment
    Project     = var.project_name
  }

  depends_on = [
    aws_eks_cluster.main
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
    aws_eks_cluster.main
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
    aws_eks_node_group.cpu
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
    aws_eks_node_group.cpu
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