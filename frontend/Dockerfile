FROM node:24-alpine

WORKDIR /frontend

# 패키지 먼저 복사 후 설치 (캐시 최적화)
COPY package*.json ./
RUN npm ci

# Vite 빌드 타임 환경변수 (docker compose build args 로 주입)
ARG VITE_GOOGLE_CLIENT_ID=""
ARG VITE_API_BASE="/api"
ENV VITE_GOOGLE_CLIENT_ID=$VITE_GOOGLE_CLIENT_ID
ENV VITE_API_BASE=$VITE_API_BASE

# 소스 복사 및 빌드 진행 (이때 dist 폴더가 생성됨)
COPY . .
RUN npm run build

# 정적 파일 서빙을 위한 serve 전역 설치
RUN npm install -g serve

EXPOSE 5173

# ✨ 빌드된 dist 폴더를 SPA 모드로 서빙 (-s: 새로고침 시 404 방지)
CMD ["serve", "-s", "dist", "-l", "5173"]
