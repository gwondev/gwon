package my.gwon.backend.controller;

import lombok.RequiredArgsConstructor;
import my.gwon.backend.dto.GpsDto;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Controller;

@Controller
@RequiredArgsConstructor
public class GpsController {

    private final SimpMessagingTemplate messagingTemplate;

    @MessageMapping("/gps")  // /pub/gps로 들어온 메시지 처리
    public void handleGps(GpsDto gps) {
        System.out.println("📡 GPS 수신: " + gps);
        messagingTemplate.convertAndSend("/sub/gps", gps); // /sub/gps를 구독 중인 클라이언트에게 전송
    }
}
