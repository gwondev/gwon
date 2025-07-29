// 방법 1: 파일 완전 삭제
// MqttConfig.java 파일을 아예 삭제하세요!

// 방법 2: 또는 이렇게 수정
package my.gwon.backend.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.integration.annotation.ServiceActivator;
import org.springframework.integration.channel.DirectChannel;
import org.springframework.integration.mqtt.core.DefaultMqttPahoClientFactory;
import org.springframework.integration.mqtt.inbound.MqttPahoMessageDrivenChannelAdapter;
import org.springframework.messaging.MessageChannel;
import org.eclipse.paho.client.mqttv3.MqttConnectOptions;

@Configuration
public class MqttConfig {

    @Value("${mqtt.broker.url}")
    private String brokerUrl;

    @Value("${mqtt.topic}")
    private String topic;

    @Bean
    public MessageChannel mqttInputChannel() {
        return new DirectChannel();
    }

    @Bean
    public DefaultMqttPahoClientFactory mqttClientFactory() {
        DefaultMqttPahoClientFactory factory = new DefaultMqttPahoClientFactory();
        MqttConnectOptions options = new MqttConnectOptions();
        options.setServerURIs(new String[]{brokerUrl});
        options.setCleanSession(true);
        factory.setConnectionOptions(options);
        return factory;
    }

    @Bean
    public MqttPahoMessageDrivenChannelAdapter mqttInbound() {
        MqttPahoMessageDrivenChannelAdapter adapter =
                new MqttPahoMessageDrivenChannelAdapter("gwon-client", mqttClientFactory(), topic);
        adapter.setOutputChannel(mqttInputChannel()); // 이 줄이 핵심!
        adapter.setCompletionTimeout(5000);
        return adapter;
    }

    @ServiceActivator(inputChannel = "mqttInputChannel")
    public void handleGpsData(String gpsData) {
        System.out.println("GPS 데이터: " + gpsData);
    }
}