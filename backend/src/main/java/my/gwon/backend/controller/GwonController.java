package my.gwon.backend.controller;

import my.gwon.backend.entity.GwonText;
import my.gwon.backend.repository.GwonTextRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@Controller
@RequestMapping("/backend/api/gwon")
public class GwonController{
    @Autowired
    private GwonTextRepository gwonTextRepository;

    // 기본 API
    @GetMapping
    public ResponseEntity<String> gwonApi(){
        return ResponseEntity.ok("GWON 탭 API");
    }

    @PostMapping("/save")
    public ResponseEntity<String> saveText(@RequestBody GwonText gwonText) {
        try {
            gwonTextRepository.save(gwonText);
            return ResponseEntity.ok("success");
        } catch (Exception e) {
            return ResponseEntity.ok("error");
        }
    }


    @GetMapping("/texts")
    public ResponseEntity<List<GwonText>> getTexts() {
        List<GwonText> texts = gwonTextRepository.findAll();
        return ResponseEntity.ok(texts);
    }

    @DeleteMapping("/delete/{id}")
    public ResponseEntity<String> deleteText(@PathVariable Long id) {
        try {
            gwonTextRepository.deleteById(id);
            return ResponseEntity.ok("success");
        } catch (Exception e) {
            return ResponseEntity.ok("error");
        }
    }
}