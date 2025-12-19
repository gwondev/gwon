@Bean
    @ServiceActivator(inputChannel = "mqttInputChannel")
    public MessageHandler handler() {
        return message -> {
            // 1. MQTT 메시지 헤더와 페이로드 추출
            String topic = (String) message.getHeaders().get("mqtt_receivedTopic");
            String payload = message.getPayload().toString();

            // null 체크 (안전장치)
            if (topic == null) return;

            // 2. 분기 처리
            if (topic.startsWith("move/gps")) {
                // ----------------------------------------------------
                // CASE 1: GPS 데이터인 경우 (기존 로직 유지)
                // ----------------------------------------------------
                // 프론트에서 누가 보냈는지 식별해야 하므로 "topic"을 감싸서 보냄
                // 예: { "topic": "move/gps/user1", "payload": { "lat":... } }
                
                String json = "{ \"topic\": \"" + topic + "\", \"payload\": " + payload + " }";
                messagingTemplate.convertAndSend("/topic/gps", json);

            } else {
                // ----------------------------------------------------
                // CASE 2: 그 외 모든 경우 (그냥 흘려보내기)
                // ----------------------------------------------------
                // 가공 없이 들어온 Payload 그대로 전송
                // 경로를 분리하는 것이 좋습니다 (예: /topic/public)
                
                messagingTemplate.convertAndSend("/topic/public", payload);
            }
        };
    }