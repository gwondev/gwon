package my.gwon.controller;

import my.gwon.entity.Heart;
import my.gwon.repository.HeartRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/like")
public class HeartController {

    private final HeartRepository heartRepository;
    private final SimpMessagingTemplate messagingTemplate;

    public HeartController(HeartRepository heartRepository, SimpMessagingTemplate messagingTemplate) {
        this.heartRepository = heartRepository;
        this.messagingTemplate = messagingTemplate;
    }

    @GetMapping("/{id}")
    public ResponseEntity<Map<String, Long>> getCount(@PathVariable String id) {
        Long count = heartRepository.findById(id).map(Heart::getCount).orElse(0L);
        return ResponseEntity.ok(Map.of("count", count));
    }

    @PostMapping("/{id}")
    @Transactional
    public ResponseEntity<Map<String, Long>> increment(@PathVariable String id) {
        Heart heart = heartRepository.findById(id).orElseGet(() -> new Heart(id, 0L));
        heart.setCount(heart.getCount() + 1);
        heartRepository.save(heart);

        // 실시간 알림 전송: 구독자에게 새로운 카운트를 브로드캐스트
        try {
            messagingTemplate.convertAndSend("/topic/like/" + id, Map.of("count", heart.getCount()));
        } catch (Exception ignored) {
            // 알림 전송 실패시에도 요청 처리는 계속함
        }

        return ResponseEntity.ok(Map.of("count", heart.getCount()));
    }
}
