# HPA가 CPU/메모리 사용률을 읽어오는 데 필요 (metrics.k8s.io API 제공).
# CloudWatch Container Insights와는 별개 — HPA 판단은 이 metrics-server를 통해서만 이뤄지고,
# Container Insights는 그 결과를 CloudWatch에서 시각화하는 용도로만 쓴다.
# AWS API를 호출하지 않는 순수 클러스터 내부 컴포넌트라 IRSA/Pod Identity가 필요 없다.

resource "helm_release" "metrics_server" {
  name       = "metrics-server"
  repository = "https://kubernetes-sigs.github.io/metrics-server/"
  chart      = "metrics-server"
  namespace  = "kube-system"
  version    = "3.13.0"

  atomic          = true
  cleanup_on_fail = true
  timeout         = 600
}