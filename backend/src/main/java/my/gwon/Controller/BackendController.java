package my.gwon.controller;

import my.gwon.handler.MqttMessageHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
public class BackendController {

    private final MqttMessageHandler mqttMessageHandler;

    public BackendController(MqttMessageHandler mqttMessageHandler) {
        this.mqttMessageHandler = mqttMessageHandler;
    }

    // 루트(/)에서 MQTT 로그 출력 // ss
    @GetMapping("/")
    public List<String> backend() {
        return mqttMessageHandler.getLogs();
    }
}
