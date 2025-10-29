package my.gwon;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.data.jpa.repository.config.EnableJpaRepositories;

@SpringBootApplication
@EnableJpaRepositories(basePackages = "my.gwon.repository")
public class GwonApplication {
	public static void main(String[] args) {
		SpringApplication.run(GwonApplication.class, args);
	}
}
