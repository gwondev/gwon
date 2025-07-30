package my.gwon.backend.controller;

import my.gwon.backend.entity.GwonText;
import my.gwon.backend.repository.GwonTextRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import jakarta.transaction.Transactional;

import java.util.List;

@RestController
@RequestMapping("/backend/api/gwon")
public class GwonController {

    @Autowired
    private GwonTextRepository gwonTextRepository;

    @GetMapping
    public ResponseEntity<String> gwonApi() {
        return ResponseEntity.ok("GWON 탭 API");
    }

    @PostMapping("/save")
    public ResponseEntity<String> saveText(@RequestBody GwonText gwonText) {
        try {
            gwonTextRepository.save(gwonText);
            System.out.println("텍스트 저장 성공: " + gwonText.getText());
            return ResponseEntity.ok("success");
        } catch (Exception e) {
            System.err.println("텍스트 저장 실패: " + e.getMessage());
            return ResponseEntity.ok("error");
        }
    }

    @GetMapping("/texts")
    public ResponseEntity<List<GwonText>> getTexts() {
        try {
            List<GwonText> texts = gwonTextRepository.findAll();
            System.out.println("텍스트 조회 성공: " + texts.size() + "개");
            return ResponseEntity.ok(texts);
        } catch (Exception e) {
            System.err.println("텍스트 조회 실패: " + e.getMessage());
            return ResponseEntity.ok(List.of());
        }
    }

    @Transactional
    @DeleteMapping("/delete/{id}")
    public ResponseEntity<String> deleteText(@PathVariable Long id) {
        try {
            if (gwonTextRepository.existsById(id)) {
                gwonTextRepository.deleteById(id);
                System.out.println("텍스트 삭제 성공: ID " + id);
                return ResponseEntity.ok("success");
            } else {
                System.err.println("텍스트 삭제 실패: ID " + id + " 존재하지 않음");
                return ResponseEntity.ok("not_found");
            }
        } catch (Exception e) {
            System.err.println("텍스트 삭제 실패: " + e.getMessage());
            return ResponseEntity.ok("error");
        }
    }
}