package my.gwon.text;

import org.springframework.data.jpa.repository.JpaRepository;

interface TextRepo extends JpaRepository<Text, Long>{}