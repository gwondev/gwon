FROM node:24-alpine

WORKDIR /backend

COPY package*.json ./
RUN npm install --omit=dev

COPY . .

EXPOSE 8080

CMD ["node", "src/index.js"]
