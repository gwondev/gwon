package my.gwon.entity;

import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Column;

@Entity
public class Heart {

    @Id
    private String id;

    @Column(nullable = false)
    private Long count = 0L;

    public Heart() {}

    public Heart(String id, Long count) {
        this.id = id;
        this.count = count == null ? 0L : count;
    }

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public Long getCount() {
        return count == null ? 0L : count;
    }

    public void setCount(Long count) {
        this.count = count == null ? 0L : count;
    }
}
