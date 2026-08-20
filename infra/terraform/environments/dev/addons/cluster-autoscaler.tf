# DEV-196: api_cpu 노드그룹(../main.tf의 module.eks -> aws_eks_node_group.api_cpu)만
# 관리 대상 — ASG auto-discovery 태그(k8s.io/cluster-autoscaler/enabled 등)를 그
# 노드그룹에만 붙여뒀으므로, gpu 노드그룹(의도적으로 수동 스케일 유지)은 이 태그가 없어
# Cluster Autoscaler가 건드리지 않는다.
resource "helm_release" "cluster_autoscaler" {
  name       = "cluster-autoscaler"
  repository = "https://kubernetes.github.io/autoscaler"
  chart      = "cluster-autoscaler"
  namespace  = "kube-system"
  version    = "9.46.6"

  atomic          = true
  cleanup_on_fail = true
  timeout         = 600

  set = [
    {
      name  = "autoDiscovery.clusterName"
      value = var.cluster_name
    },
    {
      name  = "awsRegion"
      value = var.aws_region
    },
    {
      name  = "rbac.serviceAccount.create"
      value = "true"
    },
    {
      name  = "rbac.serviceAccount.name"
      value = "cluster-autoscaler"
    },
    {
      # DEV-196: alb_controller와 동일한 이유로 Pod Identity 대신 IRSA
      # (Fargate의 kube-system에서 뜨므로 eks-pod-identity-agent DaemonSet을 못 씀)
      name  = "rbac.serviceAccount.annotations.eks\\.amazonaws\\.com/role-arn"
      value = var.cluster_autoscaler_role_arn
    },
    {
      # kube-system은 (compute=fargate 라벨 없이도) 무조건 Fargate로 뜨므로
      # 여기서도 Fargate에서 도는 게 정상 — Cluster Autoscaler 자신은 관리 대상
      # 노드그룹에 얹혀 있을 필요가 없다.
      name  = "extraArgs.balance-similar-node-groups"
      value = "true"
    },
    {
      # api_cpu 노드그룹만 auto-discovery 태그를 붙였으므로 실질적으로는 항상 false지만,
      # 명시적으로 꺼서 kube-system/amazon-cloudwatch 같은 시스템 pod가 있는 노드를
      # scale-down 대상으로 잘못 고려하지 않도록 방어.
      name  = "extraArgs.skip-nodes-with-system-pods"
      value = "false"
    }
  ]
}
