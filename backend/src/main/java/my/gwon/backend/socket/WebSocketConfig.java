package my.gwon.backend.socket;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.socket.WebSocketHandler;
import org.springframework.web.socket.config.annotation.EnableWebSocket;
import org.springframework.web.socket.config.annotation.WebSocketConfigurer;
import org.springframework.web.socket.config.annotation.WebSocketHandlerRegistry;

@Configuration
@EnableWebSocket
public class WebSocketConfig implements WebSocketConfigurer {

    @Override
    public void registerWebSocketHandlers(WebSocketHandlerRegistry registry) {
        registry.addHandler(deviceHandler(), "/ws").setAllowedOrigins("*");
        registry.addHandler(clientHandler(), "/client").setAllowedOrigins("*");
    }

    public WebSocketHandler deviceHandler() {
        return new DeviceWebSocketHandler();
    }

    public WebSocketHandler clientHandler() {
        return new ClientWebSocketHandler();
    }
}
