FROM node:24-alpine

WORKDIR /frontend

# 패키지 먼저 복사 후 설치 (캐시 최적화)
COPY package*.json ./
RUN npm ci

# 소스 복사 및 빌드 진행 (이때 dist 폴더가 생성됨)
COPY . .
RUN npm run build

# 정적 파일 서빙을 위한 serve 전역 설치
RUN npm install -g serve

EXPOSE 5173

# ✨ 핵심: 개발 서버(dev)가 아닌, 빌드된 dist 폴더를 서빙 (-s 옵션은 새로고침 시 404 에러 방지)
CMD ["serve", "-s", "dist", "-l", "5173"]