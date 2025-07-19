package my.gwon

import org.springframework.boot.autoconfigure.SpringBootApplication
import org.springframework.boot.runApplication

@SpringBootApplication
class GwonApplication

fun main(args: Array<String>) {
	runApplication<GwonApplication>(*args)
}
