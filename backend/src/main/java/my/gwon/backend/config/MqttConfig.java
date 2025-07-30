package my.gwon.backend.config;

import lombok.RequiredArgsConstructor;
import my.gwon.backend.controller.GpsStompController;

import org.eclipse.paho.client.mqttv3.MqttConnectOptions;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.integration.annotation.ServiceActivator;
import org.springframework.integration.channel.DirectChannel;
import org.springframework.integration.mqtt.core.DefaultMqttPahoClientFactory;
import org.springframework.integration.mqtt.inbound.MqttPahoMessageDrivenChannelAdapter;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.simp.SimpMessagingTemplate;

@Configuration
@RequiredArgsConstructor
public class MqttConfig {

    @Value("${mqtt.broker.url}")
    private String brokerUrl;

    @Value("${mqtt.topic}")
    private String topic;

    private final SimpMessagingTemplate stompTemplate;

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
        options.setKeepAliveInterval(60); // MQTT 연결 유지
        options.setConnectionTimeout(30); // MQTT 연결 타임아웃
        factory.setConnectionOptions(options);
        return factory;
    }

    @Bean
    public MqttPahoMessageDrivenChannelAdapter mqttInbound() {
        MqttPahoMessageDrivenChannelAdapter adapter = new MqttPahoMessageDrivenChannelAdapter(
                "gwon-stomp-client", // STOMP 클라이언트 ID
                mqttClientFactory(), 
                topic);
        adapter.setOutputChannel(mqttInputChannel());
     
        return adapter;
    }

    // MQTT → STOMP 브릿지 (여기가 핵심!)
    @ServiceActivator(inputChannel = "mqttInputChannel")
    public void mqttToStompBridge(String gpsData) {
        System.out.println("🌉 MQTT → STOMP 브릿지: " + gpsData);
        
        // STOMP 토픽으로 직접 전송
        stompTemplate.convertAndSend("/topic/gps", gpsData);
        
        // 추가 STOMP 채널들
        stompTemplate.convertAndSend("/topic/gps/realtime", gpsData);
        stompTemplate.convertAndSend("/topic/devices", "GPS 업데이트: " + System.currentTimeMillis());
    }
}