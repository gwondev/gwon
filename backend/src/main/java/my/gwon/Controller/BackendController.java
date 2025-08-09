package my.gwon.Controller;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;


@Controller

public class BackendController {
    @GetMapping("/")
    public String backend(){
        return "backend";
    }
}
