package my.gwon.controller;

import my.gwon.entity.Heart;
import my.gwon.repository.HeartRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/backend/like")
public class HeartController {

    private final HeartRepository heartRepository;

    public HeartController(HeartRepository heartRepository) {
        this.heartRepository = heartRepository;
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
        return ResponseEntity.ok(Map.of("count", heart.getCount()));
    }
}
