package my.gwon.Controller;

import org.springframework.integration.annotation.ServiceActivator;
import org.springframework.messaging.Message;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Collections;
import java.util.LinkedList;
import java.util.List;

@RestController
public class MqttLogController {

    // 최근 메시지 100개 저장
    private final List<String> logs = Collections.synchronizedList(new LinkedList<>());

    @ServiceActivator(inputChannel = "mqttInputChannel")
    public void handleMqttMessage(Message<?> message) {
        String payload;
        if (message.getPayload() instanceof byte[]) {
            payload = new String((byte[]) message.getPayload());
        } else {
            payload = message.getPayload().toString();
        }

        System.out.println("📡 MQTT 수신 : " + payload);

        // 로그 리스트에 저장 (100개까지만 유지)
        logs.add(payload);
        if (logs.size() > 100) {
            logs.remove(0);
        }
    }

    // 👉 여기서 /backend/move 로 접근하면 JSON 반환
    @GetMapping("/move")
    public List<String> getLogs() {
        return logs;
    }
}
