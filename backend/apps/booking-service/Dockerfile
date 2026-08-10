# --- Build Stage ---
FROM node:20-alpine AS builder

WORKDIR /usr/src/app

COPY package*.json ./
RUN npm ci

COPY . .

# booking-service 서비스 빌드
RUN npm run build booking-service

# --- Production Stage ---
FROM node:20-alpine AS production

ARG NODE_ENV=production
ENV NODE_ENV=${NODE_ENV}

WORKDIR /usr/src/app

COPY package*.json ./
RUN npm ci --only=production

COPY --from=builder /usr/src/app/dist/apps/booking-service ./dist/apps/booking-service

# Booking Service 포트 (예: 3003)
EXPOSE 3003

CMD ["node", "dist/apps/booking-service/main"]