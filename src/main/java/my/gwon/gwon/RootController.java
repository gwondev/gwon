package my.gwon.gwon;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;

@Controller
public class RootController {

    @GetMapping("/")
    public String home() {
        return "index";  // templates/index.html 이나 static/index.html 사용 시
    }
}
