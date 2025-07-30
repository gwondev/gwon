package my.gwon.backend.controller;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.stereotype.Controller;


@Controller  
public class RootController {
    
    @GetMapping("/")
    public String root() {
        return "root";  // src/main/resources/templates/root.html 반환
    }
}