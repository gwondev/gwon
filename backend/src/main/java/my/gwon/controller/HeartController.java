package my.gwon.controller;

import lombok.RequiredArgsConstructor;
import my.gwon.entity.Heart;
import my.gwon.repository.HeartRepository;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/backend/like")
@RequiredArgsConstructor
public class HeartController {

    private final HeartRepository heartRepository;

    @GetMapping("/{id}")
    public Long getHeartCount(@PathVariable String id) {
        return heartRepository.findById(id)
                .map(Heart::getCount)
                .orElse(0L);
    }

    @PostMapping("/{id}")
    public Long incrementHeart(@PathVariable String id) {
        Heart heart = heartRepository.findById(id)
                .orElseGet(() -> {
                    Heart newHeart = new Heart();
                    newHeart.setId(id);
                    return newHeart;
                });
        
        heart.setCount(heart.getCount() + 1);
        heartRepository.save(heart);
        return heart.getCount();
    }
}