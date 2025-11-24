package my.gwon.controller;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import my.gwon.entity.ChatAi;
import my.gwon.repository.ChatAiRepository;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/chat")
public class ChatAiController {

	private final ChatAiRepository chatAiRepository;
	private final org.springframework.messaging.simp.SimpMessagingTemplate messagingTemplate;
	private final ObjectMapper objectMapper = new ObjectMapper();
	private final HttpClient httpClient = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10)).build();

	public ChatAiController(ChatAiRepository chatAiRepository, org.springframework.messaging.simp.SimpMessagingTemplate messagingTemplate) {
		this.chatAiRepository = chatAiRepository;
		this.messagingTemplate = messagingTemplate;
	}

	// 클라이언트에서 질문만 보내면 서버가 OpenAI에 질의하고 저장/응답함
	@PostMapping("")
	public ResponseEntity<Map<String, Object>> askAndSave(@RequestBody Map<String, String> body) {
		String question = body.getOrDefault("question", "").trim();
		if (question.isEmpty()) return ResponseEntity.badRequest().body(Map.of("error", "question required"));

		String openaiKey = System.getenv("OPENAI_API_KEY");
		if (openaiKey == null || openaiKey.isBlank()) {
			return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(Map.of("error", "OPENAI_API_KEY not set on server"));
		}

		try {
			// Build request payload for OpenAI Chat Completions
			Map<String, Object> payload = new HashMap<>();
			payload.put("model", "gpt-4o-mini");
			payload.put("max_tokens", 150);
			payload.put("temperature", 0.8);
			payload.put("messages", new Object[]{Map.of("role", "user", "content", question)});

			String reqBody = objectMapper.writeValueAsString(payload);

			HttpRequest req = HttpRequest.newBuilder()
					.uri(URI.create("https://api.openai.com/v1/chat/completions"))
					.timeout(Duration.ofSeconds(20))
					.header("Content-Type", "application/json")
					.header("Authorization", "Bearer " + openaiKey)
					.POST(HttpRequest.BodyPublishers.ofString(reqBody))
					.build();

			HttpResponse<String> resp = httpClient.send(req, HttpResponse.BodyHandlers.ofString());
			if (resp.statusCode() / 100 != 2) {
				return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(Map.of("error", "OpenAI API error", "status", resp.statusCode(), "body", resp.body()));
			}

			Map<String, Object> respMap = objectMapper.readValue(resp.body(), new TypeReference<Map<String, Object>>(){});
			// 안전하게 choices[0].message.content를 추출
			String answer = "";
			try {
				var choices = (java.util.List<Object>) respMap.get("choices");
				if (choices != null && !choices.isEmpty()) {
					var first = (Map<String, Object>) choices.get(0);
					var message = (Map<String, Object>) first.get("message");
					if (message != null && message.get("content") != null) answer = message.get("content").toString().trim();
				}
			} catch (Exception ignored) {}

			if (answer.isEmpty()) answer = "(응답 없음)";

			// DB 저장
			ChatAi msg = new ChatAi(question, answer);
			chatAiRepository.save(msg);

			// 브로드캐스트
			try {
				Map<String, Object> payloadOut = Map.of(
						"id", msg.getId(),
						"question", msg.getQuestion(),
						"answer", msg.getAnswer(),
						"createdAt", msg.getCreatedAt()
				);
				messagingTemplate.convertAndSend("/topic/chat", payloadOut);
			} catch (Exception ignored) {}

			return ResponseEntity.ok(Map.of("id", msg.getId(), "answer", answer, "createdAt", msg.getCreatedAt()));

		} catch (IOException | InterruptedException e) {
			return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(Map.of("error", "failed to call OpenAI", "message", e.getMessage()));
		}
	}

}
