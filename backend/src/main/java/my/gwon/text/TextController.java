package my.gwon.text;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/text")
public class TextController {
    private TextRepo textRepo;

    public TextController(TextRepo textRepo) {
        this.textRepo = textRepo;
    }

    @GetMapping
    public List<Text> getAll() {
        return textRepo.findAll();
    }

    @PostMapping
    public Text create(@RequestBody Text text) {
        return textRepo.save(text);
    }

    @DeleteMapping("/{id}")
    public void delete(@PathVariable Long id) {
        textRepo.deleteById(id);
    }
}
