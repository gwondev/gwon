import { useEffect, useRef, useState } from 'react';
import { Box, Button, TextField } from '@mui/material';
import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client';

function Move() {
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const stompClientRef = useRef(null);
  const [gps, setGps] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState('연결 중...');
  const [realtimeGps, setRealtimeGps] = useState(null);
  const [deviceStatus, setDeviceStatus] = useState('');
  const [requestMessage, setRequestMessage] = useState('');

  useEffect(() => {
    // STOMP 클라이언트 설정 (백엔드 구조에 완벽 매칭)
    const stompClient = new Client({
      // 백엔드 엔드포인트: /ws/gps (SockJS)
      webSocketFactory: () => new SockJS('/ws/gps'),
      
      debug: function (str) {
        console.log('🔧 STOMP Debug:', str);
      },
      
      // 백엔드 하트비트 설정과 동일
      reconnectDelay: 5000,
      heartbeatIncoming: 10000, // 백엔드: 10000ms
      heartbeatOutgoing: 10000,
    });

    // STOMP 연결 성공
    stompClient.onConnect = (frame) => {
      console.log('✅ STOMP 연결 성공:', frame);
      setConnectionStatus('연결됨');
      
      // 1. 메인 GPS 토픽 구독 (MqttConfig + GpsStompController)
      stompClient.subscribe('/topic/gps', (message) => {
        try {
          console.log('🧾 STOMP GPS 수신:', message.body);
          const parsed = JSON.parse(message.body);
          
          // 백엔드 GPS 데이터 매핑
          const gpsData = {
            id: parsed.deviceId,
            lat: parsed.lat,
            lng: parsed.lon,
            time: parsed.time,
            speed: parsed.speed,
            gyro: parsed.gyro
          };
          
          setGps(gpsData);
        } catch (err) {
          console.error('❌ GPS 파싱 실패:', err);
        }
      });

      // 2. 실시간 GPS 토픽 구독 (MqttConfig 추가 채널)
      stompClient.subscribe('/topic/gps/realtime', (message) => {
        try {
          console.log('⚡ STOMP 실시간 GPS:', message.body);
          const parsed = JSON.parse(message.body);
          setRealtimeGps(parsed);
        } catch (err) {
          console.error('❌ 실시간 GPS 파싱 실패:', err);
        }
      });

      // 3. 기기 상태 토픽 구독 (MqttConfig 디바이스 채널)
      stompClient.subscribe('/topic/devices', (message) => {
        console.log('📱 STOMP 디바이스 상태:', message.body);
        setDeviceStatus(message.body);
      });

      // 4. 구독 시 초기 메시지 받기 (GpsStompController @SubscribeMapping)
      console.log('🎯 STOMP 구독 완료 - 초기 메시지 대기중');
    };

    // STOMP 오류 처리
    stompClient.onStompError = (frame) => {
      console.error('❌ STOMP 오류:', frame.headers['message']);
      setConnectionStatus('STOMP 연결 오류');
    };

    stompClient.onDisconnect = () => {
      console.log('🔌 STOMP 연결 해제');
      setConnectionStatus('연결 해제됨');
    };

    stompClient.onWebSocketError = (error) => {
      console.error('❌ WebSocket 오류:', error);
      setConnectionStatus('WebSocket 오류');
    };

    // STOMP 활성화
    stompClient.activate();
    stompClientRef.current = stompClient;

    return () => {
      if (stompClientRef.current) {
        stompClientRef.current.deactivate();
      }
    };
  }, []);

  // 카카오맵 GPS 업데이트
  useEffect(() => {
    if (!window.kakao || !window.kakao.maps) return;

    if (!mapRef.current) {
      const container = document.getElementById('map');
      const options = {
        center: new window.kakao.maps.LatLng(35.143497, 126.931534),
        level: 3,
      };
      mapRef.current = new window.kakao.maps.Map(container, options);
      markerRef.current = new window.kakao.maps.Marker({
        map: mapRef.current,
        position: options.center,
      });
    }

    if (gps && mapRef.current && markerRef.current) {
      const newPos = new window.kakao.maps.LatLng(gps.lat, gps.lng);
      markerRef.current.setPosition(newPos);
      mapRef.current.setCenter(newPos);
    }
  }, [gps]);

  // STOMP 메시지 전송 함수 (GpsStompController @MessageMapping 사용)
  const sendGpsRequest = () => {
    if (stompClientRef.current && stompClientRef.current.connected) {
      // 백엔드 @MessageMapping("/gps/request")로 전송
      stompClientRef.current.publish({
        destination: '/app/gps/request', // /app prefix 사용
        body: requestMessage || 'GPS 데이터 요청'
      });
      console.log('📤 STOMP 요청 전송:', requestMessage);
      setRequestMessage('');
    } else {
      console.warn('⚠️ STOMP 연결이 없습니다');
    }
  };

  return (
    <Box>
      <h3>Move 실시간 GPS (완전한 STOMP)</h3>
      
      {/* STOMP 연결 상태 */}
      <div style={{ 
        padding: '8px', 
        marginBottom: '10px', 
        backgroundColor: connectionStatus === '연결됨' ? '#e8f5e8' : '#ffe8e8',
        borderRadius: '4px',
        fontSize: '14px'
      }}>
        STOMP 연결: <strong>{connectionStatus}</strong>
      </div>

      {/* 디바이스 상태 */}
      {deviceStatus && (
        <div style={{ 
          padding: '8px', 
          marginBottom: '10px', 
          backgroundColor: '#e8f4fd',
          borderRadius: '4px',
          fontSize: '12px'
        }}>
          📱 디바이스: <strong>{deviceStatus}</strong>
        </div>
      )}

      {/* STOMP 메시지 전송 */}
      <div style={{ marginBottom: '10px', display: 'flex', gap: '10px' }}>
        <TextField
          size="small"
          placeholder="GPS 요청 메시지 입력"
          value={requestMessage}
          onChange={(e) => setRequestMessage(e.target.value)}
          style={{ flex: 1 }}
        />
        <Button 
          variant="contained" 
          onClick={sendGpsRequest}
          disabled={connectionStatus !== '연결됨'}
        >
          STOMP 요청 전송
        </Button>
      </div>

      {/* GPS 데이터 테이블 */}
      {gps ? (
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '20px' }}>
          <thead>
            <tr style={{ backgroundColor: '#f5f5f5' }}>
              <th style={{ border: '1px solid #ddd', padding: '8px' }}>식별자</th>
              <th style={{ border: '1px solid #ddd', padding: '8px' }}>위도</th>
              <th style={{ border: '1px solid #ddd', padding: '8px' }}>경도</th>
              <th style={{ border: '1px solid #ddd', padding: '8px' }}>시간</th>
              <th style={{ border: '1px solid #ddd', padding: '8px' }}>속도</th>
              <th style={{ border: '1px solid #ddd', padding: '8px' }}>방향</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={{ border: '1px solid #ddd', padding: '8px' }}>{gps.id}</td>
              <td style={{ border: '1px solid #ddd', padding: '8px' }}>{gps.lat}</td>
              <td style={{ border: '1px solid #ddd', padding: '8px' }}>{gps.lng}</td>
              <td style={{ border: '1px solid #ddd', padding: '8px' }}>{gps.time}</td>
              <td style={{ border: '1px solid #ddd', padding: '8px' }}>{gps.speed} m/s</td>
              <td style={{ border: '1px solid #ddd', padding: '8px' }}>{gps.gyro}°</td>
            </tr>
          </tbody>
        </table>
      ) : (
        <div style={{ 
          padding: '20px', 
          textAlign: 'center', 
          backgroundColor: '#f9f9f9',
          borderRadius: '4px',
          marginBottom: '20px'
        }}>
          ⏳ STOMP GPS 데이터 대기중...
        </div>
      )}

      {/* 실시간 GPS 상태 (추가 채널) */}
      {realtimeGps && (
        <div style={{ 
          padding: '10px', 
          marginBottom: '10px', 
          backgroundColor: '#fff3cd',
          borderRadius: '4px',
          fontSize: '12px'
        }}>
          ⚡ 실시간: {realtimeGps.lat}, {realtimeGps.lon} | 속도: {realtimeGps.speed}m/s
        </div>
      )}
      
      <div id="map" style={{ 
        width: '100%', 
        height: '400px', 
        border: '1px solid #ddd',
        borderRadius: '4px'
      }} />
    </Box>
  );
}

export default Move;