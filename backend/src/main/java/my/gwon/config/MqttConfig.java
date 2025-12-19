package my.gwon.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
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

import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

@Configuration
public class MqttConfig { // 👈 이 클래스 선언부가 지워져 있어서 에러가 난 것입니다.

    @Value("${mqtt.broker}")
    private String brokerUrl;

    @Value("${mqtt.topic}")
    private String topic;

    private final SimpMessagingTemplate messagingTemplate;
    private final ObjectMapper objectMapper = new ObjectMapper(); // JSON 변환기

    public MqttConfig(SimpMessagingTemplate messagingTemplate) {
        this.messagingTemplate = messagingTemplate;
    }

    @Bean
    public MqttPahoClientFactory mqttClientFactory() {
        return new DefaultMqttPahoClientFactory();
    }

    @Bean
    public MessageChannel mqttInputChannel() {
        return new DirectChannel();
    }

    @Bean
    public MessageProducer inbound(MqttPahoClientFactory factory) {
        String clientId = "spring-client-" + UUID.randomUUID();
        // topic이 와일드카드(#) 등을 포함해야 모든 메시지를 받을 수 있습니다.
        MqttPahoMessageDrivenChannelAdapter adapter =
                new MqttPahoMessageDrivenChannelAdapter(brokerUrl, clientId, factory, topic);

        adapter.setConverter(new DefaultPahoMessageConverter());
        adapter.setQos(1);
        adapter.setOutputChannel(mqttInputChannel());
        return adapter;
    }

    @Bean
    @ServiceActivator(inputChannel = "mqttInputChannel")
    public MessageHandler handler() {
        return message -> {
            // 1. MQTT 메시지 헤더와 페이로드 추출
            String topic = (String) message.getHeaders().get("mqtt_receivedTopic");
            String payload = message.getPayload().toString();

            if (topic == null) return;

            // 2. 분기 처리
            if (topic.startsWith("move/gps")) {
                // GPS 데이터: 기존 로직 유지 (JSON 수동 생성 -> ObjectMapper 사용 권장되나 기존 유지 요청 시 문자열 조합)
                // 하지만 안전하게 위에서 선언한 ObjectMapper를 쓰는 게 좋습니다. 일단 기존 요청 흐름대로 갑니다.
                String json = "{ \"topic\": \"" + topic + "\", \"payload\": " + payload + " }";
                messagingTemplate.convertAndSend("/topic/gps", json);

            } else {
                // 그 외(쓰레기통 센서 등): /topic/public으로 원본 그대로 전송
                messagingTemplate.convertAndSend("/topic/public", payload);
            }
        };
    }

} // 👈 닫는 괄호도 꼭 있어야 합니다.s