# --- Build Stage ---
FROM node:20-alpine AS builder

WORKDIR /usr/src/app

COPY package*.json ./
RUN npm ci

COPY . .

# rag-service 서비스 빌드
RUN npm run build rag-service

# --- Production Stage ---
FROM node:20-alpine AS production

ARG NODE_ENV=production
ENV NODE_ENV=${NODE_ENV}

WORKDIR /usr/src/app

COPY package*.json ./
RUN npm ci --only=production

COPY --from=builder /usr/src/app/dist/apps/rag-service ./dist/apps/rag-service

# RAG Service 포트 (예: 3002)
EXPOSE 3003

CMD ["node", "dist/apps/rag-service/main"]