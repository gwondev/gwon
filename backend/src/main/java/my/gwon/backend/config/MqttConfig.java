package my.gwon.backend.config;

import lombok.RequiredArgsConstructor;
import my.gwon.backend.socket.DeviceWebSocketHandler;
import org.eclipse.paho.client.mqttv3.MqttConnectOptions;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.integration.annotation.ServiceActivator;
import org.springframework.integration.channel.DirectChannel;
import org.springframework.integration.mqtt.core.DefaultMqttPahoClientFactory;
import org.springframework.integration.mqtt.inbound.MqttPahoMessageDrivenChannelAdapter;
import org.springframework.messaging.MessageChannel;

@Configuration
@RequiredArgsConstructor
public class MqttConfig {

    private final DeviceWebSocketHandler deviceWebSocketHandler;

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
        adapter.setOutputChannel(mqttInputChannel());
        adapter.setCompletionTimeout(5000);
        return adapter;
    }

    @ServiceActivator(inputChannel = "mqttInputChannel")
    public void handleGpsData(String gpsData) {
        System.out.println("📡 MQTT 수신: " + gpsData);
        deviceWebSocketHandler.broadcastToClients(gpsData);
    }
}
