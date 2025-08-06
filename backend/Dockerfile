FROM openjdk:21-jdk-slim
WORKDIR /backend 
COPY backend/build/libs/*.jar backend.jar
EXPOSE 8080
CMD ["java", "-jar", "backend.jar"]