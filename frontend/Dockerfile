FROM node:22-alpine
WORKDIR /frontend
COPY . .     
RUN npm ci          
EXPOSE 3000
CMD ["npm", "start"]