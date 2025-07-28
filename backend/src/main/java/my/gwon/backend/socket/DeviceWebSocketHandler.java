package my.gwon.backend.socket;

import my.gwon.backend.entity.GpsData;
import my.gwon.backend.repository.GpsDataRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.JsonNode;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;

import java.time.LocalDateTime;

public class DeviceWebSocketHandler extends TextWebSocketHandler {

    private final GpsDataRepository gpsRepo;
    private final ObjectMapper objectMapper = new ObjectMapper();  // Jackson 추가

    public DeviceWebSocketHandler(GpsDataRepository gpsRepo) {
        this.gpsRepo = gpsRepo;
    }

    @Override
    public void afterConnectionEstablished(WebSocketSession session) {
        ClientSessionManager.add(session);
        System.out.println("WebSocket 연결됨: " + session.getId());
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, org.springframework.web.socket.CloseStatus status) {
        ClientSessionManager.remove(session);
        System.out.println("WebSocket 연결 해제됨: " + session.getId());
    }

    @Override
    public void handleTextMessage(WebSocketSession session, TextMessage message) {
        String payload = message.getPayload();

        try {
            // JSONObject → JsonNode로 변경
            JsonNode json = objectMapper.readTree(payload);

            GpsData data = GpsData.builder()
                    .deviceId(json.get("id").asText())      // getString → asText
                    .name(json.get("name").asText())
                    .lat(json.get("lat").asDouble())        // getDouble → asDouble
                    .lng(json.get("lng").asDouble())
                    .timestamp(LocalDateTime.now())
                    .build();

            gpsRepo.save(data);  // ✅ DB 저장

            // 다른 클라이언트들에게 브로드캐스트
            for (WebSocketSession client : ClientSessionManager.getSessions()) {
                if (client.isOpen()) {
                    client.sendMessage(new TextMessage(payload));
                }
            }

        } catch (Exception e) {
            System.out.println("WebSocket 메시지 처리 실패: " + e.getMessage());
        }
    }
}