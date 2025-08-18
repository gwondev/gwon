package my.gwon.repository;

import my.gwon.entity.Like;
import my.gwon.entity.Text;
import org.springframework.data.jpa.repository.JpaRepository;

public interface LikeRepo extends JpaRepository<Like, Long>{}