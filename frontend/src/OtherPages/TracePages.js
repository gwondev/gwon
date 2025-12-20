import React, { useState, useEffect, useRef } from "react";
import mqtt from "mqtt"; // npm install mqtt
import { Box, Stack, Typography, Paper, Chip } from "@mui/material";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// ----------------------------------------------------
// ⚙️ MQTT 설정 (브라우저용 웹소켓 접속)
// ----------------------------------------------------
// ⚠️ 중요: 브라우저는 tcp://(1883) 접속 불가. ws://(9001) 사용 필수.
const MQTT_BROKER_URL = "ws://gwon.my:9001"; 
const TOPIC_SUBSCRIBE = "TRACE/#"; // TRACE 밑의 모든 것 구독 (chosun, move 등 기관 상관없음)

// ----------------------------------------------------
// 🎨 스타일 & 아이콘 설정
// ----------------------------------------------------
const GlobalStyles = () => (
  <style>{`
    @keyframes liquid-move {
      0% { transform: translateX(-50%) translateY(0) rotate(0deg); }
      50% { transform: translateX(-50%) translateY(-2%) rotate(2deg); }
      100% { transform: translateX(-50%) translateY(0) rotate(0deg); }
    }
    .leaflet-popup-content-wrapper {
      background: rgba(0, 0, 0, 0.8) !important;
      color: white !important;
      backdrop-filter: blur(5px);
      border: 1px solid #333;
    }
    .leaflet-popup-tip { background: rgba(0, 0, 0, 0.8) !important; }
  `}</style>
);

// 기본 마커 (회색)
const defaultIcon = new L.Icon({
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
});

// 선택된 마커 (빨간색)
const selectedIcon = new L.Icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
});

// ----------------------------------------------------
// 🗺️ 지도 카메라 자동 이동
// ----------------------------------------------------
function MapUpdater({ center }) {
  const map = useMap();
  useEffect(() => {
    if (center && center[0] !== 0) {
      map.flyTo(center, 18, { duration: 1.5 });
    }
  }, [center, map]);
  return null;
}

// ----------------------------------------------------
// 🛢️ 대형 게이지 컴포넌트
// ----------------------------------------------------
const BigGauge = ({ data }) => {
  if (!data) return (
    <Typography sx={{ color: "#555", mt: 10, letterSpacing: "2px" }}>
      WAITING FOR DATA...
    </Typography>
  );

  // 아두이노에서 height(거리)를 보냄. 
  // 거리가 가까울수록(0에 가까울수록) 꽉 찬 것.
  const MAX_DEPTH = 100.0; // 통 깊이 100cm 가정
  const currentHeight = parseFloat(data.height);

  // 퍼센트 계산: 100 - (현재거리 / 최대깊이 * 100)
  let fillPercent = 0;
  if (currentHeight <= 5) fillPercent = 100; // 5cm 이내면 꽉 참
  else if (currentHeight >= MAX_DEPTH) fillPercent = 0;
  else fillPercent = Math.max(0, Math.min(100, 100 - ((currentHeight / MAX_DEPTH) * 100)));

  let color = "#00E676"; // 안참 (초록)
  if (fillPercent > 50) color = "#FFEA00"; // 반참 (노랑)
  if (fillPercent > 80) color = "#FF3D00"; // 꽉참 (빨강)

  return (
    <Box sx={{ position: "relative", width: "100%", height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
      <Stack alignItems="center" sx={{ mb: 4, zIndex: 2 }}>
        <Typography variant="h3" sx={{ fontWeight: 900, color: "#FFF", letterSpacing: "4px" }}>
          {fillPercent.toFixed(1)}%
        </Typography>
        <Typography variant="h6" sx={{ color: color, letterSpacing: "2px", fontWeight: "bold" }}>
          FILL LEVEL
        </Typography>
        <Typography variant="body2" sx={{ color: "#888", mt: 1 }}>
            SENSOR DIST: {currentHeight.toFixed(2)} cm
        </Typography>
        <Typography variant="caption" sx={{ color: "#666", mt: 0.5 }}>
            LAT: {data.lat.toFixed(6)} / LNG: {data.lng.toFixed(6)}
        </Typography>
      </Stack>
      
      {/* 액체 애니메이션 */}
      <Box sx={{ width: "180px", height: "300px", border: `4px solid ${color}`, borderRadius: "100px", position: "relative", overflow: "hidden", bgcolor: "rgba(255,255,255,0.05)", boxShadow: `0 0 30px ${color}40`, transition: "border-color 0.5s" }}>
        <Box sx={{ position: "absolute", bottom: 0, left: "50%", width: "300%", height: `${fillPercent}%`, bgcolor: color, opacity: 0.8, transition: "height 0.5s ease", transform: "translateX(-50%)", "&::before": { content: '""', position: "absolute", top: "-20px", left: 0, width: "100%", height: "40px", bgcolor: color, borderRadius: "40%", opacity: 0.6, animation: "liquid-move 3s linear infinite" }}} />
      </Box>

      <Paper elevation={0} sx={{ mt: 4, p: 2, width: "90%", bgcolor: "rgba(255,255,255,0.05)", border: "1px solid #333", textAlign: "center" }}>
        <Typography variant="subtitle1" sx={{ color: "#FFF", fontWeight: "bold" }}>
          {data.operatorName.toUpperCase()}
        </Typography>
        <Typography variant="caption" sx={{ color: "#666" }}>
          DEVICE ID: #{data.operatorId}
        </Typography>
      </Paper>
    </Box>
  );
};

// ----------------------------------------------------
// 🚀 메인 컴포넌트 (로그인 없음, MQTT 직결)
// ----------------------------------------------------
export default function TraceTestPages() {
  const [bins, setBins] = useState([]); 
  const [selectedBinId, setSelectedBinId] = useState(null); // operatorId 기준
  const [connectionStatus, setConnectionStatus] = useState("DISCONNECTED");
  const clientRef = useRef(null);

  useEffect(() => {
    // 1. MQTT 연결 시작
    console.log(`Connecting to Broker: ${MQTT_BROKER_URL}`);
    
    const client = mqtt.connect(MQTT_BROKER_URL, {
        clean: true,
        connectTimeout: 4000,
        reconnectPeriod: 2000,
        clientId: 'trace_web_' + Math.random().toString(16).substr(2, 8)
    });
    clientRef.current = client;

    // 2. 연결 성공 시
    client.on("connect", () => {
      console.log("✅ MQTT Connected!");
      setConnectionStatus("CONNECTED");
      
      // 3. 토픽 구독 (TRACE/# : TRACE 밑의 모든 것)
      client.subscribe(TOPIC_SUBSCRIBE, (err) => {
        if (!err) console.log(`📡 Subscribed to: ${TOPIC_SUBSCRIBE}`);
        else console.error("Subscribe Error:", err);
      });
    });

    // 4. 메시지 수신 처리
    client.on("message", (topic, message) => {
      try {
        const payload = JSON.parse(message.toString());
        // 아두이노 데이터 포맷: 
        // { "operatorName": "chosun", "operatorId": 0, "height": 12.34, "lat": 35.xxx, "lng": 126.xxx }
        
        console.log(`[MSG] ${topic}:`, payload);

        setBins((prevBins) => {
          // 동일한 기기(이름+ID)가 있는지 확인
          const index = prevBins.findIndex(
            (bin) => bin.operatorId === payload.operatorId && bin.operatorName === payload.operatorName
          );

          if (index !== -1) {
            // [업데이트] 기존 데이터 갱신
            const newBins = [...prevBins];
            newBins[index] = { ...newBins[index], ...payload };
            return newBins;
          } else {
            // [신규 추가] 처음 발견된 기기
            // 데이터가 처음 들어오면 자동으로 선택해줌 (UX)
            if (prevBins.length === 0) setSelectedBinId(payload.operatorId);
            return [...prevBins, payload];
          }
        });

      } catch (e) {
        console.error("JSON Parsing Error:", e);
      }
    });

    client.on("offline", () => setConnectionStatus("OFFLINE"));
    client.on("reconnect", () => setConnectionStatus("RECONNECTING"));

    // 컴포넌트 종료 시 연결 해제
    return () => {
      if (client) client.end();
    };
  }, []);

  // 현재 선택된 기기의 데이터 찾기
  // (같은 ID라도 기관명이 다를 수 있으나, 여기선 ID 우선 매칭 후 첫번째 것 선택)
  const currentSelectedData = bins.find(b => b.operatorId === selectedBinId) || bins[0] || null;

  return (
    <Box sx={{ width: "100%", height: "100vh", bgcolor: "#000000", fontFamily: "'Roboto', sans-serif", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <GlobalStyles />
      
      {/* --- Header --- */}
      <Box sx={{ height: "80px", borderBottom: "1px solid #222", bgcolor: "#050505", display: "flex", alignItems: "center", px: 4, justifyContent: "space-between", zIndex: 10 }}>
        <Stack>
          <Typography variant="h3" sx={{ fontWeight: 900, letterSpacing: "6px", background: "linear-gradient(45deg, #FFF, #888)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
            TRACE
          </Typography>
        </Stack>
        <Stack direction="row" spacing={3} alignItems="center">
           <Chip 
             label={connectionStatus} 
             size="small"
             sx={{ 
               bgcolor: connectionStatus === "CONNECTED" ? "rgba(0, 230, 118, 0.1)" : "rgba(255, 61, 0, 0.1)", 
               color: connectionStatus === "CONNECTED" ? "#00E676" : "#FF3D00",
               border: `1px solid ${connectionStatus === "CONNECTED" ? "#00E676" : "#FF3D00"}`,
               fontWeight: "bold"
             }} 
           />
           <Box sx={{ textAlign: "right" }}>
             <Typography variant="caption" sx={{ color: "#666" }}>ACTIVE NODES</Typography>
             <Typography variant="body2" sx={{ color: "#FFF", fontWeight: "bold" }}>{bins.length} UNITS</Typography>
           </Box>
        </Stack>
      </Box>

      {/* --- Main Content --- */}
      <Stack direction="row" sx={{ flex: 1, height: "calc(100vh - 80px)" }}>
        
        {/* 1. 지도 (왼쪽) */}
        <Box sx={{ flex: 6, position: "relative", borderRight: "1px solid #222" }}>
           <MapContainer center={[35.1408, 126.9300]} zoom={14} style={{ width: "100%", height: "100%", background: "#111" }}>
             <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" />
             
             {/* 데이터 들어오면 카메라 이동 */}
             {currentSelectedData && <MapUpdater center={[currentSelectedData.lat, currentSelectedData.lng]} />}
             
             {bins.map((bin) => (
               <Marker 
                 key={`${bin.operatorName}-${bin.operatorId}`}
                 position={[bin.lat, bin.lng]} 
                 icon={selectedBinId === bin.operatorId ? selectedIcon : defaultIcon}
                 eventHandlers={{ click: () => setSelectedBinId(bin.operatorId) }}
               >
                 <Popup>
                   <div style={{ textAlign: "center" }}>
                     <b>{bin.operatorName}</b> (ID: {bin.operatorId})<br/>
                     Dist: {bin.height}cm
                   </div>
                 </Popup>
               </Marker>
             ))}
           </MapContainer>
        </Box>

        {/* 2. 게이지 (오른쪽) */}
        <Box sx={{ flex: 4, bgcolor: "#080808", p: 4, display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}>
           <BigGauge data={currentSelectedData} />
        </Box>

      </Stack>
    </Box>
  );
}