package my.gwon.backend.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseBody;

import javax.sql.DataSource;
import java.sql.Connection;
@RestController
public class RootController {

    @GetMapping("/")
    public String root() {
        return "🟢 Spring 루트 정상 응답";
    }
}


@Controller
@RequestMapping("/backend")
public class BackendController{
    @GetMapping
    public String backendPage(){
        return "main";
    }



    @GetMapping("api/test")
    @ResponseBody
    public ResponseEntity<String> testApi(){
        return ResponseEntity.ok("TEST 탭 API");
    }

    @Autowired
    private DataSource dataSource;  // 이 줄을 클래스 상단에 추가

    @GetMapping("api/mysql-test")
    @ResponseBody
    public ResponseEntity<String> testMysql(){
        try (Connection connection = dataSource.getConnection()) {
            String dbName = connection.getCatalog();
            return ResponseEntity.ok("MySQL 연결 성공! 데이터베이스: " + dbName);
        } catch (Exception e) {
            return ResponseEntity.ok("MySQL 연결 실패: " + e.getMessage());
        }
    }


}


