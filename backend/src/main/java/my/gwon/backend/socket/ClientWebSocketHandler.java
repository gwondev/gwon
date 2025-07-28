package my.gwon.backend.socket;

import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;

public class ClientWebSocketHandler extends TextWebSocketHandler {

    @Override
    public void afterConnectionEstablished(WebSocketSession session) {
        ClientSessionManager.add(session);
        System.out.println("✅ React 연결됨: " + session.getId());
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, org.springframework.web.socket.CloseStatus status) {
        ClientSessionManager.remove(session);
        System.out.println("🔌 React 연결 끊김: " + session.getId());
    }
}
