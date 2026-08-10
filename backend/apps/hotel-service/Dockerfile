# --- Build Stage ---
FROM node:20-alpine AS builder

WORKDIR /usr/src/app

COPY package*.json ./
RUN npm ci

COPY . .

# hotel-service 서비스 빌드
RUN npm run build hotel-service

# --- Production Stage ---
FROM node:20-alpine AS production

ARG NODE_ENV=production
ENV NODE_ENV=${NODE_ENV}

WORKDIR /usr/src/app

COPY package*.json ./
RUN npm ci --only=production

COPY --from=builder /usr/src/app/dist/apps/hotel-service ./dist/apps/hotel-service

# Hotel Service 포트 (예: 3001 또는 gRPC/TCP 포트)
EXPOSE 3002

CMD ["node", "dist/apps/hotel-service/main"]