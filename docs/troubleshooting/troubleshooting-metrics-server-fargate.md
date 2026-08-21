# 트러블슈팅: metrics-server가 Fargate 노드를 못 읽음 (HPA `<unknown>`)

**문제발생**: 2026-08-20<br/>
**연관 이슈**: issue `#360`

**증상**: `kubectl get hpa`의 `TARGETS` 컬럼이 계속 `cpu: <unknown>/70%`로 나오고, HPA가 부하와 무관하게 replica를 조정하지 않는다.

**환경**: EKS + Fargate 혼합 클러스터 (`team04-hotel-{dev,prod}-eks`)

**적용 파일**: `infra/terraform/environments/{dev,prod}/addons/metrics-server.tf`

---

## 1. 진단 절차

증상만 보고 바로 원인을 추측하지 말고, 아래 순서로 실제 상태를 확인한다.

### 1-1. metrics API 자체가 살아있는지 확인

```bash
kubectl get apiservice v1beta1.metrics.k8s.io
```

| AVAILABLE | 의미 |
|---|---|
| `True` | 정상 |
| `False (FailedDiscoveryCheck)` | 문제 있음 — 다음 단계로 |

더 자세한 원인 메시지:

```bash
kubectl describe apiservice v1beta1.metrics.k8s.io
```

```
Status:
  Conditions:
    Message: failing or missing response from https://10.0.10.6:10250/apis/metrics.k8s.io/v1beta1:
              bad status from https://10.0.10.6:10250/apis/metrics.k8s.io/v1beta1: 404
    Reason:   FailedDiscoveryCheck
    Status:   False
```

### 1-2. metrics-server 로그에서 실제 에러 확인

```bash
kubectl logs -n kube-system -l app.kubernetes.io/name=metrics-server --tail=50
```

```
E... "Failed to scrape node" err="Get \"https://10.0.10.6:10250/metrics/resource\":
      tls: failed to verify certificate: x509: certificate is valid for 127.0.0.1, not 10.0.10.6"
      node="fargate-ip-10-0-10-6.ec2.internal"
```

### 1-3. 최종 확인 — 실제로 데이터를 못 주는지

```bash
kubectl top nodes
kubectl top pods -n backend
```
→ `error: Metrics API not available` 또는 값이 하나도 안 찍히면 확정.

---

## 2. 근본 원인 (2가지 복합)

### 원인 A — Fargate kubelet의 TLS 인증서가 `127.0.0.1` 고정

EKS Fargate는 pod마다 가상 kubelet이 즉석에서 뜨는 구조인데, 여기 발급되는 TLS 서빙 인증서가 **실제 노드 IP가 아니라 `127.0.0.1`을 대상으로 고정 발급**된다. metrics-server가 실제 IP(`10.0.10.6` 등)로 접속하면 인증서 검증에서 항상 실패한다.

이건 이 프로젝트만의 버그가 아니라 **EKS Fargate 자체의 잘 알려진 제약**이다.
- https://github.com/kubernetes-sigs/metrics-server/issues/1422
- https://github.com/aws/containers-roadmap/issues/1798

**EC2 노드는 이 문제가 없다** — kubelet이 부팅 시 실제 IP/hostname을 담은 정식 인증서를 발급받기 때문. 이 클러스터에서 EC2로 도는 서비스(api-gateway 등)는 처음부터 이 문제와 무관했다.

### 원인 B — Fargate가 포트 10250을 kubelet 전용으로 예약

metrics-server는 기본값으로 자기 자신의 API 서버를 포트 **10250**에 띄우는데, Fargate는 이 포트를 kubelet용으로 이미 예약해뒀다. metrics-server 자신도 Fargate에서 뜨기 때문에(`kube-system` 네임스페이스가 Fargate profile 대상), 자기 자신과 포트가 충돌해 `403`/`FailedDiscoveryCheck`가 난다.

AWS 공식 EKS addon 버전 metrics-server도 이 문제 때문에 기본 포트로 **10251**을 쓴다.

---

## 3. 해결

`helm_release.metrics_server`(Terraform)의 `set` 블록에 3개 인자를 추가한다.

```hcl
resource "helm_release" "metrics_server" {
  name       = "metrics-server"
  repository = "https://kubernetes-sigs.github.io/metrics-server/"
  chart      = "metrics-server"
  namespace  = "kube-system"
  version    = "3.13.0"

  atomic          = true
  cleanup_on_fail = true
  timeout         = 600

  set = [
    {
      name  = "args[0]"
      value = "--kubelet-insecure-tls"           # 원인 A 우회
    },
    {
      name  = "args[1]"
      value = "--kubelet-preferred-address-types=InternalIP"
    },
    {
      name  = "containerPort"
      value = "10251"                            # 원인 B 회피
    }
  ]
}
```

`containerPort`를 바꾸면 `--secure-port`/컨테이너 포트/서비스 `targetPort`/liveness·readiness 프로브 포트에 전부 일관되게 반영된다(차트 내부적으로 연결되어 있음).

### ⚠️ 함정 — `defaultArgs`를 직접 덮어쓰지 말 것

차트의 `defaultArgs[1]`에 이미 비슷한 플래그(`InternalIP,ExternalIP,Hostname`)가 있어서 `args[1]`과 중복돼 보일 수 있다. **이 중복을 없애려고 `defaultArgs[1]`을 직접 `--set`으로 덮어쓰면 안 된다.**

Helm은 `defaultArgs` 배열을 **부분 수정(sparse override)하지 못한다** — `--set`으로 지정한 인덱스만 남기고 배열의 나머지 원소를 통째로 날려버린다. 실제로 이 방식으로 시도했다가:
- `--cert-dir`, `--kubelet-use-node-status-port` 같은 다른 필수 플래그가 통째로 사라지고
- 인덱스 0 자리에 빈 문자열(`""`)이 들어가서
- metrics-server가 아예 기동 실패했다.

**그래서 `defaultArgs`는 절대 건드리지 않고, `args`로만 추가한다.** 플래그가 중복돼도 metrics-server의 플래그 파서가 마지막 값을 채택하므로 동작에는 문제없다.

---

## 4. 검증

```bash
# 1. API 가용성
kubectl get apiservice v1beta1.metrics.k8s.io
# → AVAILABLE: True

# 2. 실제 데이터 수신
kubectl top nodes
kubectl top pods -n backend

# 3. HPA가 실제 값을 읽는지
kubectl get hpa -n backend
# → TARGETS 컬럼이 cpu: <unknown>/70% 대신 cpu: 12%/70% 처럼 실수치로 나오면 완료
```

---

## 5. 남을 수 있는 잔여 노이즈 (정상 범위)

수정 후에도 아래 에러가 **가끔** 보일 수 있는데, 이는 클러스터 상태 변화(pod 스케일 이벤트로 인한 Fargate 노드 생성/소멸)로 인한 일시적 현상이지 재발이 아니다.

| 로그 | 의미 |
|---|---|
| `connect: connection refused` | 이미 종료된 Fargate 노드에 스크래핑 시도 — 다음 스크래핑 주기에 저절로 사라짐 |
| `remote error: tls: internal error` | 같은 원인 A 계열의 변형 에러 — 재발이라기보단 표현만 다른 동일 현상 |
| `kubectl top nodes`에서 metrics-server 자신이 떠 있는 노드 하나만 `<unknown>` | 자기 자신 스크래핑 관련 사소한 이슈, 클러스터 전체 영향 없음 — 반복되면 재조사 필요 |

지속적으로 재발하거나 여러 노드에 걸쳐 나타나면 정상 범위를 벗어난 것이므로 1번 진단 절차부터 다시 밟는다.

---

## 6. 적용 이력

| 환경 | 상태 | 비고 |
|---|---|---|
| dev | ✅ 적용 완료 | DEV-199, `#361 fix: fargate tls 옵션 수정 및 metric 서버 포트 수정` |
| prod | ✅ 적용 완료 | dev 커밋 확인 후 동일 내용 반영, `terraform validate` 통과 |

**새 환경을 만들 때(prod 재구축, 새 클러스터 등) 이 fix가 기본으로 안 들어가 있다는 점을 반드시 확인할 것** — `metrics-server.tf`를 원본 helm chart 기본값 그대로 복사해오면 이 문제가 그대로 재현된다.
