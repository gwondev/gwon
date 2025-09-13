import React, { useEffect, useRef, useState } from "react";
import mqtt from "mqtt";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const MoveMainPages = () => {
  const mapContainerRef = useRef(null); // DOM 컨테이너
  const mapRef = useRef(null);          // Leaflet 지도 객체
  const markerRef = useRef(null);       // Leaflet 마커 객체
  const [gps, setGps] = useState(null); // MQTT로 받은 GPS 값

  // ✅ Leaflet 지도 초기화 (처음 1회만 실행)
  useEffect(() => {
    if (!mapRef.current) {
      const map = L.map(mapContainerRef.current).setView(
        [35.14389, 126.800003], // 초기 위치
        16
      );

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a> contributors',
      }).addTo(map);

      mapRef.current = map;
    }
  }, []);

  // ✅ MQTT 연결 (Mosquitto WebSocket)
  useEffect(() => {
    // ws:// 또는 wss:// (HTTPS 환경이면 wss://)
    const client = mqtt.connect("ws://gwon.my:9001"); // Mosquitto.conf에서 연 WebSocket 포트

    client.on("connect", () => {
      console.log("✅ MQTT 브로커 연결됨");
      // move/gps 하위 모든 토픽 구독
      client.subscribe("move/gps/#");
    });

    client.on("message", (topic, message) => {
      try {
        const data = JSON.parse(message.toString());
        console.log("📡 수신된 토픽:", topic, "메시지:", data);

        if (data.lat && data.lng) {
          setGps({
            lat: parseFloat(data.lat),
            lng: parseFloat(data.lng),
          });
        }
      } catch (err) {
        console.error("⚠️ JSON 파싱 실패:", message.toString());
      }
    });

    return () => client.end();
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
      <h2 style={{ textAlign: "center" }}>MOVE 실시간 위치 서비스 (MQTT 직접 구독)</h2>
      <div
        ref={mapContainerRef}
        style={{ width: "100%", height: "90%", border: "1px solid #ccc" }}
      />
    </div>
  );
};

export default MoveMainPages;
