package my.gwon.backend.repository;

import my.gwon.backend.entity.GwonText;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface GwonTextRepository extends JpaRepository<GwonText, Long> {
}