import { useEffect, useRef, useState } from 'react';
import { Box } from '@mui/material';

function Move() {
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const [gps, setGps] = useState(null);

  useEffect(() => {
    const socket = new WebSocket("ws://gwon.my/socket");


    socket.onopen = () => {
      console.log("✅ WebSocket 연결 성공");
    };

    socket.onmessage = (event) => {
      try {
        console.log("🧾 원본 메시지:", event.data);
        const data = JSON.parse(event.data);
        setGps(data);
      } catch (err) {
        console.error("❌ JSON 파싱 실패:", err.message);
      }
    };

    socket.onerror = (e) => {``
      console.error("❌ WebSocket 오류:", e);
    };

    socket.onclose = () => {
      console.log("🔌 WebSocket 연결 종료");
    };

    return () => socket.close();
  }, []);

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

  return (
    <Box>
      <h3>Move 실시간 GPS</h3>
      {gps ? (
        <table>
          <thead>
            <tr>
              <th>식별자</th>
              <th>위도</th>
              <th>경도</th>
              <th>시간</th>
              <th>속도</th>
              <th>방향</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>{gps.id}</td>
              <td>{gps.lat}</td>
              <td>{gps.lng}</td>
              <td>{gps.time}</td>
              <td>{gps.speed} m/s</td>
              <td>{gps.gyro}°</td>
            </tr>
          </tbody>
        </table>
      ) : (
        <div>⏳ 위치 정보를 기다리는 중...</div>
      )}
      <div id="map" style={{ width: '100%', height: '400px', marginTop: '20px' }} />
    </Box>
  );
}

export default Move;
