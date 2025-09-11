package my.gwon.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Controller; // @Controller 사용
import org.springframework.web.bind.annotation.*;

import my.gwon.handler.MqttMessageHandler;

import java.util.List;

@Controller // 이 컨트롤러는 HTML 템플릿을 반환합니다
@RequestMapping("/move")
public class MoveController {

    private final MqttMessageHandler messageHandler;

    @Autowired
    public MoveController(MqttMessageHandler messageHandler) {
        this.messageHandler = messageHandler;
    }

    // URL: https://gwon.my/backend/move
    // 역할: move.html 페이지를 반환합니다.
    @GetMapping
    public String showMovePage() {
        return "move"; // Spring은 src/main/resources/templates/move.html 파일을 찾습니다.
    }

    // URL: https://gwon.my/backend/move/api/logs
    // 역할: 로그 데이터를 JSON으로 반환하는 API 엔드포인트입니다.
    @GetMapping("/api/logs")
    @ResponseBody // HTML이 아닌 데이터를 반환함을 명시
    public List<String> getLogsApi() {
        return messageHandler.getLogs();
    }
    
    // URL: https://gwon.my/backend/move/api/create
    // 역할: 예시로 POST 요청을 받아들이는 API 엔드포인트입니다.
    @PostMapping("/api/create")
    @ResponseBody
    public String createData(@RequestBody String data) {
        System.out.println("데이터 수신: " + data);
        return "데이터 수신 완료";
    }
}