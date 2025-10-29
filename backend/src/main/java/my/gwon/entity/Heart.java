package my.gwon.entity;

import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import lombok.Getter;
import lombok.Setter;

@Entity
@Getter
@Setter
public class Heart {
    @Id
    private String id;
    private Long count = 0L;
}