import my.gwon.backend.socket.ClientWebSocketHandler;
import my.gwon.backend.socket.DeviceWebSocketHandler;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.socket.config.annotation.EnableWebSocket;
import org.springframework.web.socket.config.annotation.WebSocketConfigurer;
import org.springframework.web.socket.config.annotation.WebSocketHandlerRegistry;
import org.springframework.web.socket.WebSocketHandler;

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
