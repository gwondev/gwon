// src/main/java/.../LikeController.java
package my.gwon.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@RestController
@RequiredArgsConstructor
public class LikeController {
    private final LikeRepo repo;

    @GetMapping("/")
    public String ok() {
        return "backend ok";
    }

    // 조회: 없으면 0
    @GetMapping("/like/{id}")
    public int get(@PathVariable Long id) {
        return repo.findById(id).map(Like::getCount).orElse(0);
    }

    // 증가: 없으면 새로 만들고 +1
    @PostMapping("/like/{id}")
    public int click(@PathVariable Long id) {
        Like like = repo.findById(id).orElseGet(() -> repo.save(new Like()));
        like.setCount(like.getCount() + 1);
        repo.save(like);
        return like.getCount();
    }
}
