FROM node:22-alpine
WORKDIR /frontend
COPY . .     
RUN npm ci           <-의존성설치
EXPOSE 3000
CMD ["npm", "start"] <- 서버 실행