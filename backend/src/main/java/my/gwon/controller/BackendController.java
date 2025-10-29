package my.gwon.controller;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;

@Controller
@RequestMapping("/backend")
public class BackendController {

    // /backend → backend.html
    @GetMapping("")
    public String backendPage() {
        return "backend"; // templates/backend.html
    }

    // /backend/move → move.html
    @GetMapping("/move")
    public String movePage() {
        return "move"; // templates/move.html
    }
}
