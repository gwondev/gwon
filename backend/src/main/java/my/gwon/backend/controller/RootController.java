package my.gwon.backend.controller;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.ResponseBody;


@Controller  
@RequestMapping("/")
public class RootController {
    
    @GetMapping()
    @ResponseBody  // 이 줄 추가
    public String root() {
        System.out.println("Root controller 호출됨!");
        return "루트 페이지 정상 작동!";  // HTML 파일 대신 문자열 직접 반환
    }
}