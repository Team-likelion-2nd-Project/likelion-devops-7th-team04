# --- Build Stage ---
FROM node:20-alpine AS builder

WORKDIR /usr/src/app

COPY package*.json ./
RUN npm ci

COPY . .

# user-service 서비스 빌드
RUN npm run build user-service

# --- Production Stage ---
FROM node:20-alpine AS production

ARG NODE_ENV=production
ENV NODE_ENV=${NODE_ENV}

WORKDIR /usr/src/app

COPY package*.json ./
RUN npm ci --only=production

COPY --from=builder /usr/src/app/dist/apps/user-service ./dist/apps/user-service

# User Service 포트 (예: 3003)
EXPOSE 3001

CMD ["node", "dist/apps/user-service/main"]