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
# kube-system/argocd 네임스페이스의 pod는 전부 여기서 스케줄됩니다.
#
# backend/langchain 네임스페이스는 둘 다 label 기반 selector로 부분적으로만 매칭합니다:
# `compute=fargate` 라벨이 붙은 pod만 여기서 Fargate로 뜨고, 그 라벨이 없는 pod는 이
# selector에 안 걸려 일반 스케줄러를 거쳐 다른 노드그룹으로 갑니다.
# - backend: chat-bot-service를 포함한 7개 서비스는 이 라벨이 있어 Fargate로 뜨고,
#   api-gateway는 DEV-196에서 이 라벨을 빼고 aws_eks_node_group.api_cpu로 이전했습니다
#   (n8n 이미지 pull 속도/CloudWatch 지표 문제 — 그 노드그룹 리소스의 주석 참고).
# - langchain: llm-service/n8n 중 n8n도 DEV-196에서 같은 이유로 이 라벨을 빼고
#   aws_eks_node_group.api_cpu로 이전했습니다. llm-service는 그대로 Fargate. ollama는
#   원래부터 이 라벨이 없어 GPU node group(nodeSelector+taint toleration, 아래
#   aws_eks_node_group.gpu)으로 갑니다. Fargate는 GPU를 지원하지 않으므로 네임스페이스
#   전체를 매칭하면 ollama가 스케줄 불가능한 상태가 되어, label로 갈라야 합니다.

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
    # DEV-196: api-gateway를 aws_eks_node_group.api_cpu로 이전하며 backend selector도
    # langchain과 같은 라벨 게이트 방식으로 전환 — 이 라벨이 없으면 Fargate로 안 간다.
    # api-gateway를 제외한 나머지 7개 backend 서비스는 지금 배치를 유지하기 위해
    # gitops에서 이 라벨을 새로 붙여야 한다.
    namespace = "backend"
    labels = {
      compute = "fargate"
    }
  }
  selector {
    namespace = var.langchain_namespace
    labels = {
      compute = "fargate"
    }
  }
  selector {
    # DEV-177: amazon-cloudwatch-observability addon(Container Insights)이 이 네임스페이스에
    # 배포됨. 우리 클러스터엔 태인트 없는 일반 EC2 노드가 없어(GPU 노드 그룹은
    # nvidia.com/gpu:NoSchedule 태인트만 감내), Fargate profile에 포함시키지 않으면 파드가
    # 영원히 Pending 상태로 남는다.
    namespace = "amazon-cloudwatch"
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
# API CPU Managed Node Group
# =========================
# DEV-196: api-gateway/n8n을 Fargate에서 이전 — (1) n8n 이미지(~365MB) pull이 Fargate의
# pod마다 새 micro-VM이라는 구조(레이어 캐시 미공유) 때문에 매번 6~8분+ 걸리거나 실패함
# (registry를 ECR로 미러링해도 재현 — Fargate 구조 자체의 문제로 실측 확인), (2)
# api-gateway의 CPU%/메모리% CloudWatch 대시보드가 비어있는데, cloudwatch-agent
# DaemonSet이 GPU 노드에서 불안정(3.5시간 11번 재시작 + 컨테이너 안에서만 DNS/STS 호출이
# operation not permitted로 실패, 근본 원인 미해결)해서 그런 것으로 보여 이 GPU 노드
# 특유의 문제를 우회하려는 목적. GPU만큼 특수하지 않지만(NVIDIA AMI 아님), 의도한 pod만
# 오도록 GPU 노드그룹과 동일하게 taint를 둔다.

resource "aws_eks_node_group" "api_cpu" {
  cluster_name    = aws_eks_cluster.main.name
  node_group_name = "${var.project_name}-${var.environment}-api-cpu-nodes"
  node_role_arn   = var.node_role_arn
  subnet_ids      = var.subnet_ids

  ami_type       = "AL2023_x86_64_STANDARD"
  instance_types = var.api_cpu_instance_types
  capacity_type  = "ON_DEMAND"

  scaling_config {
    desired_size = var.api_cpu_desired_size
    min_size     = var.api_cpu_min_size
    max_size     = var.api_cpu_max_size
  }

  update_config {
    max_unavailable = 1
  }

  labels = {
    workload = "api-cpu"
  }

  taint {
    key    = "dedicated"
    value  = "api-cpu"
    effect = "NO_SCHEDULE"
  }

  tags = {
    Name        = "${var.project_name}-${var.environment}-api-cpu-nodes"
    Environment = var.environment
    Project     = var.project_name
    # DEV-196: Cluster Autoscaler(infra/terraform/environments/dev/addons/
    # cluster-autoscaler.tf)의 auto-discovery 대상 — 이 태그가 붙은 ASG만 관리한다.
    # gpu 노드그룹은 의도적으로 이 태그를 안 붙여서 기존처럼 수동 스케일(gpu_desired_size)로
    # 유지한다.
    "k8s.io/cluster-autoscaler/enabled"                                    = "true"
    "k8s.io/cluster-autoscaler/${var.project_name}-${var.environment}-eks" = "owned"
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

# DEV-177: Container Insights. Fargate 파드(api-gateway 등 대부분의 워크로드)에서 지표를
# 걷어오려면 이 addon이 쓰는 ServiceAccount가 IRSA로 자격증명을 받아야 한다
# (eks-pod-identity-agent는 DaemonSet이라 Fargate에서 못 뜬다 — DEV-170에서 alb_controller로
# 실측 확인된 것과 동일한 제약). service_account_role_arn을 지정하면 addon이 자기 기본
# ServiceAccount에 자동으로 IRSA annotation을 달아준다.
resource "aws_eks_addon" "cloudwatch_observability" {
  cluster_name = aws_eks_cluster.main.name
  addon_name   = "amazon-cloudwatch-observability"

  resolve_conflicts_on_create = "OVERWRITE"
  resolve_conflicts_on_update = "PRESERVE"

  service_account_role_arn = var.cloudwatch_observability_role_arn

  depends_on = [
    aws_eks_fargate_profile.cpu
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