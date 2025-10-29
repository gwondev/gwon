package my.gwon.repository;

import my.gwon.entity.Heart;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface HeartRepository extends JpaRepository<Heart, String> {
}