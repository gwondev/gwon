import org.json.JSONObject;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;

public class DeviceWebSocketHandler extends TextWebSocketHandler {

    @Override
    public void handleTextMessage(WebSocketSession session, TextMessage message) {
        String payload = message.getPayload();

        try {
            JSONObject json = new JSONObject(payload);
            String id = json.getString("id");
            double lat = json.getDouble("lat");
            double lng = json.getDouble("lng");
            String name = json.getString("name");

            System.out.println("🛰️ 받은 데이터 → ID: " + id + ", 이름: " + name + ", 위도: " + lat + ", 경도: " + lng);

            // React에게 그대로 전달
            for (WebSocketSession client : ClientSessionManager.getSessions()) {
                if (client.isOpen()) {
                    client.sendMessage(new TextMessage(payload));
                }
            }

        } catch (Exception e) {
            System.out.println("❌ 파싱 오류: " + e.getMessage());
        }
    }
}
