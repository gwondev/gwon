package my.gwon.repository;

import my.gwon.entity.ChatAi;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface ChatAiRepository extends JpaRepository<ChatAi, Long> {

    
}
