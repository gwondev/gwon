package my.gwon.controller;

import lombok.RequiredArgsConstructor;
import my.gwon.entity.Heart;
import my.gwon.repository.HeartRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.Map;

@RestController
@RequestMapping("/backend/like")  // Caddy가 전체 경로를 전달하므로 /backend도 포함
@RequiredArgsConstructor
public class HeartController {

    private final HeartRepository heartRepository;

    @GetMapping("/{id}")
    public ResponseEntity<Map<String, Long>> getHeartCount(@PathVariable String id) {
        Long count = heartRepository.findById(id)
                .map(Heart::getCount)
                .orElse(0L);
        return ResponseEntity.ok(Map.of("count", count));
    }

    @PostMapping("/{id}")
    public ResponseEntity<Map<String, Long>> incrementHeart(@PathVariable String id) {
        Heart heart = heartRepository.findById(id)
                .orElseGet(() -> {
                    Heart newHeart = new Heart();
                    newHeart.setId(id);
                    newHeart.setCount(0L);
                    return newHeart;
                });
        
        heart.setCount(heart.getCount() + 1);
        heartRepository.save(heart);
        return ResponseEntity.ok(Map.of("count", heart.getCount()));
    }
}