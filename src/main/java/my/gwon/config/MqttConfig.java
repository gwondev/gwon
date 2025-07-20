package my.gwon.config;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.integration.annotation.ServiceActivator;
import org.springframework.integration.channel.DirectChannel;
import org.springframework.integration.mqtt.core.DefaultMqttPahoClientFactory;
import org.springframework.integration.mqtt.inbound.MqttPahoMessageDrivenChannelAdapter;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.simp.SimpMessagingTemplate;

@Configuration
public class MqttConfig {

    @Autowired
    private SimpMessagingTemplate messagingTemplate;

    @Bean
    public MessageChannel mqttInputChannel() {
        return new DirectChannel();
    }

    @Bean
    public MqttPahoMessageDrivenChannelAdapter mqttInbound() {
        MqttPahoMessageDrivenChannelAdapter adapter =
                new MqttPahoMessageDrivenChannelAdapter("client", new DefaultMqttPahoClientFactory(), "gwon");
        adapter.setOutputChannel(mqttInputChannel());
        return adapter;
    }

    @ServiceActivator(inputChannel = "mqttInputChannel")
    public void receive(String message) {
        messagingTemplate.convertAndSend("/topic/data", message);
    }
}