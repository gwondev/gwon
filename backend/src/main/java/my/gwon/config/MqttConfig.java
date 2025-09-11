import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.integration.annotation.ServiceActivator;
import org.springframework.integration.channel.DirectChannel;
import org.springframework.integration.core.MessageProducer;
import org.springframework.integration.mqtt.core.DefaultMqttPahoClientFactory;
import org.springframework.integration.mqtt.core.MqttPahoClientFactory;
import org.springframework.integration.mqtt.inbound.MqttPahoMessageDrivenChannelAdapter;
import org.springframework.integration.mqtt.support.DefaultPahoMessageConverter;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.MessageHandler;
import org.springframework.messaging.simp.SimpMessagingTemplate;

import java.util.UUID;

@Configuration
public class MqttConfig {

    private final String brokerUrl = "tcp://gwon.my:1883";  // MQTT 브로커
    private final String topic = "move/gps/#";             // 구독할 토픽 (전부)

    @Autowired
    private SimpMessagingTemplate messagingTemplate;       // WebSocket 브로드캐스트용

    @Bean
    public MqttPahoClientFactory mqttClientFactory() {
        return new DefaultMqttPahoClientFactory();
    }

    @Bean
    public MessageChannel mqttInputChannel() {
        return new DirectChannel();
    }

    @Bean
    public MessageProducer inbound(MqttPahoClientFactory mqttClientFactory) {
        // 동적 클라이언트 ID를 사용하여 여러 인스턴스 실행 시 충돌 방지
        String dynamicClientId = "spring-client-" + UUID.randomUUID().toString();
        
        MqttPahoMessageDrivenChannelAdapter adapter =
                new MqttPahoMessageDrivenChannelAdapter(brokerUrl, dynamicClientId, mqttClientFactory, topic);
        
        // 연결 해제 시 타임아웃 설정 (더 이상 사용되지 않는 setCompletionTimeout 대신)
        adapter.setDisconnectCompletionTimeout(5000); 
        
        adapter.setConverter(new DefaultPahoMessageConverter());
        adapter.setQos(1);
        adapter.setOutputChannel(mqttInputChannel());
        
        return adapter;
    }

    @Bean
    @ServiceActivator(inputChannel = "mqttInputChannel")
    public MessageHandler handler() {
        return message -> {
            // 페이로드를 byte[]로 가져와서 String으로 변환
            byte[] payloadBytes = (byte[]) message.getPayload();
            String payload = new String(payloadBytes);

            System.out.println("📡 MQTT 수신 : " + payload);

            // WebSocket 브로드캐스트
            messagingTemplate.convertAndSend("/topic/gps", payload);
        };
    }
}