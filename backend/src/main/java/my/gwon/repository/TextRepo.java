package my.gwon.repository;

import my.gwon.entity.Text;
import org.springframework.data.jpa.repository.JpaRepository;

public interface TextRepo extends JpaRepository<Text, Long>{}