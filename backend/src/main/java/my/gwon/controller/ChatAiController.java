package my.gwon.controller;

import my.gwon.entity.ChatAi;
import my.gwon.repository.ChatAiRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/chat")
public class ChatAiController {

	private final ChatAiRepository chatAiRepository;
	private final org.springframework.messaging.simp.SimpMessagingTemplate messagingTemplate;

	public ChatAiController(ChatAiRepository chatAiRepository, org.springframework.messaging.simp.SimpMessagingTemplate messagingTemplate) {
		this.chatAiRepository = chatAiRepository;
		this.messagingTemplate = messagingTemplate;
	}

	// 클라이언트에서 질문/응답을 저장할 때 호출
	@PostMapping("")
	public ResponseEntity<Map<String, Object>> saveChat(@RequestBody Map<String, String> body) {
		String question = body.getOrDefault("question", "");
		String answer = body.getOrDefault("answer", "");
		ChatAi msg = new ChatAi(question, answer);
		chatAiRepository.save(msg);

		// 저장 후 실시간 알림 브로드캐스트 (/topic/chat)
		try {
			Map<String, Object> payload = Map.of(
					"id", msg.getId(),
					"question", msg.getQuestion(),
					"answer", msg.getAnswer(),
					"createdAt", msg.getCreatedAt()
			);
			messagingTemplate.convertAndSend("/topic/chat", payload);
		} catch (Exception ignored) {
		}

		return ResponseEntity.ok(Map.of("id", msg.getId(), "createdAt", msg.getCreatedAt()));
	}

}
