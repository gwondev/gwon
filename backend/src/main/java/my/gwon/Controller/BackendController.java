package my.gwon.Controller;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;


@Controller

public class BackendController {
    @GetMapping("/")
    public String backend(){
        return "backend";
    }
    @GetMapping("/move")
    public String testMove() {
        return "move-test"; // 단순히 문자열을 반환하여 정상작동 확인
    }
}
