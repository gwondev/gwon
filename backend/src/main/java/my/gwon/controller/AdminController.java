package my.gwon.controller;
import my.gwon.entity.ChatAi;
import my.gwon.entity.Heart;
import my.gwon.repository.ChatAiRepository;
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
@RequestMapping("/admin")
public class AdminController {

    private final HeartRepository heartRepository;
    private final ChatAiRepository chatAiRepository;

    public AdminController(HeartRepository heartRepository, ChatAiRepository chatAiRepository) {
        this.heartRepository = heartRepository;
        this.chatAiRepository = chatAiRepository;
    }

    @GetMapping("/list")
    public ResponseEntity<Map<String, Object>> listAll() {
        List<Heart> hearts = heartRepository.findAll();
        List<ChatAi> chats = chatAiRepository.findAll(PageRequest.of(0, 20, Sort.by(Sort.Direction.DESC, "createdAt"))).getContent();

        Map<String, Object> out = new HashMap<>();
        out.put("hearts", hearts);
        out.put("chats", chats);
        return ResponseEntity.ok(out);
    }
}
