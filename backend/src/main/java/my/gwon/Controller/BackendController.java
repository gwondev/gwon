package my.gwon.Controller;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;

@Controller

public class BackendController {
    @GetMapping
    public String backend(){
        return "backend";
    }
}
