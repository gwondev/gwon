package my.gwon.controller;

import my.gwon.entity.ChatMessage;
import my.gwon.repository.ChatMessageRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/backend/chat")
public class ChatAiController {

	private final ChatMessageRepository chatMessageRepository;

	public ChatAiController(ChatMessageRepository chatMessageRepository) {
		this.chatMessageRepository = chatMessageRepository;
	}

	// 클라이언트에서 질문/응답을 저장할 때 호출
	@PostMapping("")
	public ResponseEntity<Map<String, Object>> saveChat(@RequestBody Map<String, String> body) {
		String question = body.getOrDefault("question", "");
		String answer = body.getOrDefault("answer", "");
		ChatMessage msg = new ChatMessage(question, answer);
		chatMessageRepository.save(msg);
		return ResponseEntity.ok(Map.of("id", msg.getId(), "createdAt", msg.getCreatedAt()));
	}

}
