import React, { useEffect, useRef, useState } from "react";
import mqtt from "mqtt";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const MoveMainPages = () => {
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef({});        // 토픽별 마커 저장
  const [devices, setDevices] = useState({}); // {topic: {lat, lng}}
  const [selectedTopic, setSelectedTopic] = useState(null);

  // ✅ Leaflet 지도 초기화
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

  // ✅ MQTT 연결
  useEffect(() => {
    const client = mqtt.connect("ws://gwon.my:9001");

    client.on("connect", () => {
      console.log("✅ MQTT 브로커 연결됨");
      client.subscribe("move/gps/#"); // 모든 토픽 구독
    });

    client.on("message", (topic, message) => {
      try {
        const data = JSON.parse(message.toString());
        if (data.lat && data.lng) {
          setDevices((prev) => ({
            ...prev,
            [topic]: { lat: parseFloat(data.lat), lng: parseFloat(data.lng) },
          }));
        }
      } catch (err) {
        console.error("⚠️ JSON 파싱 실패:", message.toString());
      }
    });

    return () => client.end();
  }, []);

  // ✅ 마커 업데이트
  useEffect(() => {
    if (!mapRef.current) return;

    Object.entries(devices).forEach(([topic, { lat, lng }]) => {
      if (!markersRef.current[topic]) {
        markersRef.current[topic] = L.marker([lat, lng]).addTo(mapRef.current)
          .bindPopup(`<b>${topic}</b>`);
      } else {
        markersRef.current[topic].setLatLng([lat, lng]);
      }
    });

    // 선택된 토픽 마커로 지도 이동
    if (selectedTopic && devices[selectedTopic]) {
      const { lat, lng } = devices[selectedTopic];
      mapRef.current.setView([lat, lng], 17);
      markersRef.current[selectedTopic].openPopup();
    }
  }, [devices, selectedTopic]);

  return (
    <div style={{ width: "100%", height: "100vh", display: "flex" }}>
      {/* 왼쪽: 토픽 리스트 */}
      <div style={{ width: "250px", borderRight: "1px solid #ccc", padding: "10px", overflowY: "auto" }}>
        <h3>📡 수신된 디바이스</h3>
        {Object.keys(devices).length === 0 && <p>아직 데이터 없음</p>}
        <ul style={{ listStyle: "none", padding: 0 }}>
          {Object.keys(devices).map((topic) => (
            <li
              key={topic}
              style={{
                cursor: "pointer",
                padding: "5px",
                margin: "3px 0",
                background: selectedTopic === topic ? "#d0ebff" : "#f1f3f5",
                borderRadius: "5px",
              }}
              onClick={() => setSelectedTopic(topic)}
            >
              {topic}
            </li>
          ))}
        </ul>
      </div>

      {/* 오른쪽: 지도 */}
      <div
        ref={mapContainerRef}
        style={{ flex: 1, height: "100%" }}
      />
    </div>
  );
};

export default MoveMainPages;
