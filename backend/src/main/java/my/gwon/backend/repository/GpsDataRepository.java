package my.gwon.backend.repository;

import my.gwon.backend.entity.GpsData;
import org.springframework.data.jpa.repository.JpaRepository;

public interface GpsDataRepository extends JpaRepository<GpsData, Long> {
    // 필요 시 ID별, 시간별 필터링용 쿼리 작성 가능
}