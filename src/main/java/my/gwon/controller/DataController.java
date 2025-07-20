package my.gwon.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api")
public class DataController {

    @Autowired
    private SimpMessagingTemplate messagingTemplate;

    @PostMapping("/data")
    public String receiveData(@RequestBody String data) {
        messagingTemplate.convertAndSend("/topic/data", data);
        return "OK";
    }
}