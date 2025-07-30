import { useEffect, useRef, useState } from 'react';
import { Box } from '@mui/material';
import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client';

function Move() {
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const stompClientRef = useRef(null);
  const [gps, setGps] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState('연결 중...');

  useEffect(() => {
    // STOMP 클라이언트 설정
    const stompClient = new Client({
      // SockJS를 사용하는 경우
      webSocketFactory: () => new SockJS('http://gwon.my/ws'),
      
      // 또는 일반 WebSocket을 사용하는 경우 (위 줄 대신 사용)
      // brokerURL: 'ws://gwon.my/ws',
      
      connectHeaders: {
        // 필요한 경우 인증 헤더 추가
      },
      
      debug: function (str) {
        console.log('🔧 STOMP Debug:', str);
      },
      
      reconnectDelay: 5000,
      heartbeatIncoming: 4000,
      heartbeatOutgoing: 4000,
    });

    // 연결 성공 시
    stompClient.onConnect = (frame) => {
      console.log('✅ STOMP 연결 성공:', frame);
      setConnectionStatus('연결됨');
      
      // GPS 데이터를 구독
      stompClient.subscribe('/topic/gps', (message) => {
        try {
          console.log('🧾 GPS 메시지 수신:', message.body);
          const gpsData = JSON.parse(message.body);
          setGps(gpsData);
        } catch (err) {
          console.error('❌ GPS 데이터 파싱 실패:', err);
        }
      });
      
      // 특정 기기의 GPS 데이터만 구독하려면
      // stompClient.subscribe('/topic/gps/device123', (message) => {
      //   // 처리 로직
      // });
    };

    // 연결 오류 시
    stompClient.onStompError = (frame) => {
      console.error('❌ STOMP 오류:', frame.headers['message']);
      console.error('상세:', frame.body);
      setConnectionStatus('연결 오류');
    };

    // 연결 해제 시
    stompClient.onDisconnect = () => {
      console.log('🔌 STOMP 연결 해제');
      setConnectionStatus('연결 해제됨');
    };

    // WebSocket 오류 시
    stompClient.onWebSocketError = (error) => {
      console.error('❌ WebSocket 오류:', error);
      setConnectionStatus('WebSocket 오류');
    };

    // 연결 시작
    stompClient.activate();
    stompClientRef.current = stompClient;

    // 클린업 함수
    return () => {
      if (stompClientRef.current) {
        stompClientRef.current.deactivate();
      }
    };
  }, []);

  // 카카오맵 초기화 및 GPS 데이터 업데이트
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

  // 메시지 전송 함수 (필요한 경우)
  const sendMessage = (destination, message) => {
    if (stompClientRef.current && stompClientRef.current.connected) {
      stompClientRef.current.publish({
        destination: destination,
        body: JSON.stringify(message)
      });
    } else {
      console.warn('⚠️ STOMP 연결이 없습니다');
    }
  };

  return (
    <Box>
      <h3>Move 실시간 GPS (STOMP)</h3>
      
      {/* 연결 상태 표시 */}
      <div style={{ 
        padding: '8px', 
        marginBottom: '10px', 
        backgroundColor: connectionStatus === '연결됨' ? '#e8f5e8' : '#ffe8e8',
        borderRadius: '4px',
        fontSize: '14px'
      }}>
        연결 상태: <strong>{connectionStatus}</strong>
      </div>

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
          ⏳ 위치 정보를 기다리는 중...
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