# 트러블슈팅: ArgoCD가 HPA로 늘어난 replica를 계속 1로 되돌림

**증상**: 부하테스트 중 `kubectl get hpa -n backend -w`를 지켜보면, 7개 서비스의 `REPLICAS`가 갑자기 **동시에** 1로 뚝 떨어졌다가, 곧바로 다시 올라가는 톱니바퀴 패턴이 반복된다. 심할 땐 이 순간 `TARGETS`도 `<unknown>`으로 같이 찍혀서 metrics-server 문제로 오해하기 쉽다.

**환경**: `gitops/argocd/backend-application.yaml` (dev), `backend-application-prod.yaml` (prod)

---

## 1. 진단 절차

### 1-1. "동시에" 떨어진다는 것부터 의심

```bash
kubectl get hpa -n backend -w
```
```
auth-service    cpu: 10%/70%    2   10   8    ← 정상 스케일업 중
...
auth-service    cpu: <unknown>/70%   2   10   1   ← 갑자기 1로
booking-service cpu: <unknown>/70%   2   10   1   ← 다른 서비스도 동시에
hotel-service   cpu: <unknown>/70%   2   10   1
```

**핵심 판단 포인트**: HPA는 메트릭을 못 읽으면(`<unknown>`) **아무것도 하지 않고 가만히 있는다** — replica를 능동적으로 줄이는 동작 자체가 없다. 여러 서비스의 REPLICAS가 **정확히 같은 순간** 동시에 떨어졌다면, 이건 HPA가 아니라 **외부의 누군가가 한 번의 동작으로 여러 Deployment를 동시에 건드렸다**는 강력한 증거다.

### 1-2. 이벤트로 "누가" 건드렸는지 확인

```bash
kubectl get events -n backend --sort-by='.lastTimestamp' | grep -iE "scal|argocd"
```
```
63s   Normal   ScalingReplicaSet   deployment/user-service       Scaled down ... to 1
63s   Normal   ScalingReplicaSet   deployment/chat-bot-service    Scaled down ... to 1
63s   Normal   ScalingReplicaSet   deployment/auth-service        Scaled down ... to 1
63s   Normal   ScalingReplicaSet   deployment/hotel-service       Scaled down ... to 1
63s   Normal   ScalingReplicaSet   deployment/api-gateway         Scaled down ... to 1
63s   Normal   ScalingReplicaSet   deployment/booking-service     Scaled down ... to 1
63s   Normal   ScalingReplicaSet   deployment/payment-service     Scaled down ... to 1
61s   Normal   SuccessfulRescale   horizontalpodautoscaler/api-gateway   New size: 2; reason: Current number of replicas below Spec.MinReplicas
```
**7개 Deployment가 같은 1~2초 사이에 전부 "Scaled down to 1"** — 그리고 곧바로 HPA가 "replica가 minReplicas보다 적다"며 자체 복구를 시도하는 이벤트가 뒤따른다. 한 번의 외부 reconcile이 전체를 강제로 되돌렸고, HPA가 그걸 보고 다시 끌어올린 흐름이 이벤트 로그에 그대로 남는다.

### 1-3. ArgoCD Application 설정 확인

```bash
kubectl get application backend -n argocd -o yaml
```
```yaml
spec:
  syncPolicy:
    automated:
      selfHeal: true   # ← 이게 원인
      prune: true
  # ignoreDifferences 없음
```

---

## 2. 근본 원인

`gitops/backend/base/*/deployment.yaml`에는 `replicas: 1`이 정적으로 박혀 있다 — 원래 HPA가 런타임에 이 값을 대신 관리하는 게 정상이지만, **Git에 적힌 값은 그대로 1**이다.

ArgoCD는 기본 **3분 주기**로 Git 상태와 실제 클러스터 상태를 비교(diff)하는데, `selfHeal: true`라서 차이가 발견되면 **무조건 Git 상태로 강제 복구**한다. `ignoreDifferences` 설정이 없으면 `spec.replicas`도 이 비교 대상에 그대로 포함된다.

```
1. HPA가 부하 보고 booking-service를 8, 10개까지 늘림
2. 3분 뒤 ArgoCD 정기 동기화 실행
3. Git엔 여전히 replicas: 1 → selfHeal이 "드리프트다!" 판단, 강제로 1로 되돌림
4. HPA가 즉시 감지해서 minReplicas(2)로 재조정
5. 부하가 계속되면 다시 스케일업 → 3분 뒤 2번부터 반복
```

이 패턴이 실제로 **한 서비스에서만 169분 동안 44번** 반복된 게 `kubectl describe hpa`의 이벤트 카운트로 확인됐다 — 부하테스트 내내 계속 일어나고 있던 상시적인 문제였다.

> **참고**: `<unknown>`이 같은 타이밍에 찍히는 건 별개 현상이다. 7개 Deployment가 순간적으로 pod를 대거 종료시키면서 metrics-server의 스크래핑 사이클이 그 전환 순간(pod 종료 중, endpoint 갱신 중)과 겹쳐 일시적으로 못 읽는 것 — ArgoCD selfHeal이 만든 혼란의 곁가지 증상이지 원인이 아니다.

---

## 3. 해결

HPA가 관리하는 필드(`spec.replicas`)만 ArgoCD의 drift 비교 대상에서 제외한다.

```yaml
# gitops/argocd/backend-application.yaml, backend-application-prod.yaml
spec:
  # ...
  ignoreDifferences:
    - group: apps
      kind: Deployment
      jsonPointers:
        - /spec/replicas
  syncPolicy:
    automated:
      selfHeal: true
      prune: true
```
`name`을 지정하지 않아 이 네임스페이스의 **모든 Deployment**에 적용된다 — api-gateway 포함 8개 서비스 전부 해당.

### 이게 selfHeal 자체를 끄는 게 아니라는 점

`ignoreDifferences`는 지정한 필드를 비교에서 **영구히 제외**할 뿐이다. `spec.replicas`는 HPA가 뭘로 바꾸든 다시는 drift로 안 잡히고, **나머지 필드(이미지 태그, env, resources 등)는 지금처럼 계속 자동으로 감시·복구된다.** 별도로 `argocd app sync`를 수동 실행할 필요도 없다 — 설정 한 번으로 계속 유효한, 완전 자동 동작이다.

---

## 4. ⚠️ 함정 — 파일만 고치면 반영되는 게 아니다

`backend-application.yaml`을 고쳐서 Git에 merge해도 **자동으로 반영되지 않는다.**

이유: `backend` Application이 감시하는 경로는 `gitops/backend/overlays/dev`이지, **`gitops/argocd/backend-application.yaml` 자기 자신은 감시 대상이 아니다.** 이 Application 리소스 자체는 최초 1회 사람이 `kubectl apply`로 등록하는 방식이라, 이후 이 파일을 고쳐도 그걸 감지해서 재적용해주는 감시자가 없다(이런 걸 자동화하려면 "app of apps" 패턴이 별도로 필요한데 이 프로젝트엔 없음).

```bash
# merge 후 반드시 수동으로 재적용
kubectl apply -f gitops/argocd/backend-application.yaml         # dev
kubectl apply -f gitops/argocd/backend-application-prod.yaml    # prod (prod 클러스터 컨텍스트에서)
```

---

## 5. 검증

```bash
# 1. 설정이 실제로 반영됐는지
kubectl get application backend -n argocd -o jsonpath='{.spec.ignoreDifferences}'
# → [{"group":"apps","jsonPointers":["/spec/replicas"],"kind":"Deployment"}]

# 2. replica 수가 달라도 Synced인지 (예전엔 이 차이 때문에 OutOfSync였음)
kubectl get application backend -n argocd
# → SYNC STATUS: Synced

# 3. 부하테스트 재실행하며 톱니바퀴 패턴 재발 여부 확인
kubectl get hpa -n backend -w
```

---

## 6. 적용 이력

| 환경 | 상태 | 비고 |
|---|---|---|
| dev | ✅ 적용 완료 | `kubectl apply` 실행 후 `ignoreDifferences` 반영 확인 |
| prod | ✅ 적용 완료 | 동일 patch, prod Application에도 반영 |

**새로 ArgoCD Application을 등록할 때(신규 서비스, 신규 환경 등) 이 설정이 기본으로 안 들어가 있다는 점을 반드시 확인할 것** — HPA가 붙은 Deployment를 감시하는 Application이라면 `ignoreDifferences`가 없는 한 이 문제가 그대로 재현된다.