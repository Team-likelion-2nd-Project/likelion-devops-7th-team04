# RAG 챗봇 호텔 예약 웹서비스: (RAG Chatbot-Powered Hotel Booking Web Service)

> **협업이 처음이신가요?** 이슈 생성부터 PR 머지까지 전 과정은 [협업 가이드](./docs/GUIDE.md)를 먼저 읽어주세요.

![Team](https://img.shields.io/badge/Team-team--04-151515?style=for-the-badge)
<!-- 사용 기술만 남기고 나머지는 삭제 -->
![Git](https://img.shields.io/badge/Git-151515?style=for-the-badge&logo=git&logoColor=F05032)
![Jira](https://img.shields.io/badge/Jira-151515?style=for-the-badge&logo=jira&logoColor=0052CC)
![Slack](https://img.shields.io/badge/Slack-151515?style=for-the-badge&logo=slack&logoColor=4A154B)

![TypeScript](https://img.shields.io/badge/TypeScript-151515?style=for-the-badge&logo=typescript&logoColor=3178C6)
![React](https://img.shields.io/badge/React-151515?style=for-the-badge&logo=react&logoColor=61DAFB)
![NestJS](https://img.shields.io/badge/NestJS-151515?style=for-the-badge&logo=nestjs&logoColor=E0234E)

![MariaDB](https://img.shields.io/badge/MariaDB-151515?style=for-the-badge&logo=mariadb&logoColor=003545)
![Redis](https://img.shields.io/badge/Redis-151515?style=for-the-badge&logo=redis&logoColor=FF4438)

![Docker](https://img.shields.io/badge/Docker-151515?style=for-the-badge&logo=docker&logoColor=2496ED)
![Kubernetes](https://img.shields.io/badge/Kubernetes-151515?style=for-the-badge&logo=kubernetes&logoColor=326CE5)
![Helm](https://img.shields.io/badge/Helm-151515?style=for-the-badge&logo=helm&logoColor=0F1689)
![ArgoCD](https://img.shields.io/badge/Argo_CD-151515?style=for-the-badge&logo=argo&logoColor=EF7B4D)
![Terraform](https://img.shields.io/badge/Terraform-151515?style=for-the-badge&logo=terraform&logoColor=844FBA)

![AWS](https://img.shields.io/badge/AWS-151515?style=for-the-badge&logo=amazonwebservices&logoColor=FF9900)

> **RAG 챗봇을 활용하여 손쉽게 호텔 정보 습득 및 호텔 예약이 가능한 웹 서비스**

본 서비스는 일반 투숙 고객에게 직관적인 객실 탐색과 실시간 예약·결제는 물론, 24시간 맞춤형 상담을 지원하는 AI 챗봇 기능을 제공하는 클라우드 네이티브 호텔 예약 플랫폼입니다. 호텔 관리자에게는 객실 가용 상태, 부대시설 요금, 고객 문의 내역과 결제 데이터를 한눈에 통합 제어할 수 있는 효율적인 운영 환경을 지원합니다. MSA 및 고가용성 클라우드 인프라를 바탕으로 대규모 트래픽 상황에서도 오버부킹 없는 정확한 예약 처리와 높은 가용성을 목표로 설계 되었습니다.

- **문서 최종 정리일:** `2026-08-24` / **구현 기준일:** `2026-08-21`

---

## 팀 구성

| 이름 | 역할 | 담당 | GitHub |
|------|------|------|--------|
| 김태균 | 팀장 / Full Stack | 호텔서비스, 챗봇서비스 | [@rbsxo135](https://github.com/rbsxo135) |
| 장세훈 | Full Stack | 유저/인증서비스, 예약/결제서비스 | [@wkdtpgns5016](https://github.com/wkdtpgns5016) |
| 김좌형 | Infra | AWS 인프라, Terraform, EC2(RDS), ElastiCache(Redis), Neptune, S3/CloudFront, CloudWatch/SNS, FrontEnd CI/CD | [@kimjhn4188-ctrl](https://github.com/kimjhn4188-ctrl) |
| 주병호 | Infra | AWS 인프라, Terraform, VPC, EKS, ECR, IAM/OIDC, Backend CI/CD | [@jack7051105](https://github.com/jack7051105) |

---

## Core Design

> 이 프로젝트가 **의도적으로 선택한 원칙**을 3~6개 적습니다. 기능 나열이 아니라 설계 판단을 씁니다.

- **Github/Jira/Slack 협업 워크플로우 자동화** — GitHub Actions를 통해 Jira 티켓 상태 자동 변경 및 PR/Merge 이벤트 슬랙 알림 연동
- **MSA 설계** — 도메인별 마이크로서비스 분리를 통해 독립적 배포 및 유연한 파드 단위 스케일 아웃 지원
- **RAG 기반 챗봇** — Vector DB와 Graph DB(Neptune)를 결합한 지식 그래프 RAG로 환각(Hallucination) 없는 정확한 호텔 정보 제공
- **선언적 IaC & GitOps 자동화** — Terraform 기반 인프라 코드화 및 GitHub Actions + ArgoCD를 통한 배포 자동화 및 무중단 운영 체계 구축
- **EKS Pod Identity 기반 최소 권한 통제** — 노드가 아닌 파드(Pod) 단위로 전용 IAM 역할을 바인딩하여 클라우드 보안 위협 최소화

---

## Architecture

![아키텍처](./docs/images/Hotel-Reservation-Web-Service-architecture.png)

```
[ 사용자 (Client) ]
  ├── (정적 파일) ──> CloudFront (CDN) ──> S3 Bucket (Frontend)
  └── (API 요청) ──> ALB ──> EKS Ingress (api-gateway)
                                ├── User / Auth / Booking / Hotel / Payment Services ──> MariaDB / Redis
                                └── Chatbot Service ──> S3 Vectors 
```

| 영역 | 기술 |
|------|------|
| Frontend | React, TypeScript, Vite, Tailwind |
| Backend | NestJS, TypeORM, gRPC, Swagger |
| Database | MariaDB, Redis |
| Infra | AWS (VPC, ECR, EKS, EC2, S3, ElastiCache, CloudFront, CloudWatch) |
| CI/CD | GitHub Actions, ArgoCD |
| 인증 | JWT, nestjs/passport |

---

## 주요 기능

| 기능 | 설명 | 로그인 필요 |
|------|------|------------|
| 호텔/객실 정보 조회 | 웹 페이지에서 호텔과 객실의 상세 정보를 조회할 수 있습니다. | X |
| 로그인 기능 | 고객/관리자가 각각의 전용 화면에 로그인할 수 있습니다. | X |
| 로그아웃 기능 | 사용자 및 관리자 세션을 안전하게 종료합니다. | O |
| 예약 기능 | 고객이 원하는 날짜와 객실을 선택하여 예약을 생성합니다. | O |
| 결제 기능 | 예약 내역에 대한 모의 결제 프로세스를 수행합니다. | O |
| 호텔 정보 관리 (Admin) | 관리자가 호텔 및 객실 정보를 추가, 수정, 삭제(CRUD)합니다. | O |
| AI 챗봇 질의응답 | 챗봇에게 객실 사양, 편의시설, 예약 가능 여부를 대화형으로 질문합니다. | X |

주요 화면: 메인 / 목록 / 상세 / 마이페이지 — 자세한 구성은 Wiki > UI Screens 참고.
API 상세 경로와 요청/응답 구조는 Wiki > API Specification 을 따릅니다.

---

## Documentation

상세 설계·회의 기록은 **[GitHub Wiki](https://github.com/Team-likelion-2nd-Project/likelion-devops-7th-team04/wiki)** 에서 관리합니다.

| 카테고리 | 문서 |
|----------|------|
| **Project** | 프로젝트 개요 및 목표 |
| **Architecture** | 	시스템 구조 및 기술 스택 |
| **Development** | 개발 환경 및 개발 규칙 |
| **Infrastructure** | AWS 및 인프라 구성 |
| **Deployment** | 	CI/CD 및 배포 전략 |
| **Meeting Notes** | 주요 회의 내용 및 의사결정 |
| **Troubleshooting** | 개발 중 발생한 문제와 해결 방법 |
| **Future Improvement** | 3차 프로젝트에 반영할 개선점 |

---

## 범위 경계

> 심사에서 가장 신뢰를 얻는 항목입니다. **되는 것과 안 되는 것을 정확히** 씁니다.

**현재 제공:**

- 호텔 페이지: 유저 로그인/로그아웃
- 호텔 페이지: 호텔 및 객실 실시간 조회
- 관리자 페이지: 관리자 로그인/로그아웃
- 호텔 페이지: 예약 기능
- 호텔 페이지: 챗봇 기능
- 관리자 페이지: 호텔 및 객실 정보 추가, 수정, 삭제
- 챗봇: F&Q, 간단한 질문 

**현재 미제공:**
- 호텔 페이지: 결제 기능 → 목업 형태로 대체
- 챗봇: 복잡한 질문처리

**배포 단계:** `dev` → `prod`

---

## 보안과 개인정보 경계

이 저장소는 공개 저장소입니다. 다음 정보를 절대 포함하지 않습니다.

- 인증·클라우드 비밀값, `.env` 실제 값, 인증서·키 파일
- 실제 사용자 개인정보, 운영 DB 계정 정보
- 내부 인프라 식별자 및 서버 직접 접근 URL

비밀값이 실수로 커밋되면 GitHub이 push를 차단합니다. 이미 커밋된 경우 **즉시 해당 키를 폐기하고 재발급**하세요. 커밋을 되돌리는 것만으로는 이력에 남습니다.

---

## 로컬 실행

**사전 요구사항:** Docker, Node 24.19.0

**Backend**

```bash
cp backend/.env.example backend/.env
cp backend/scripts/Dockerfile.seed.example backend/scripts/Dockerfile.seed
cd backend
docker compose --profile local-infra up --build
```

**Lanchain RAG**
```bash
cp langchain_rag/llm-service/.env.example langchain_rag/llm-service/.env
cd langchain_rag
docker compose up --build
```

**Frontend**

```bash
cd frontend
npm install
npm run dev
```

- backend: 
  - api-gateway : `http://localhost:3000`
  - user-service : `http://localhost:3001`
  - hotel-service : `http://localhost:3002`
  - booking-service : `http://localhost:3003`
  - payment-service : `http://localhost:3004`
  - chat-bot-service : `http://localhost:3005`
  - auth-service : `http://localhost:3006`
  - pg-mock-service : `http://localhost:3007`
- frontend: 
  - 고객 전용 페이지 : `http://localhost:5173`, 
  - 관리자 전용 페이지 : `http://localhost:5173/admin`
- env 템플릿: 
  - `backend/.env.example`, 
  - `frontend/.env.example`

**검증**

```bash
cd backend && npm run build
cd frontend && npm run build
````

---

## 추가 보완 사항

- 소셜 로그인 연동 — Google, Naver OAuth 2.0 간편 로그인 적용
- 본인 인증 도입 — PASS OpenAPI를 활용한 휴대폰 본인 인증 연동
- 관리자 대시보드 시각화 — 매출, 예약률, 체크인 현황에 대한 인터랙티브 차트 구축
- F&B/부대시설 서비스 확장 — 호텔 내 레스토랑 및 액티비티 예약 기능 추가
- 환경 분리 고도화 — dev / stage / prod 멀티 테넌트 인프라 환경 파이프라인 구축
- AWS RDS 마이그레이션 — EC2 기반 MariaDB를 AWS Aurora RDS 관리형 서비스로 전환하여 고가용성 확보
- Transit Gateway 도입 — 글로벌 확장을 위한 멀티 VPC / 멀티 리전 간 통신 아키텍처 수립 + Firewall VPC 구축을 통한 보안성 강화
- 서비스 지표 시각 데이터 고도화 - 프로메테우스/그라파나 대시보드 저장 자동화 구축 필요
- k6 기반 부하테스트 고도화 및 HPA 임계치 최적화 - 부하 테스트를 통한 서비스 응답속도 개선 및 최적의 CPU/Memory HPA 메트릭 및 워밍업(Warm-up) 전략 수립
- 인프라 CI/CD 자동화 파이프라인 구성 및 적용
- EKS GPU 노드에서 작동하는 self-hosted LLM의 한계로 AWS Bedrock 도입하여 더 반응성 좋은 챗봇 서비스 구축
- Langchain 및 RAG 로직을 보강하여 챗봇으로 예약까지 진행하는 기능 구현
- S3 로깅 기능 구축

## 기여 방법
- **규칙 요약** — [CONTRIBUTING.md](./CONTRIBUTING.md)
- **실행 방법 상세** — [협업 가이드](./docs/GUIDE.md)
- **Swagger API 명세 가이드 문서** [develop-swagger-guide.md](./docs/develop_convention.md)
- **워크플로우 가이드 문서** [workflow.md](./docs/workflow.md)
- **개발컨벤션 문서** [develop_convention.md](./docs/develop_convention.md)

## License

이 프로젝트는 [MIT License](./LICENSE) 를 따릅니다.
