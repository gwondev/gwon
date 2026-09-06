FROM node:24-alpine

WORKDIR /frontend

COPY package*.json ./
RUN npm ci

COPY . .

# Client ID 는 빌드 직전에 넣는다. 소스 COPY 캐시와 섞이면 예전 ID 가 박힌다.
ARG VITE_GOOGLE_CLIENT_ID=""
ARG VITE_API_BASE="/api"
ENV VITE_GOOGLE_CLIENT_ID=$VITE_GOOGLE_CLIENT_ID
ENV VITE_API_BASE=$VITE_API_BASE
RUN npm run build

# 정적 파일 서빙을 위한 serve 전역 설치
RUN npm install -g serve

EXPOSE 5173

# ✨ 빌드된 dist 폴더를 SPA 모드로 서빙 (-s: 새로고침 시 404 방지)
CMD ["serve", "-s", "dist", "-l", "5173"]
