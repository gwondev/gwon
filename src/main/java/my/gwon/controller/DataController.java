package my.gwon.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.web.bind.annotation.*;

@RestController
public class DataController {
    @Autowired private SimpMessagingTemplate msg;

    @PostMapping("/api/data")
    public void send(@RequestBody String d) {
        msg.convertAndSend("/topic/data", d);
    }
}
