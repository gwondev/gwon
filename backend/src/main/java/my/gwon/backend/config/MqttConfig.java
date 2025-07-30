package my.gwon.backend.config;

import org.eclipse.paho.client.mqttv3.MqttConnectOptions;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.integration.annotation.ServiceActivator;
import org.springframework.integration.channel.DirectChannel;
import org.springframework.integration.mqtt.core.DefaultMqttPahoClientFactory;
import org.springframework.integration.mqtt.inbound.MqttPahoMessageDrivenChannelAdapter;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.MessageHandler;
import org.springframework.messaging.MessagingException;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.ApplicationContext;

@Configuration
public class MqttConfig {

    @Value("${mqtt.broker.url}")
    private String brokerUrl;

    @Value("${mqtt.topic}")
    private String topic;

    @Autowired
    private ApplicationContext applicationContext;

    @Bean
    public MessageChannel mqttInputChannel() {
        return new DirectChannel();
    }

    @Bean
    public DefaultMqttPahoClientFactory mqttClientFactory() {
        DefaultMqttPahoClientFactory factory = new DefaultMqttPahoClientFactory();
        MqttConnectOptions options = new MqttConnectOptions();
        options.setServerURIs(new String[] { brokerUrl });
        options.setCleanSession(true);
        options.setKeepAliveInterval(60);
        options.setConnectionTimeout(30);
        factory.setConnectionOptions(options);
        return factory;
    }

    @Bean
    public MqttPahoMessageDrivenChannelAdapter mqttInbound() {
        MqttPahoMessageDrivenChannelAdapter adapter = new MqttPahoMessageDrivenChannelAdapter(
                "gwon-stomp-client",
                mqttClientFactory(), 
                topic);
        adapter.setOutputChannel(mqttInputChannel());
        return adapter;
    }

    // MessageHandler로 변경 (SimpMessagingTemplate 의존성 제거)
    @Bean
    @ServiceActivator(inputChannel = "mqttInputChannel")
    public MessageHandler mqttMessageHandler() {
        return message -> {
            try {
                String gpsData = message.getPayload().toString();
                System.out.println("🌉 MQTT 데이터 수신: " + gpsData);
                
                // SimpMessagingTemplate을 나중에 가져오기
                try {
                    SimpMessagingTemplate stompTemplate = applicationContext.getBean(SimpMessagingTemplate.class);
                    
                    // STOMP로 브로드캐스트
                    stompTemplate.convertAndSend("/topic/gps", gpsData);
                    stompTemplate.convertAndSend("/topic/gps/realtime", gpsData);
                    stompTemplate.convertAndSend("/topic/devices", "GPS 업데이트: " + System.currentTimeMillis());
                    
                    System.out.println("✅ MQTT → STOMP 브릿지 성공");
                } catch (Exception e) {
                    System.out.println("⚠️ STOMP 브로드캐스트 실패 (아직 준비되지 않음): " + e.getMessage());
                }
                
            } catch (Exception e) {
                System.err.println("❌ MQTT 메시지 처리 오류: " + e.getMessage());
            }
        };
    }
}