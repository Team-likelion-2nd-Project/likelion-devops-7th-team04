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

> **한 문장 소개 — RAG 챗봇을 활용하여 손쉽게 호텔 정보 습득 및 호텔 예약이 가능한 웹 서비스**

[![데모 영상](https://img.youtube.com/vi/{{YOUTUBE_ID}}/maxresdefault.jpg)]({{YOUTUBE_URL}})

{{서비스 2~3문장 설명. 대상 사용자와 핵심 가치 중심으로.}}

- **배포 주소:** {{https://example.com}}
- **시연 영상:** [YouTube]({{YOUTUBE_URL}})
- **문서 최종 정리일:** `2026-08-14` / **구현 기준일:** `2026-08-14`

---

## 팀 구성

| 이름 | 역할 | 담당 | GitHub |
|------|------|------|--------|
| 김태균 | 팀장 / Full Stack | 호텔서비스, 챗봇서비스 | [@rbsxo135](https://github.com/rbsxo135) |
| 장세훈 | Full Stack | 유저/인증서비스, 예약/결제서비스 | [@wkdtpgns5016](https://github.com/wkdtpgns5016) |
| 김좌형 | Infra | AWS 인프라, Terraform, EC2(RDS), ElastiCache(Redis), Neptune, S3/CloudFront, CloudWatch/SNS, FrontEnd CI/CD | [@kimjhn4188-ctrl](https://github.com/kimjhn4188-ctrl) |
| 주병호 | Infra | AWS 인프라, Terraform, VPC, EKS, ECR, IAM/OIDC, Backend CI/CD | [@jack7051105](https://github.com/jack7051105) |

---

## 빠른 심사 흐름 (5분)

> 심사위원·멘토가 5분 안에 핵심 기능을 확인할 수 있는 순서로 작성합니다.

1. 위 영상 썸네일을 클릭해 전체 시연을 확인합니다.
2. {{배포 주소}} 를 엽니다.
3. 테스트 계정으로 로그인합니다. (`ID: {{demo}}` / `PW: {{demo1234}}`)
4. {{핵심 기능 1}} 을 실행합니다.
5. {{핵심 기능 2}} 결과 화면에서 {{확인 포인트}} 를 확인합니다.

---

## Core Design

> 이 프로젝트가 **의도적으로 선택한 원칙**을 3~6개 적습니다. 기능 나열이 아니라 설계 판단을 씁니다.

- **Github/Jira/Slack 협업 워크플로우 자동화** — GitHub Actions를 통해 Jira 티켓 상태 자동 변경 및 PR/Merge 이벤트 슬랙 알림 연동
- **MSA 설계** — 도메인별 마이크로서비스 분리를 통해 독립적 배포 및 유연한 파드 단위 스케일 아웃 지원
- **RAG 기반 챗봇** — Vector DB와 Graph DB(Neptune)를 결합한 지식 그래프 RAG로 환각(Hallucination) 없는 정확한 호텔 정보 제공
- - **선언적 IaC & GitOps 자동화** — Terraform 기반 인프라 코드화 및 GitHub Actions + ArgoCD를 통한 배포 자동화 및 무중단 운영 체계 구축
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
| AI 챗봇 질의응답 | 챗봇에게 객실 사양, 편의시설, 예약 가능 여부를 대화형으로 질문합니다. | O |

주요 화면: 메인 / 목록 / 상세 / 마이페이지 — 자세한 구성은 Wiki > UI Screens 참고.
API 상세 경로와 요청/응답 구조는 Wiki > API Specification 을 따릅니다.

---

## Documentation

상세 설계·회의 기록은 **GitHub Wiki** 에서 관리합니다.

| 카테고리 | 문서 |
|----------|------|
| **Start Here** | 기획 배경 · User Flows · UI Screens |
| **Architecture** | System Architecture · ERD · API Specification |
| **Operations** | 배포 가이드 · 회의록 · 트러블슈팅 |

---

## 범위 경계

> 심사에서 가장 신뢰를 얻는 항목입니다. **되는 것과 안 되는 것을 정확히** 씁니다.

**현재 제공:**

- 호텔 페이지: 유저 로그인/로그아웃
- 호텔 페이지: 호텔 및 객실 실시간 조회
- 관리자 페이지: 관리자 로그인/로그아웃
- 관리자 페이지: 호텔 및 객실 정보 추가, 수정, 삭제


**현재 미제공:**

- 호텔 페이지: 예약 기능
- 호텔 페이지: 결제 기능
- 호텔 페이지: 챗봇 기능

**배포 단계:** `dev` → `prod` (미선언)

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
docker compose up --build
```

**Frontend**

```bash
cd frontend
npm install
npm run dev
```

- backend: `http://localhost:3000`
- frontend: 
  - 고객 전용 페이지 : `http://localhost:5173`, 
  - 관리자 전용 페이지 : `http://localhost:5173/admin`
- env 템플릿: `backend/.env.example`, `frontend/.env.example`

**검증**

```bash
{{./gradlew test}}
cd frontend && npm run build
```

---

## 추가 보완 사항

- 소셜 로그인 연동 — Google, Naver OAuth 2.0 간편 로그인 적용
- 본인 인증 도입 — PASS OpenAPI를 활용한 휴대폰 본인 인증 연동
- 관리자 대시보드 시각화 — 매출, 예약률, 체크인 현황에 대한 인터랙티브 차트 구축
- F&B/부대시설 서비스 확장 — 호텔 내 레스토랑 및 액티비티 예약 기능 추가
- 환경 분리 고도화 — dev / stage / prod 멀티 테넌트 인프라 환경 파이프라인 구축
- AWS RDS 마이그레이션 — EC2 기반 MariaDB를 AWS Aurora RDS 관리형 서비스로 전환
- Transit Gateway 도입 — 글로벌 확장을 위한 멀티 VPC / 멀티 리전 간 통신 아키텍처 수립

## 기여 방법
- **규칙 요약** — [CONTRIBUTING.md](./CONTRIBUTING.md)
- **실행 방법 상세** — [협업 가이드](./docs/GUIDE.md)
- **Swagger API 명세 가이드 문서** [develop-swagger-guide.md](./docs/develop_convention.md)
- **워크플로우 가이드 문서** [workflow.md](./docs/workflow.md)
- **개발컨벤션 문서** [develop_convention.md](./docs/develop_convention.md)

## License

이 프로젝트는 [MIT License](./LICENSE) 를 따릅니다.
