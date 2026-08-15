# 📜 [Project/Team Name] 개발 컨벤션 가이드라인 v0.1

---

## 📌 1. 개요 (Overview)

본 문서는 개발 체계의 일관성과 코드 가독성 향상, 효율적인 협업을 위해 작성된 표준 개발 가이드라인입니다.

---

## 💬 2. 커밋 메시지 컨벤션 (Commit Convention)

### 2.1. 기본 구조
```text
<type>: <subject>

<body> (선택사항)
<footer> (선택사항)
```

### 2.2. 타입 (Type) 목록
| 타입 (Type) | 설명 | 예시 |
| :--- | :--- | :--- |
| `feat` | 새로운 기능 추가 | `feat: Google 소셜 로그인 기능 추가` |
| `fix` | 버그 수정 | `fix: 결제 요청 시 금액 누락 오류 수정` |
| `docs` | 문서 수정 (README, 주석 등) | `docs: API 명세서 URL 업데이트` |
| `style` | 코드 포맷팅, 세미콜론 등 (로직 영향 없음) | `style: ESLint 적용에 따른 들여쓰기 수정` |
| `refactor` | 코드 리팩토링 (기능 변경 없음) | `refactor: 유저 서비스 레이어 메서드 분리` |
| `test` | 테스트 코드 추가 및 리팩토링 | `test: 회원가입 성공 단위 테스트 추가` |
| `chore` | 빌드, 패키지 매니저, 설정 변경 | `chore: lodash 패키지 버전 업데이트` |

### 2.3. 작성 규칙
* **제목(Subject):** 
  * 50자 이내로 명확하게 작성합니다.
  * 끝에 마침표(`.`)를 붙이지 않습니다.
  * 제목을 보고 어떤 내용을 구현했는지 알 수 있어야합니다.
* **본문(Body):** 무엇을, 왜 변경했는지 핵심 위주로 서술합니다. (선택)
* **꼬리말(Footer):** 이슈 번호 등을 참조할 때 작성합니다. (예: `Closes #102`) (선택)

### 2-4. 커밋 작성 예시
```bash
git add .
git commit

# 편집기에서 커밋 메시지 작성
feat: 로그인 API 구현 (#12)

- 로그인 API 구현
- JWT 토큰 방식 인증 및 인가 구현

```

---

## 🌿 3. 브랜치 전략 및 PR (Git Branch & Pull Request)

### 3.1. 브랜치 네이밍
* `main` (또는 `master`): 운영 환경에 배포되는 프로덕션 브랜치
* `develop`: 개발한 기능 통합 브랜치
* 그외의 브랜치 명은 Jira 웹에서 생성할 때 할당해주는 브랜치명을 그대로 적용합니다.

### 3.2. Pull Request (PR) 및 코드 리뷰 규칙
* **PR 제목:** `<Jira 이슈키>: <작업 내용 요약>` (예: `[DEV-21]카카오 결제 API 연동`) -> Jira 이슈키는 깃액션이 자동으로 추가해주므로 <작업 내용 요약> 만 작성
* **리뷰어 수:** 최소 **1명 이상**의 Approve를 얻어야 `develop`에 Merge할 수 있습니다.
* **머지 방식:** Squash & Merge 방식 사용합니다. 머지 시 작성하는 커밋 메시지 또한 커밋 메시지 규칙을 적용해야합니다.

---

## 🏷️ 4. 네이밍 컨벤션 (Naming Convention)

| 구분 | 표기법 (Case) | 적용 대상 | 예시 |
| :--- | :--- | :--- | :--- |
| **CamelCase** | 소문자로 시작, 단어 구분 시 대문자 | 변수명, 함수명, 메서드명 | `userAge`, `fetchUserData()` |
| **PascalCase** | 대문자로 시작, 단어 구분 시 대문자 | 클래스명, 인터페이스, 컴포넌트 | `UserProfile`, `UserService` |
| **snake_case** | 모두 소문자, 단어 사이 언더바(`_`) | DB 테이블/컬럼명, 파이썬 변수 | `user_id`, `created_at` |
| **UPPER_SNAKE**| 모두 대문자, 단어 사이 언더바(`_`) | 상수 (Constant) | `MAX_RETRY_COUNT`, `API_URL` |

### 💡 네이밍 작성 가이드 (Good vs Bad)
* ❌ **Bad:** `let d = new Date();` (의미를 알 수 없는 줄임말)
* ✅ **Good:** `let currentDate = new Date();`
* ❌ **Bad:** `function proc()` (모호한 함수명)
* ✅ **Good:** `function processOrderPayment()`

---

## 💻 5. 코딩 스타일 및 코드 작성 규칙 (Coding Style)

### 5.1. 공통 포맷팅
* **들여쓰기(Indent):** Space 4칸
* **줄 바꿈(Line Length):** 한 줄 최대 100자 ~ 120자 제한
* **문자열(String):** Single Quote (`'`) 사용 권장 
* **코드 블록(Code Block)** "함수 및 블록의 여는 중괄호(`{`)는 선언부와 같은 줄에 작성하며, 닫는 중괄호(`}`)는 별도의 줄에 독립적으로 작성합니다."

### 5.2. 예외 처리 및 디버깅
* `console.log` / `print` 구문은 배포 코드(Commit/PR)에 남기지 않습니다.
* 모든 예외(Exception)는 무시하지 않고 명시적으로 처리하거나 커스텀 에러로 래핑합니다.

---

## 🏗️ 6. Infra 관련 작업 규칙 (Infra Convention)

Terraform에 변경을 가해야 하는 경우, 아래 절차를 반드시 순서대로 거쳐야 합니다.

1. **이슈 생성 (Infra)**
   * 새로 이슈를 생성합니다.
   * 라벨: `infra`
   * 마일스톤: 현재 작업 중인 이슈의 마일스톤과 동일하게 설정
2. **브랜치 생성**
   * Jira에서 위 이슈로 브랜치를 생성합니다.
   * 이때 `infra` 브랜치로부터 브랜치를 생성해야 합니다.
3. **Terraform 작업 및 병합**
   * Terraform 변경 작업을 진행합니다.
   * 작업이 끝나면 작업 중인 브랜치를 `infra` 브랜치로 push/merge 합니다.
4. **이슈 생성 (Integration)**
   * `infra` 브랜치로의 merge가 끝난 이후, 새로 이슈를 생성합니다.
   * 라벨: `integration`
   * 마일스톤: 현재 작업 중인 이슈의 마일스톤과 동일하게 설정
5. **develop 반영**
   * `infra` 브랜치를 `develop` 브랜치로 push/merge 합니다.
   * 이때 별도의 브랜치는 생성하지 않고 PR만 생성합니다.
6. **적용 테스트**
   * `develop` 브랜치에서 `terraform apply` 테스트를 진행합니다.

---
