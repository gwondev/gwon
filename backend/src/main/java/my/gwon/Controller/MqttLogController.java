package my.gwon.Controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import my.gwon.handler.MqttMessageHandler;

import java.util.List;

@RestController
public class MqttLogController {

    private final MqttMessageHandler messageHandler;

    @Autowired
    public MqttLogController(MqttMessageHandler messageHandler) {
        this.messageHandler = messageHandler;
    }

    @GetMapping("backend/move")
    public List<String> getLogs() {
        // 메시지 핸들러에서 로그를 가져와 반환  asdasdas   asdasd 
        return messageHandler.getLogs();
    }
}