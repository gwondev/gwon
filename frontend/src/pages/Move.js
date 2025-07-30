import React, { useEffect, useRef, useState, useCallback } from 'react';
import SockJS from 'sockjs-client';
import { Stomp } from '@stomp/stompjs';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Leaflet 기본 마커 아이콘 문제 해결
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
});

function Move() {
  const [stompClient, setStompClient] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState('연결 중...');
  const [currentGps, setCurrentGps] = useState('수신 대기 중...');
  const [markerPosition, setMarkerPosition] = useState([35.142667, 126.934639]); // 조선대 기준으로 변경
  const mapRef = useRef(null);

  // GPS 데이터를 지도에 업데이트
  const updateGpsOnMap = useCallback((gpsData) => {
    try {
      let latitude, longitude;

      // JSON 형태의 데이터인지 확인
      if (typeof gpsData === 'string' && gpsData.startsWith('{')) {
        const parsed = JSON.parse(gpsData);
        latitude = parseFloat(parsed.lat || parsed.latitude);
        longitude = parseFloat(parsed.lon || parsed.lng || parsed.longitude);
      } 
      // "위도,경도" 형태의 문자열인지 확인
      else if (typeof gpsData === 'string' && gpsData.includes(',')) {
        [latitude, longitude] = gpsData.split(',').map(Number);
      }
      // 이미 객체 형태인 경우
      else if (typeof gpsData === 'object') {
        latitude = parseFloat(gpsData.lat || gpsData.latitude);
        longitude = parseFloat(gpsData.lon || gpsData.lng || gpsData.longitude);
      }

      if (isNaN(latitude) || isNaN(longitude)) {
        console.error("유효하지 않은 GPS 데이터:", gpsData);
        return;
      }

      console.log(`📍 위치 업데이트: [${latitude}, ${longitude}]`);
      setMarkerPosition([latitude, longitude]);

      // 지도 중심 이동
      if (mapRef.current) {
        mapRef.current.setView([latitude, longitude], mapRef.current.getZoom());
      }

    } catch (e) {
      console.error("GPS 데이터 파싱 오류:", e);
    }
  }, []);

  // STOMP 연결 및 GPS 데이터 수신
  useEffect(() => {
    if (stompClient) return;

    console.log('🔌 STOMP 연결 시도 중...');
    
    // gwon.my 백엔드로 연결
    const socket = new SockJS('http://gwon.my/backend/ws/gps');
    const client = Stomp.over(socket);

    // 디버그 모드 활성화
    client.debug = (str) => console.log('[STOMP Debug]', str);

    client.connect({}, 
      // 연결 성공
      (frame) => {
        console.log('✅ STOMP 연결 성공:', frame);
        setConnectionStatus('연결됨');
        setStompClient(client);

        // GPS 데이터 토픽 구독
        client.subscribe('/topic/gps', (message) => {
          console.log('📡 GPS 데이터 수신:', message.body);
          setCurrentGps(message.body);
          updateGpsOnMap(message.body);
        });

        // 실시간 GPS 토픽도 구독
        client.subscribe('/topic/gps/realtime', (message) => {
          console.log('⚡ 실시간 GPS:', message.body);
          setCurrentGps(message.body);
          updateGpsOnMap(message.body);
        });

        // 디바이스 상태 토픽 구독
        client.subscribe('/topic/devices', (message) => {
          console.log('📱 디바이스 상태:', message.body);
        });

        // GPS 데이터 요청 (백엔드 GpsStompController의 @MessageMapping과 연결)
        try {
          client.send("/app/gps/request", {}, JSON.stringify({
            action: 'request',
            timestamp: new Date().toISOString()
          }));
          console.log('📤 GPS 데이터 요청 전송');
        } catch (sendError) {
          console.warn('⚠️ GPS 요청 전송 실패:', sendError);
        }
      },
      // 연결 실패
      (error) => {
        console.error('❌ STOMP 연결 오류:', error);
        setConnectionStatus(`연결 오류: ${error}`);
        
        // 5초 후 재연결 시도
        setTimeout(() => {
          console.log('🔄 재연결 시도...');
          setConnectionStatus('재연결 중...');
          setStompClient(null); // 상태 초기화로 재연결 트리거
        }, 5000);
      }
    );

    // WebSocket 연결 상태 모니터링
    socket.onopen = () => {
      console.log('🌐 WebSocket 연결 열림');
    };

    socket.onclose = (event) => {
      console.log('🔌 WebSocket 연결 닫힘:', event);
      setConnectionStatus('연결 해제됨');
    };

    socket.onerror = (error) => {
      console.error('❌ WebSocket 오류:', error);
      setConnectionStatus('WebSocket 오류');
    };

    // 컴포넌트 언마운트 시 정리
    return () => {
      if (client && client.connected) {
        client.disconnect(() => {
          console.log('🔌 STOMP 연결 해제됨');
          setConnectionStatus('연결 해제됨');
        });
      }
    };
  }, [stompClient, updateGpsOnMap]);

  // 수동 GPS 요청 함수
  const requestGpsData = () => {
    if (stompClient && stompClient.connected) {
      try {
        stompClient.send("/app/gps/request", {}, JSON.stringify({
          action: 'manual_request',
          timestamp: new Date().toISOString()
        }));
        console.log('📤 수동 GPS 데이터 요청');
      } catch (error) {
        console.error('❌ GPS 요청 실패:', error);
      }
    } else {
      console.warn('⚠️ STOMP 클라이언트가 연결되지 않음');
    }
  };

  return (
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      height: '100vh', 
      backgroundColor: '#f5f5f5',
      fontFamily: 'Arial, sans-serif'
    }}>
      {/* 헤더 */}
      <header style={{
        backgroundColor: '#2563eb',
        color: 'white',
        padding: '16px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
        borderRadius: '0 0 8px 8px'
      }}>
        <h1 style={{ 
          fontSize: '24px', 
          fontWeight: 'bold', 
          textAlign: 'center',
          margin: 0
        }}>
          🛰️ 실시간 GPS 추적 (Move Project)
        </h1>
      </header>

      {/* 메인 컨텐츠 */}
      <main style={{ 
        flexGrow: 1, 
        padding: '16px', 
        display: 'flex', 
        flexDirection: 'column', 
        alignItems: 'center'
      }}>
        {/* 상태 정보 */}
        <div style={{
          backgroundColor: 'white',
          padding: '16px',
          borderRadius: '8px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          marginBottom: '16px',
          width: '100%',
          maxWidth: '600px',
          textAlign: 'center'
        }}>
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '10px'
          }}>
            <div>
              <span style={{ fontSize: '16px', fontWeight: '600', color: '#374151' }}>
                연결 상태: 
              </span>
              <span style={{ 
                fontWeight: 'bold', 
                color: connectionStatus === '연결됨' ? '#10b981' : '#ef4444',
                marginLeft: '8px'
              }}>
                {connectionStatus}
              </span>
            </div>
            
            <button
              onClick={requestGpsData}
              disabled={connectionStatus !== '연결됨'}
              style={{
                padding: '8px 16px',
                backgroundColor: connectionStatus === '연결됨' ? '#10b981' : '#9ca3af',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: connectionStatus === '연결됨' ? 'pointer' : 'not-allowed',
                fontSize: '14px',
                fontWeight: '500'
              }}
            >
              📡 GPS 요청
            </button>
          </div>
          
          <div style={{ marginTop: '12px' }}>
            <span style={{ fontSize: '16px', fontWeight: '600', color: '#374151' }}>
              최신 GPS: 
            </span>
            <span style={{ 
              fontWeight: 'bold', 
              color: '#2563eb',
              marginLeft: '8px',
              fontSize: '14px',
              fontFamily: 'monospace'
            }}>
              {currentGps}
            </span>
          </div>
        </div>

        {/* 지도 컨테이너 */}
        <div style={{
          width: '100%',
          height: '500px',
          backgroundColor: '#e5e7eb',
          borderRadius: '8px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
          overflow: 'hidden',
          border: '2px solid #d1d5db'
        }}>
          <MapContainer
            center={markerPosition}
            zoom={15}
            scrollWheelZoom={true}
            style={{ height: '100%', width: '100%' }}
            whenCreated={(mapInstance) => { 
              mapRef.current = mapInstance;
              console.log('🗺️ 지도 인스턴스 생성됨');
            }}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <Marker position={markerPosition}>
              <Popup>
                <div style={{ textAlign: 'center' }}>
                  <strong>📍 현재 GPS 위치</strong><br />
                  위도: {markerPosition[0].toFixed(6)}<br />
                  경도: {markerPosition[1].toFixed(6)}<br />
                  <small style={{ color: '#666' }}>
                    업데이트: {new Date().toLocaleTimeString()}
                  </small>
                </div>
              </Popup>
            </Marker>
          </MapContainer>
        </div>
      </main>

      {/* 푸터 */}
      <footer style={{
        backgroundColor: '#e5e7eb',
        color: '#6b7280',
        padding: '12px',
        textAlign: 'center',
        fontSize: '14px',
        borderRadius: '8px 8px 0 0',
        boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.1)'
      }}>
        <p style={{ margin: 0 }}>
          &copy; 2025 gwon.my GPS 추적 시스템. MQTT → STOMP 실시간 연동
        </p>
        <p style={{ margin: '4px 0 0 0', fontSize: '12px' }}>
          Leaflet 지도 • Spring Boot • ESP32 IoT
        </p>
      </footer>
    </div>
  );
}

export default Move;