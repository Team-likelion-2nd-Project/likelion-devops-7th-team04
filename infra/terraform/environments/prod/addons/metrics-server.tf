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

  # DEV-199: kubelet 서빙 인증서가 실제 노드 IP가 아닌 127.0.0.1용으로 발급돼 있어
  # (EKS의 잘 알려진 제약) 기본 설정으로는 metrics-server가 노드들을 스크레이핑하지 못해
  # metrics.k8s.io API가 계속 Unavailable했다 → --kubelet-insecure-tls로 우회. dev와 동일.
  #
  # 추가로 kube-system은 무조건 Fargate로 뜨는데(위 selector), EKS Fargate는 포트 10250을
  # kubelet 전용으로 예약해둬서 metrics-server가 그 포트로 자기 자신의 API 서버를 띄우면
  # 자기 자신을 스크레이핑할 때(node status에 기록된 kubelet 포트 = 10250) 충돌해
  # 403/FailedDiscoveryCheck가 난다 — 잘 알려진 EKS Fargate 제약이며, Amazon EKS addon
  # 버전 metrics-server도 이 문제 때문에 기본 포트로 10251을 쓴다.
  # https://github.com/kubernetes-sigs/metrics-server/issues/1422
  # https://github.com/aws/containers-roadmap/issues/1798
  set = [
    {
      name  = "args[0]"
      value = "--kubelet-insecure-tls"
    },
    {
      # 주의: 차트 defaultArgs[1]에 이미 같은 플래그(InternalIP,ExternalIP,Hostname)가 있어
      # 중복되지만, Helm은 defaultArgs 배열 인덱스를 부분 수정(sparse override)하지 못하고
      # --set으로 지정한 인덱스만 남긴 채 나머지 원소를 통째로 날려버린다(직접 겪음 — 이
      # 방식으로 defaultArgs[1]만 덮어썼다가 --cert-dir/--kubelet-use-node-status-port가
      # 통째로 사라지고 인덱스 0 자리에 빈 문자열("")이 들어가 metrics-server가 기동
      # 실패했다). 그래서 defaultArgs는 건드리지 않고 args로만 추가한다 — 중복 플래그는
      # metrics-server 플래그 파서가 마지막 값을 채택하므로 동작엔 문제 없다.
      name  = "args[1]"
      value = "--kubelet-preferred-address-types=InternalIP"
    },
    {
      # Fargate의 10250 포트 충돌 회피 (containerPort가 --secure-port/컨테이너
      # 포트/서비스 targetPort/프로브 포트에 전부 일관되게 반영됨).
      name  = "containerPort"
      value = "10251"
    }
  ]
}