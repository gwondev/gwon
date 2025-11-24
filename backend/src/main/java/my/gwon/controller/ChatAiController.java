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
		try {
			System.out.println("[ChatAiController] incoming body: " + body);
			String question = body.getOrDefault("question", "");
			String answer = body.getOrDefault("answer", "");
			if (answer == null) answer = "";
			System.out.println("[ChatAiController] question length=" + (question==null?0:question.length()) + ", answer length=" + answer.length());
			ChatAi msg = new ChatAi(question, answer);
			ChatAi saved = chatAiRepository.save(msg);

			// 저장 후 실시간 알림 브로드캐스트 (/topic/chat)
			try {
				Map<String, Object> payload = Map.of(
						"id", saved.getId(),
						"question", saved.getQuestion(),
						"answer", saved.getAnswer(),
						"createdAt", saved.getCreatedAt()
				);
				messagingTemplate.convertAndSend("/topic/chat", payload);
			} catch (Exception ignored) {
				// 브로드캐스트 실패는 로그만 남기고 저장 결과는 반환
				ignored.printStackTrace();
			}

			return ResponseEntity.ok(Map.of("id", saved.getId(), "createdAt", saved.getCreatedAt()));
		} catch (Exception e) {
			// 상세한 스택트레이스를 로그에 남기고 클라이언트에 에러 메시지를 보냄
			e.printStackTrace();
			return ResponseEntity.status(500).body(Map.of("error", "server_error", "message", e.getMessage()));
		}
	}

}
