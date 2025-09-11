import React, { useEffect, useRef, useState } from "react";
import { Client } from "@stomp/stompjs";
import SockJS from "sockjs-client";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const MoveMainPages = () => {
  const mapContainerRef = useRef(null); // DOM 컨테이너
  const mapRef = useRef(null);          // Leaflet 지도 객체
  const markerRef = useRef(null);       // Leaflet 마커 객체
  const [gps, setGps] = useState(null); // WebSocket으로 받은 GPS 값

  // ✅ Leaflet 지도 초기화 (처음 1회만 실행)
  useEffect(() => {
    if (!mapRef.current) {
      const map = L.map(mapContainerRef.current).setView(
        [35.14389, 126.800003],
        16
      );

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a> contributors',
      }).addTo(map);

      mapRef.current = map;
    }
  }, []);

  // ✅ STOMP WebSocket 연결 (절대 주소, HTTPS 환경이면 wss://)
  useEffect(() => {
    const client = new Client({
      webSocketFactory: () => new SockJS("https://gwon.my/ws"),
      reconnectDelay: 5000, // 자동 재연결 (5초)
      onConnect: () => {
        console.log("✅ WebSocket 연결됨");
        client.subscribe("/topic/gps", (message) => {
          try {
            const data = JSON.parse(message.body);
            console.log("수신된 GPS:", data);
            if (data.lat && data.lng) {
              setGps({
                lat: parseFloat(data.lat),
                lng: parseFloat(data.lng),
              });
            }
          } catch (err) {
            console.error("⚠️ JSON 파싱 실패:", message.body);
          }
        });
      },
    });

    client.activate();
    return () => client.deactivate();
  }, []);

  // ✅ GPS 값 업데이트 시 마커 이동
  useEffect(() => {
    if (gps && mapRef.current) {
      if (!markerRef.current) {
        // 첫 마커 생성
        markerRef.current = L.marker([gps.lat, gps.lng]).addTo(mapRef.current);
      } else {
        // 기존 마커 이동
        markerRef.current.setLatLng([gps.lat, gps.lng]);
      }
      mapRef.current.setView([gps.lat, gps.lng]);
    }
  }, [gps]);

  return (
    <div style={{ width: "100%", height: "100vh" }}>
      <h2 style={{ textAlign: "center" }}>MOVE 실시간 위치 서비스</h2>
      <div
        ref={mapContainerRef}
        style={{ width: "100%", height: "90%", border: "1px solid #ccc" }}
      />
    </div>
  );
};

export default MoveMainPages;
