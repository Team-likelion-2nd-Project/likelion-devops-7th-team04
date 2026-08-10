# 📚 API Gateway Swagger 문서 작성 가이드라인

본 문서는 **RAG 기반 챗봇 호텔 예약 서비스**의 API Gateway에 수록되는 Swagger(OpenAPI Specification 3.0) 문서를 일관성 있고 명확하게 유지하기 위한 작성 표준 가이드라인입니다.

---

## 1. 개요 및 작성 원칙

1. **작성 위치는 오직 `API Gateway`**:
   * 백엔드 마이크로서비스(`user-service`, `hotel-service` 등)는 내부 gRPC 통신을 담당하므로 Swagger를 작성하지 않습니다.
   * 모든 REST API 명세 및 Swagger 데코레이터는 **`apps/api-gateway`** 내 컨트롤러와 DTO에 작성합니다.

2. **명시적인 `@ApiOperation` 사용**:
   * API의 요약(`summary`)과 상세 설명(`description`)은 컨트롤러 메서드 위에 **`@ApiOperation` 데코레이터**를 사용하여 오해 없이 명확히 구분하여 작성합니다.

3. **DTO는 자동화 플러그인(Swagger CLI Plugin) 활용**:
   * DTO 필드 설명 및 예시 데이터는 DTO 내부의 JSDoc 주석(`/** ... */`)과 `class-validator`를 활용하여 자동 반영시킵니다.

---

## 2. Controller 작성 규칙

### 2.1. 그룹 태그 설정 (`@ApiTags`)
컨트롤러 클래스 상단에 `@ApiTags()`를 사용하여 Swagger UI 메뉴에서 카테고리별로 묶이도록 합니다.

* **태그 네이밍 규칙**: `[순서/번호]. [기능명] ([영문명])`
* **예시**:
```typescript
@ApiTags('01. 유저 (User)')
@Controller('api/users')
export class UserController {}

@ApiTags('02. 호텔 (Hotel)')
@Controller('api/hotels')
export class HotelController {}
```

---

### 2.2. API 설명 작성 (`@ApiOperation`)
각 컨트롤러 메서드 위에 `@ApiOperation` 데코레이터를 사용하여 `summary`와 `description`을 명시적으로 적어줍니다.

* **`summary`**: API의 짧은 제목/요약 (Swagger UI 상단 노출)
* **`description`**: API 동작 방식, gRPC 연동 내용, 주의사항 등 상세 설명 (클릭 시 하단에 노출)

```typescript
@ApiOperation({
  summary: '유저 단건 상세 조회',
  description: '유저의 PK ID를 바탕으로 gRPC를 통해 user-service에서 프로필 정보 및 권한 상태를 조회합니다.',
})
@Get(':id')
getUserById(@Param('id') id: string) {
  return this.userService.getUserById(id);
}
```

---

### 2.3. 시스템/내부 전용 API 숨기기 (`@ApiExcludeController`, `@ApiExcludeEndpoint`)
Swagger UI에 노출될 필요가 없는 헬스체크, 루트 엔드포인트, 내부 전용 API는 문서에서 제외합니다.

* **컨트롤러 전체 숨기기**:
```typescript
@ApiExcludeController()
@Controller()
export class ApiGatewayController {}
```
* **특정 엔드포인트만 숨기기**:
```typescript
@ApiExcludeEndpoint()
@Get('internal-health')
getInternalHealth() {}
```

---

## 3. DTO 및 스키마 작성 규칙

`nest-cli.json`에 설정된 Swagger CLI 플러그인을 활용하여 **별도의 `@ApiProperty()` 없이 JSDoc 주석과 `class-validator`로 자동 반영**시킵니다.

### 3.1. DTO 필드 작성 표준

```typescript
import { IsEmail, IsString, IsOptional, IsEnum } from 'class-validator';

export enum UserRole {
  USER = 'USER',
  ADMIN = 'ADMIN',
}

export class CreateUserDto {
  /**
   * 유저 이메일 주소
   * @example "user@example.com"
   */
  @IsEmail({}, { message: '올바른 이메일 형식이 아닙니다.' })
  email: string;

  /**
   * 유저 이름 (2자 이상)
   * @example "홍길동"
   */
  @IsString()
  name: string;

  /**
   * 계정 권한 (기본값: USER)
   * @example "USER"
   */
  @IsEnum(UserRole)
  @IsOptional()
  role?: UserRole = UserRole.USER;
}
```

### 3.2. DTO 작성 규칙 세부 사항
1. **`/** 설명 */`**: Swagger UI의 필드 `description`으로 표출됩니다.
2. **`@example "값"`**: Swagger UI [Try it out] 클릭 시 입력창에 들어갈 예시 데이터입니다.
3. **선택 필드(`?`)**: `?` 연산자와 `@IsOptional()`을 동시에 사용하여 Swagger 문서상에서 `Required` (붉은 별표) 항목에서 제거합니다.

---

## 4. 응답 상태 코드 및 공통 에러 처리

### 4.1. 성공 응답 명시 (`@ApiResponse`)
성공 케이스(`200 OK`, `201 Created`)는 컨트롤러 메서드에 명시합니다.

```typescript
@ApiOperation({
  summary: '신규 회원 가입',
  description: '전달받은 유저 정보를 바탕으로 새로운 회원 계정을 생성합니다.',
})
@Post()
@ApiResponse({ status: 201, description: '회원가입 성공' })
createUser(@Body() dto: CreateUserDto) {
  return this.userService.createUser(dto);
}
```

---

### 4.2. 공통 에러 응답 데코레이터 활용 (`@ApiCommonResponses`)
매번 동일하게 발생하는 `400 Bad Request`, `401 Unauthorized`, `500 Server Error` 등은 공통 데코레이터를 만들어 한 줄로 적용합니다.

#### 1) 공통 데코레이터 정의 (`apps/api-gateway/src/common/decorators/api-response.decorator.ts`)
```typescript
import { applyDecorators } from '@nestjs/common';
import { ApiResponse } from '@nestjs/swagger';

export function ApiCommonResponses() {
  return applyDecorators(
    ApiResponse({ status: 400, description: '잘못된 입력값 (유효성 검사 실패)' }),
    ApiResponse({ status: 401, description: '인증 실패 (JWT 토큰 누락 또는 만료)' }),
    ApiResponse({ status: 500, description: '서버 내부 오류 (마이크로서비스 통신 장애)' }),
  );
}
```

#### 2) 컨트롤러 적용
```typescript
@ApiTags('01. 유저 (User)')
@ApiCommonResponses() // 🟢 컨트롤러 내 모든 API에 공통 에러 세팅 일괄 적용
@Controller('api/users')
export class UserController {}
```

---

## 5. 컨트롤러 작성 종합 예시 코드

```typescript
import { Controller, Get, Post, Body, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { ApiCommonResponses } from '../common/decorators/api-response.decorator';
import { CreateUserDto } from './dto/create-user.dto';

@ApiTags('01. 유저 (User)')
@ApiCommonResponses()
@Controller('api/users')
export class UserController {

  @ApiOperation({
    summary: '신규 유저 가입 요청',
    description: '클라이언트로부터 전달받은 정보를 통해 유저를 생성합니다.',
  })
  @Post()
  @ApiResponse({ status: 201, description: '유저 생성 성공' })
  createUser(@Body() createUserDto: CreateUserDto) {
    return this.userService.createUser(createUserDto);
  }

  @ApiOperation({
    summary: '유저 상세 정보 조회',
    description: '유저의 PK ID를 사용하여 유저 프로필 정보를 조회합니다.',
  })
  @Get(':id')
  @ApiParam({ name: 'id', description: '유저 PK ID', example: '123' })
  @ApiResponse({ status: 200, description: '조회 성공' })
  @ApiResponse({ status: 404, description: '존재하지 않는 유저' })
  getUserById(@Param('id') id: string) {
    return this.userService.getUserById(id);
  }
}
```

---

## 6. PR 승인 전 체크리스트 (Swagger 검수)

PR(Pull Request)을 제출하기 전, 로컬 Swagger UI (`http://localhost:3000/api-docs`)에서 아래 항목을 반드시 점검합니다.

- [ ] `@ApiTags`로 그룹 이름이 올바르게 설정되어 있는가?
- [ ] 메인화면/헬스체크 등 불필요한 컨트롤러가 `@ApiExcludeController()`로 숨겨져 있는가?
- [ ] 모든 API 메서드에 `@ApiOperation({ summary, description })`이 기재되어 있는가?
- [ ] DTO에 JSDoc 주석과 `@example` 예시 데이터가 명시되어 있어 [Try it out] 테스트가 바로 가능한가?
- [ ] 선택 파라미터(`?`)에 `@IsOptional()`이 잘 반영되어 스키마에서 Required(`*`) 표시가 제거되었는가?