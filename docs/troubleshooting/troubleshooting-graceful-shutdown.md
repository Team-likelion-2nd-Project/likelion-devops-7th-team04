# 트러블슈팅: Graceful shutdown 부재로 스케일다운 중 요청 유실

**증상**: 부하테스트 중 `kubectl get pods -n backend -w`를 지켜보면, HPA 스케일다운으로 죽는 pod가 정상 종료(`Completed`)가 아니라 **`Error`**로 끝난다. k6 결과의 응답 실패/타임아웃 일부가 이 타이밍과 겹친다.

**환경**: 전 백엔드 서비스 (`backend/apps/*/src/main.ts`, `gitops/backend/base/*/deployment.yaml`)

---

## 1. 진단 절차

### 1-1. pod 종료 로그에서 비정상 종료 확인

```bash
kubectl get pods -n backend -w
```
```
api-gateway-76486d9887-tgmgw   1/1   Terminating   0   6m
api-gateway-76486d9887-tgmgw   1/1   Terminating   0   6m
api-gateway-76486d9887-tgmgw   0/1   Error         0   6m30s
```
정상 종료라면 `Completed`로 끝나야 한다. **`Error`로 끝났다는 건 컨테이너 프로세스가 정상적으로 `exit(0)`을 호출하지 못하고 강제 종료됐다는 뜻**이다. 이 pod가 신규 생성된 지 6~7분밖에 안 된, HPA 스케일업 직후 다시 스케일다운된 pod라는 점도 같이 확인한다.

### 1-2. 코드에 SIGTERM 처리가 있는지 확인

```bash
grep -n "enableShutdownHooks" backend/apps/*/src/main.ts
```
결과가 없으면(=한 줄도 안 나오면) 확정. NestJS는 `enableShutdownHooks()`를 명시적으로 호출하지 않으면 SIGTERM에 대해 아무 정리 로직도 실행하지 않는다.

### 1-3. 매니페스트에 종료 관련 설정이 있는지 확인

```bash
grep -n "terminationGracePeriodSeconds\|preStop\|readinessProbe" gitops/backend/base/*/deployment.yaml
```
결과가 없으면 확정.

---

## 2. 근본 원인

### 정상적인 pod 종료 흐름

```
1. pod를 "Terminating"으로 표시
2. Service/Endpoint 목록에서 제거 (kube-proxy/ALB 전파, 수백ms~수초 시차)
3. 컨테이너에 SIGTERM 전송
4. terminationGracePeriodSeconds(기본 30초) 동안 대기
   → 이 사이 앱이 "정리"를 마치고 스스로 종료하면 그대로 끝
   → 시간 다 되면 SIGKILL로 강제 종료
5. pod 완전히 삭제
```

**핵심은 2번과 3번 사이 시차, 그리고 3~4번 사이의 여유시간**이다. 이 프로젝트는 이 흐름에 필요한 장치가 전부 빠져 있었다.

| 빠진 것 | 결과 |
|---|---|
| `app.enableShutdownHooks()` 없음 | SIGTERM을 받아도 Node.js 기본 동작(즉시 종료)을 따름 — 처리 중이던 요청이 그대로 커넥션 리셋 |
| `preStop` hook 없음 | Service에서 빠지는 시차 동안 완충장치가 없어, "이미 빠졌어야 할 pod"로 요청이 계속 들어올 수 있음 |
| `readinessProbe` 없음 | 컨테이너가 뜨는 즉시 "Ready"로 간주 — 앱이 완전히 초기화되기 전에도 트래픽이 들어올 수 있음 |

### 왜 이번 부하테스트에서 눈에 띄었나

pod가 거의 안 죽으면(고정 replica) 이 문제가 발동할 기회 자체가 없다. 그런데 HPA가 붙은 서비스들이 부하에 따라 계속 replica를 늘렸다 줄였다 했고, **스케일다운 = pod를 죽이는 이벤트**라서 이게 잦을수록 "마침 그 순간 요청을 처리 중이던 pod가 죽어서 요청이 끊기는" 사고가 일어날 기회도 늘어났다.

---

## 3. 해결

### 3-1. 앱 코드 — SIGTERM 처리 활성화

```typescript
// backend/apps/*/src/main.ts
const app = await NestFactory.create(ApiGatewayModule);
// 또는 gRPC 서비스는:
// const app = await NestFactory.createMicroservice<MicroserviceOptions>(...);

app.enableShutdownHooks();   // ← 추가
```

### 3-2. 매니페스트 — 종료 유예시간 확보

```yaml
# gitops/backend/base/*/deployment.yaml
spec:
  template:
    spec:
      terminationGracePeriodSeconds: 30
      containers:
        - name: <service-name>
          lifecycle:
            preStop:
              exec:
                command: ["sh", "-c", "sleep 5"]
          readinessProbe:
            # ↓ 서비스 종류에 따라 다르게 (아래 3-3 참고)
            initialDelaySeconds: 5
            periodSeconds: 5
```

### 3-3. ⚠️ 함정 — HTTP와 gRPC의 readinessProbe는 다르게 설정해야 함

api-gateway는 HTTP 서버지만, 나머지 6개 서비스(auth/booking/chat-bot/hotel/payment/user)는 **gRPC 마이크로서비스**(`NestFactory.createMicroservice`)다. 이 차이를 무시하고 전부 `httpGet`으로 설정하면 안 된다 — gRPC 포트에 HTTP 프로브를 쏘면 프로토콜이 안 맞아 **계속 실패 판정**이 나서, 오히려 정상 pod가 Service에서 영구히 빠지는 더 나쁜 상황이 된다.

| 서비스 | 프로토콜 | readinessProbe |
|---|---|---|
| api-gateway | HTTP | `httpGet: { path: /, port: 3000 }` |
| auth-service | gRPC | `tcpSocket: { port: 3006 }` |
| booking-service | gRPC | `tcpSocket: { port: 3003 }` |
| chat-bot-service | gRPC | `tcpSocket: { port: 3005 }` |
| hotel-service | gRPC | `tcpSocket: { port: 3002 }` |
| payment-service | gRPC | `tcpSocket: { port: 3004 }` |
| user-service | gRPC | `tcpSocket: { port: 3001 }` |

`tcpSocket`은 "포트가 열려서 접속 가능한지"만 확인한다 — gRPC 프로토콜 자체를 이해할 필요가 없어서, 별도 gRPC 헬스체크 구현 없이도 안전하게 쓸 수 있다.

### 적용 대상에서 제외한 것

**pg-mock-service**는 HPA가 없어 스케일 이벤트로 인한 pod 종료 빈도가 낮다는 이유로 이번엔 제외했다. 우선순위가 낮을 뿐 아예 필요 없는 건 아니다.

---

## 4. 검증

```bash
# 1. 코드 빌드 확인 (7개 서비스 전부)
cd backend
npx nest build api-gateway
npx nest build auth-service
npx nest build booking-service
npx nest build chat-bot-service
npx nest build hotel-service
npx nest build payment-service
npx nest build user-service
# → 전부 webpack compiled successfully

# 2. 매니페스트 반영 확인
kubectl kustomize gitops/backend/overlays/dev | grep -c "readinessProbe"
kubectl kustomize gitops/backend/overlays/dev | grep -c "terminationGracePeriodSeconds"
# → 둘 다 7 (api-gateway + gRPC 6개, pg-mock-service 제외)

# 3. 실제 스케일다운 시 정상 종료하는지
kubectl get pods -n backend -w
# → Terminating 다음이 Error가 아니라 pod가 그냥 사라짐(Completed 후 삭제)이면 성공
```

**아직 실제 부하테스트로 재검증은 안 됨** — merge 후 다시 부하테스트를 돌려서, 스케일다운 중 요청 실패율이 실제로 줄어드는지 확인이 필요하다.

---

## 5. 적용 이력

| 파일 | 대상 | 상태 |
|---|---|---|
| `backend/apps/*/src/main.ts` | 7개 서비스 (`enableShutdownHooks`) | ✅ 적용 완료 |
| `gitops/backend/base/*/deployment.yaml` | 7개 서비스 (`terminationGracePeriodSeconds`/`preStop`/`readinessProbe`) | ✅ 적용 완료 |
| pg-mock-service | — | ⬜ 제외 (HPA 없음, 낮은 우선순위) |

**새 서비스를 추가할 때 이 3종 세트(`enableShutdownHooks` + `terminationGracePeriodSeconds`/`preStop` + `readinessProbe`)가 기본으로 안 들어가 있다는 점을 반드시 확인할 것** — 특히 gRPC 서비스라면 `readinessProbe`를 `httpGet`이 아니라 `tcpSocket`으로 설정해야 한다.
