# --- Build Stage ---
FROM node:20-alpine AS builder

WORKDIR /usr/src/app

COPY package*.json ./
RUN npm ci

COPY . .

# chat-bot-service 서비스 빌드
RUN npm run build chat-bot-service

# --- Production Stage ---
FROM node:20-alpine AS production

ARG NODE_ENV=production
ENV NODE_ENV=${NODE_ENV}

WORKDIR /usr/src/app

COPY package*.json ./
RUN npm ci --only=production

COPY --from=builder /usr/src/app/dist/apps/chat-bot-service ./dist/apps/chat-bot-service

# chat-bot Service 포트 (예: 3005)
EXPOSE 3005

CMD ["node", "dist/apps/chat-bot-service/main"]