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

  # aws_eks_access_entry가 동작하려면 CONFIG_MAP이 아닌 API 모드가 필요.
  # 기존 aws-auth ConfigMap 기반 접근도 유지하기 위해 API_AND_CONFIG_MAP 사용
  # (CONFIG_MAP -> API로 한 번에 전환은 AWS에서 허용하지 않음).
  #
  # bootstrap_cluster_creator_admin_permissions를 명시적으로 true로 고정해야 함
  # (DEV-176) — access_config가 없던 최초 생성 시 AWS가 이 값을 true로 자동
  # 설정해 state에 기록해뒀는데, 여기서 값을 안 주면 Terraform이 null로 취급하고
  # 이 필드는 ForceNew라 클러스터 전체가 destroy+recreate로 잡힌다(실제로 apply
  # 중 "Cluster has nodegroups attached"로 destroy가 실패하며 발견됨).
  access_config {
    authentication_mode                         = "API_AND_CONFIG_MAP"
    bootstrap_cluster_creator_admin_permissions = true
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
# EKS Cluster OIDC Provider (IRSA)
# =========================
# DEV-170: eks-pod-identity-agent는 DaemonSet인데 Fargate는 DaemonSet을 스케줄할 수
# 없어서, Fargate pod 안에는 169.254.170.23(로컬 자격증명 엔드포인트)에 응답할 프로세스가
# 없다 — aws-load-balancer-controller(Fargate에서 실행)가 자격증명 요청에서 타임아웃 없이
# 영구 hang되는 것으로 실측 확인됨(kubectl debug + curl, CloudTrail에 AssumeRole 이벤트
# 0건). alb_controller는 Pod Identity 대신 DaemonSet에 의존하지 않는 IRSA(OIDC)로 전환.

data "tls_certificate" "eks_oidc" {
  url = aws_eks_cluster.main.identity[0].oidc[0].issuer
}

resource "aws_iam_openid_connect_provider" "eks" {
  url             = aws_eks_cluster.main.identity[0].oidc[0].issuer
  client_id_list  = ["sts.amazonaws.com"]
  thumbprint_list = [data.tls_certificate.eks_oidc.certificates[0].sha1_fingerprint]

  tags = {
    Name = "${var.project_name}-${var.environment}-eks-oidc"
  }
}

# =========================
# Chatbot Pod Identity
# =========================
# DEV-184: chatbot_service도 alb_controller와 같은 DEV-170 문제(Fargate는 DaemonSet인
# eks-pod-identity-agent를 못 띄움)를 겪어 IRSA(OIDC)로 전환했다(module.iam의
# aws_iam_role.chatbot_service 참고). 이 Pod Identity Association은 더 이상 쓰이지
# 않으므로 제거 — chatbot_role_arn/chatbot_namespace/chatbot_service_account 변수는
# gitops/langchain/base/serviceaccount-llm-service.yaml에 문서화된 llm-service용
# 향후 작업(그것도 IRSA로 해야 함, Pod Identity 아님)을 위해 그대로 남겨둔다.