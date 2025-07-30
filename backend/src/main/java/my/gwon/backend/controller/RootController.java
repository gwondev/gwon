package my.gwon.backend.controller;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Controller;


@Controller  
@Order(1)
@RequestMapping("/")
public class RootController {
    
    @GetMapping()
    public String root() {
          System.out.println("Root controller 호출됨! 호출 되었습니다."); // 이 로그가 나오는지 확인
        return "root";  // src/main/resources/templates/root.html 반환
    }
    @GetMapping("/test")
    public String test() {
        return "Backend 정상 작동";
    }
    
    @GetMapping("/ws-test")
    public String wsTest() {
        return "WebSocket 엔드포인트 테스트";
    }
    
}