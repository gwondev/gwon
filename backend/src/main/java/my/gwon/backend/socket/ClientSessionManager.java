package my.gwon.backend.socket;

import org.springframework.web.socket.WebSocketSession;

import java.util.Collections;
import java.util.HashSet;
import java.util.Set;

public class ClientSessionManager {

    private static final Set<WebSocketSession> sessions = Collections.synchronizedSet(new HashSet<>());

    public static void add(WebSocketSession session) {
        sessions.add(session);
    }

    public static void remove(WebSocketSession session) {
        sessions.remove(session);
    }

    public static Set<WebSocketSession> getSessions() {
        return sessions;
    }
}
