package my.gwon.backend.controller;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.stereotype.Controller;


@Controller  
@RequestMapping("/")
public class RootController {
    
    @GetMapping()
    public String root() {
          System.out.println("Root controller 호출됨!"); // 이 로그가 나오는지 확인
        return "root";  // src/main/resources/templates/root.html 반환
    }
}