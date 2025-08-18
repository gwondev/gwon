package my.gwon.Controller;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import my.gwon.entity.Like;
import my.gwon.repository.LikeRepo;
import org.springframework.web.bind.annotation.*;

@Slf4j
@RestController
@RequiredArgsConstructor
@RequestMapping("/like")
public class LikeController {
    private final LikeRepo repo;

    // 새로운 하트 row 생성 (count=0)
    @PostMapping("/new")
    public Like create() {
        return repo.save(new Like());
    }
    // 하트 클릭 → count++
    @PostMapping("/{id}")
    public int click(@PathVariable Long id) {
        Like like = repo.findById(id).orElseThrow();
        like.setCount(like.getCount() + 1);
        repo.save(like);
        log.info("❤️ Like {} -> {}", id, like.getCount());
        return like.getCount(); // 증가된 값만 반환
    }

    // 현재 카운트 조회
    @GetMapping("/{id}")
    public int get(@PathVariable Long id) {
        return repo.findById(id).map(Like::getCount).orElse(0);
    }
}
