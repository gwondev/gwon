package my.gwon.controller;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;


@Controller
public class BackendController {
    @GetMapping("/")
    public String backend(){
        return "backend";
    }

    @GetMapping("/move")
    public String move() {
        return "move"; // move.html 파일을 반환s
    }
}
