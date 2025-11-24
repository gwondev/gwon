package my.gwon.controller;

import my.gwon.entity.ChatMessage;
import my.gwon.entity.Heart;
import my.gwon.repository.ChatMessageRepository;
import my.gwon.repository.HeartRepository;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/backend/admin")
public class AdminController {

    private final HeartRepository heartRepository;
    private final ChatMessageRepository chatMessageRepository;

    public AdminController(HeartRepository heartRepository, ChatMessageRepository chatMessageRepository) {
        this.heartRepository = heartRepository;
        this.chatMessageRepository = chatMessageRepository;
    }

    @GetMapping("/list")
    public ResponseEntity<Map<String, Object>> listAll() {
        List<Heart> hearts = heartRepository.findAll();
        List<ChatMessage> chats = chatMessageRepository.findAll(PageRequest.of(0, 20, Sort.by(Sort.Direction.DESC, "createdAt"))).getContent();

        Map<String, Object> out = new HashMap<>();
        out.put("hearts", hearts);
        out.put("chats", chats);
        return ResponseEntity.ok(out);
    }
}
