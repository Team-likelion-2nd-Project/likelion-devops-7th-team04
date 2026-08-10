# --- Build Stage ---
FROM node:20-alpine AS builder

WORKDIR /usr/src/app

# 의존성 파일 복사 및 설치
COPY package*.json ./
RUN npm ci

# 전체 소스코드 및 Monorepo 설정 복사
COPY . .

# api-gateway 서비스 빌드
RUN npm run build api-gateway

# --- Production Stage ---
FROM node:20-alpine AS production

ARG NODE_ENV=production
ENV NODE_ENV=${NODE_ENV}

WORKDIR /usr/src/app

COPY package*.json ./
RUN npm ci --only=production

# 빌드 결과물 복사
COPY --from=builder /usr/src/app/dist/apps/api-gateway ./dist/apps/api-gateway

# API Gateway 포트 (예: 3000)
EXPOSE 3000

CMD ["node", "dist/apps/api-gateway/main"]