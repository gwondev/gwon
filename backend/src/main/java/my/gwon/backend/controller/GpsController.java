package my.gwon.backend.controller;

import my.gwon.backend.entity.GpsData;
import my.gwon.backend.repository.GpsDataRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/gps")
public class GpsController {

    @Autowired
    private GpsDataRepository gpsDataRepository;

    @GetMapping
    public List<GpsData> getAllGpsData() {
        return gpsDataRepository.findAll();
    }
}