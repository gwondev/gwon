package my.gwon.backend.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.integration.annotation.ServiceActivator;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.SendTo;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.messaging.simp.annotation.SubscribeMapping;
import org.springframework.stereotype.Controller;

@Controller
@RequiredArgsConstructor
public class GpsStompController {

    private final SimpMessagingTemplate stompTemplate;

    // MQTT → STOMP 브로드캐스트
    @ServiceActivator(inputChannel = "mqttInputChannel")
    public void handleGpsData(String message) {
        System.out.println("📡 MQTT → STOMP: " + message);
        
        // STOMP 토픽으로 브로드캐스트
        stompTemplate.convertAndSend("/topic/gps", message);
        
        // 개별 사용자에게도 전송 가능
        // stompTemplate.convertAndSendToUser("userId", "/queue/gps", message);
    }

    // STOMP 클라이언트가 메시지 전송시 처리
    @MessageMapping("/gps/request") // 클라이언트가 /app/gps/request로 전송
    @SendTo("/topic/gps") // 응답을 /topic/gps로 브로드캐스트
    public String handleGpsRequest(String request) {
        System.out.println("🔄 STOMP 클라이언트 요청: " + request);
        return "GPS 요청 처리됨: " + request;
    }

    // STOMP 구독시 초기 데이터 전송
    @SubscribeMapping("/topic/gps")
    public String handleSubscription() {
        System.out.println("✅ STOMP 새 구독자 연결");
        return "GPS 서비스 연결됨";
    }
}