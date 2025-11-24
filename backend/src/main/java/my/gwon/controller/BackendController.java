package my.gwon.controller;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;

@Controller
@RequestMapping("/admin")
public class BackendController {

    
    @GetMapping("")
    public String adminPage() {
        return "admin"; // templates/admin.html
    }

    @GetMapping("/move")
    public String movePage() {
        return "move"; // templates/move.html
    }
}
