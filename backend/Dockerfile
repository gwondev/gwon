FROM eclipse-temurin:21-jdk-jammy
WORKDIR /backend 
COPY build/libs/*.jar backend.jar
EXPOSE 8080
CMD ["java", "-jar", "backend.jar"]