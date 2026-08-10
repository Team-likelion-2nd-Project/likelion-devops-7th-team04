# --- Build Stage ---
FROM node:20-alpine AS builder

WORKDIR /usr/src/app

COPY package*.json ./
RUN npm ci

COPY . .

# payment-service 서비스 빌드
RUN npm run build payment-service

# --- Production Stage ---
FROM node:20-alpine AS production

ARG NODE_ENV=production
ENV NODE_ENV=${NODE_ENV}

WORKDIR /usr/src/app

COPY package*.json ./
RUN npm ci --only=production

COPY --from=builder /usr/src/app/dist/apps/payment-service ./dist/apps/payment-service

# Payment Service 포트 (예: 3004)
EXPOSE 3004

CMD ["node", "dist/apps/payment-service/main"]