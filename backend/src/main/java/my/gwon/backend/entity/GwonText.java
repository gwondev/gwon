package my.gwon.backend.entity;

import jakarta.persistence.*;

@Entity
@Table(name= "GwonText")
public class GwonText{
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String text;

    public GwonText(String text) {
        this.text = text;
    }

    public GwonText() {} // 기본 생성자



    public Long getId() {return id;}
    public String getText(){return text;}

    public void setId(Long id) {this.id = id;}
    public void setText(String text) {this.text= text;}
}