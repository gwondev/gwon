package my.gwon.backend.dto;

import lombok.Data;

@Data
public class GpsDto {
    private String id;
    private double lat;
    private double lng;
    private String time;
    private double speed;
    private double gyro;
}
