import lombok.RequiredArgsConstructor;
import my.gwon.backend.socket.DeviceWebSocketHandler;
import org.json.JSONObject;
import org.springframework.integration.annotation.ServiceActivator;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class MqttMessageHandler {

    private final DeviceWebSocketHandler socketHandler;

    @ServiceActivator(inputChannel = "mqttInputChannel")
    public void handleMessage(String message) {
        try {
            JSONObject json = new JSONObject(message);

            String deviceId = json.getString("deviceId");
            double lat = json.getDouble("lat");
            double lon = json.getDouble("lon");
            String time = json.getString("time");
            double speed = json.getDouble("speed");
            double gyro = json.getDouble("gyro");

            System.out.printf("📡 [GPS] %s: (%.6f, %.6f) time=%s speed=%.1f gyro=%.1f%n",
                    deviceId, lat, lon, time, speed, gyro);

            // 가공해서 WebSocket으로 전송
            JSONObject toClient = new JSONObject();
            toClient.put("id", deviceId);
            toClient.put("lat", lat);
            toClient.put("lng", lon);
            toClient.put("speed", speed);
            toClient.put("time", time);
            toClient.put("gyro" , gyro);

            socketHandler.broadcastToClients(toClient.toString());

        } catch (Exception e) {
            System.err.println("⚠️ 메시지 파싱 오류: " + e.getMessage());
        }
    }
}
