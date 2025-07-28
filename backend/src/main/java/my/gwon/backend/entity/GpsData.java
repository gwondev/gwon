package my.gwon.backend.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

@Entity
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class GpsData {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String deviceId;   // ESP32 ID
    private String name;       // 차량명 또는 구분명
    private double lat;        // 위도
    private double lng;        // 경도
    private LocalDateTime timestamp;  // 수신 시간
}