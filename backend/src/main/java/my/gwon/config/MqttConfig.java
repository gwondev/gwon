import React, { useState, useEffect, useRef } from "react";
import { Box, Stack, Typography, Paper } from "@mui/material";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// ----------------------------------------------------
// 🎨 스타일 & 아이콘
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

const defaultIcon = new L.Icon({
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
});

const selectedIcon = new L.Icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
});

// ----------------------------------------------------
// 🗺️ 지도 카메라 이동 (부드럽게)
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
      WAITING FOR SIGNAL...
    </Typography>
  );

  const maxDepth = 100; 
  let fillPercent = ((maxDepth - data.height) / maxDepth) * 100;
  fillPercent = Math.max(0, Math.min(100, fillPercent));

  let color = "#00E676"; 
  if (fillPercent > 50) color = "#FFEA00"; 
  if (fillPercent > 80) color = "#FF3D00"; 

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
           SENSOR: {data.height.toFixed(2)} cm
        </Typography>
      </Stack>
      <Box sx={{ width: "180px", height: "300px", border: `4px solid ${color}`, borderRadius: "100px", position: "relative", overflow: "hidden", bgcolor: "rgba(255,255,255,0.05)", boxShadow: `0 0 30px ${color}40`, transition: "border-color 0.5s" }}>
        <Box sx={{ position: "absolute", bottom: 0, left: "50%", width: "300%", height: `${fillPercent}%`, bgcolor: color, opacity: 0.8, transition: "height 1s ease", transform: "translateX(-50%)", "&::before": { content: '""', position: "absolute", top: "-20px", left: 0, width: "100%", height: "40px", bgcolor: color, borderRadius: "40%", opacity: 0.6, animation: "liquid-move 3s linear infinite" }}} />
      </Box>
      <Paper elevation={0} sx={{ mt: 4, p: 2, width: "90%", bgcolor: "rgba(255,255,255,0.05)", border: "1px solid #333", textAlign: "center" }}>
        <Typography variant="subtitle1" sx={{ color: "#FFF", fontWeight: "bold" }}>
          {data.operatorName.toUpperCase()}
        </Typography>
        <Typography variant="caption" sx={{ color: "#666" }}>
          ID: #{data.operatorId}
        </Typography>
      </Paper>
    </Box>
  );
};

// ----------------------------------------------------
// 🚀 메인 페이지 (라이브러리 X, 순수 웹소켓 구현)
// ----------------------------------------------------
export default function TracePage() {
  const [bins, setBins] = useState([]);
  const [selectedBinId, setSelectedBinId] = useState(null);
  const ws = useRef(null);

  useEffect(() => {
    // 1. SockJS가 켜진 백엔드에 '순수 웹소켓'으로 붙으려면 주소 뒤에 /websocket을 붙여야 함
    const socketUrl = "wss://gwon.my/ws/websocket"; 
    ws.current = new WebSocket(socketUrl);

    ws.current.onopen = () => {
      console.log("✅ WebSocket Connected (Native)");
      
      // 2. STOMP 연결 프레임 수동 전송
      // (이게 없으면 스프링이 연결을 끊어버립니다)
      const connectFrame = "CONNECT\naccept-version:1.1,1.0\nheart-beat:10000,10000\n\n\u0000";
      ws.current.send(connectFrame);
    };

    ws.current.onmessage = (event) => {
      const message = event.data;

      // 3. 서버가 연결됐다고 응답하면(CONNECTED) -> 구독(SUBSCRIBE) 요청
      if (message.includes("CONNECTED")) {
        console.log("✅ Broker Connected, Subscribing...");
        // 백엔드 MqttConfig에서 /topic/public으로 쏘고 있으므로 여기를 구독해야 함
        const subscribeFrame = "SUBSCRIBE\nid:sub-0\ndestination:/topic/public\n\n\u0000";
        ws.current.send(subscribeFrame);
      }
      
      // 4. 실제 데이터 메시지 처리 (MESSAGE)
      else if (message.includes("MESSAGE")) {
        try {
          // STOMP 메시지는 헤더와 바디가 빈 줄(\n\n)로 나뉩니다.
          const parts = message.split("\n\n");
          if (parts.length >= 2) {
            // 마지막에 붙은 Null 문자(\0) 제거하고 파싱
            let body = parts[1].replace(/\u0000/g, "");
            const payload = JSON.parse(body);

            // 데이터 유효성 검사 (operatorName이 없으면 무시)
            if (!payload.operatorName) return;

            setBins((prevBins) => {
              // 이미 있는 기기인지 찾기
              const existingIndex = prevBins.findIndex(
                (bin) => bin.operatorId === payload.operatorId && bin.operatorName === payload.operatorName
              );

              if (existingIndex !== -1) {
                // A. 있으면 값만 업데이트 (위치, 높이 등)
                const newBins = [...prevBins];
                newBins[existingIndex] = { ...newBins[existingIndex], ...payload };
                return newBins;
              } else {
                // B. 없으면 새로 추가
                // 첫 데이터면 자동으로 선택해서 크게 보여주기
                if (prevBins.length === 0) setSelectedBinId(payload.operatorId);
                return [...prevBins, payload];
              }
            });
          }
        } catch (e) {
          console.error("❌ Data Parsing Error:", e, message);
        }
      }
    };

    ws.current.onerror = (error) => {
      console.error("❌ WebSocket Error:", error);
    };

    return () => {
      if (ws.current) ws.current.close();
    };
  }, []);

  // 현재 선택된 기기의 데이터 찾기
  const currentSelectedData = bins.find(b => b.operatorId === selectedBinId) || bins[0] || null;

  return (
    <Box sx={{ width: "100%", height: "100vh", bgcolor: "#000000", overflow: "hidden", display: "flex", flexDirection: "column" }}>
      <GlobalStyles />
      
      {/* 헤더 */}
      <Box sx={{ height: "80px", borderBottom: "1px solid #222", bgcolor: "#050505", display: "flex", alignItems: "center", px: 4, justifyContent: "space-between", zIndex: 10 }}>
        <Stack>
          <Typography variant="h3" sx={{ fontWeight: 900, letterSpacing: "6px", fontFamily: "sans-serif", background: "linear-gradient(45deg, #FFF, #888)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
            TRACE
          </Typography>
        </Stack>
        <Stack direction="row" spacing={3}>
           <Box sx={{ textAlign: "right" }}>
             <Typography variant="caption" sx={{ color: "#666" }}>ACTIVE NODES</Typography>
             <Typography variant="body2" sx={{ color: "#FFF", fontWeight: "bold" }}>{bins.length} UNITS</Typography>
           </Box>
        </Stack>
      </Box>

      {/* 메인 콘텐츠 (좌측 지도 / 우측 게이지) */}
      <Stack direction="row" sx={{ flex: 1, height: "calc(100vh - 80px)" }}>
        
        {/* 지도 영역 */}
        <Box sx={{ flex: 6, position: "relative", borderRight: "1px solid #222" }}>
           <MapContainer center={[35.1408, 126.9300]} zoom={14} style={{ width: "100%", height: "100%", background: "#111" }}>
             <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" />
             
             {currentSelectedData && <MapUpdater center={[currentSelectedData.lat, currentSelectedData.lng]} />}
             
             {bins.map((bin) => (
               // 좌표가 유효할 때만 마커 표시
               bin.lat && bin.lng ? (
                 <Marker 
                   key={`${bin.operatorName}-${bin.operatorId}`}
                   position={[bin.lat, bin.lng]} 
                   icon={selectedBinId === bin.operatorId ? selectedIcon : defaultIcon}
                   eventHandlers={{ click: () => setSelectedBinId(bin.operatorId) }}
                 >
                   <Popup>
                     <div style={{ textAlign: "center" }}>
                       <b>{bin.operatorName}</b> (ID: {bin.operatorId})
                     </div>
                   </Popup>
                 </Marker>
               ) : null
             ))}
           </MapContainer>
        </Box>

        {/* 게이지 영역 */}
        <Box sx={{ flex: 4, bgcolor: "#080808", p: 4, display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}>
           <BigGauge data={currentSelectedData} />
        </Box>

      </Stack>
    </Box>
  );
}