import React, { useState, useEffect } from "react";
import { Client } from "@stomp/stompjs";
import SockJS from "sockjs-client";
import { Box, Stack, Typography, Paper, Chip } from "@mui/material";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

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
// 🗺️ 지도 카메라 자동 이동 컴포넌트
// ----------------------------------------------------
function MapUpdater({ center }) {
  const map = useMap();
  useEffect(() => {
    if (center && center[0] !== 0) {
      // 데이터가 들어오면 해당 위치로 부드럽게 이동
      map.flyTo(center, 18, { duration: 1.5 });
    }
  }, [center, map]);
  return null;
}

// ----------------------------------------------------
// 🛢️ 대형 게이지 컴포넌트 (높이 시각화)
// ----------------------------------------------------
const BigGauge = ({ data }) => {
  if (!data) return (
    <Typography sx={{ color: "#555", mt: 10, letterSpacing: "2px" }}>
      WAITING FOR DATA...
    </Typography>
  );

  const maxDepth = 100; // 쓰레기통 깊이 설정 (cm)
  
  // 데이터가 튀는 것을 방지하기 위해 0~100 사이로 제한
  let rawPercent = ((maxDepth - data.height) / maxDepth) * 100;
  let fillPercent = Math.max(0, Math.min(100, rawPercent));

  // 상태별 색상 지정
  let color = "#00E676"; // 녹색 (여유)
  if (fillPercent > 50) color = "#FFEA00"; // 노랑 (중간)
  if (fillPercent > 80) color = "#FF3D00"; // 빨강 (가득 참)

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
            DISTANCE: {data.height.toFixed(2)} cm
        </Typography>
        <Typography variant="caption" sx={{ color: "#666", mt: 0.5 }}>
            LAT: {data.lat.toFixed(5)} / LNG: {data.lng.toFixed(5)}
        </Typography>
      </Stack>
      
      {/* 액체 애니메이션 */}
      <Box sx={{ width: "180px", height: "300px", border: `4px solid ${color}`, borderRadius: "100px", position: "relative", overflow: "hidden", bgcolor: "rgba(255,255,255,0.05)", boxShadow: `0 0 30px ${color}40`, transition: "border-color 0.5s" }}>
        <Box sx={{ position: "absolute", bottom: 0, left: "50%", width: "300%", height: `${fillPercent}%`, bgcolor: color, opacity: 0.8, transition: "height 0.5s ease", transform: "translateX(-50%)", "&::before": { content: '""', position: "absolute", top: "-20px", left: 0, width: "100%", height: "40px", bgcolor: color, borderRadius: "40%", opacity: 0.6, animation: "liquid-move 3s linear infinite" }}} />
      </Box>

      {/* 하단 정보창 */}
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
// 🚀 메인 페이지 (SockJS + STOMP)
// ----------------------------------------------------
export default function TracePage() {
  const [bins, setBins] = useState([]); // 수신된 기기 목록
  const [selectedBinId, setSelectedBinId] = useState(null); // 현재 보고 있는 기기 ID
  const [connectionStatus, setConnectionStatus] = useState("DISCONNECTED"); // 연결 상태

  useEffect(() => {
    // 1. STOMP 클라이언트 생성
    const client = new Client({
      // 💡 백엔드 Spring Boot (gwon.my/ws) 로 연결
      webSocketFactory: () => new SockJS("https://gwon.my/ws"),

      reconnectDelay: 5000,    // 끊기면 5초 뒤 재연결
      heartbeatIncoming: 4000,
      heartbeatOutgoing: 4000,

      // ✅ 연결 성공 시
      onConnect: () => {
        console.log("✅ WebSocket Connected!");
        setConnectionStatus("CONNECTED");

        // 2. 구독 (백엔드에서 MQTT 데이터를 이 경로로 보내줘야 함)
        client.subscribe("/topic/public", (message) => {
          try {
            const payload = JSON.parse(message.body);
            
            // 필수 데이터 확인
            if (!payload.operatorName) return;

            setBins((prevBins) => {
              // 이미 목록에 있는 기기인지 확인
              const index = prevBins.findIndex(
                (bin) => bin.operatorId === payload.operatorId && bin.operatorName === payload.operatorName
              );

              if (index !== -1) {
                // A. 기존 기기 -> 정보 업데이트 (불변성 유지)
                const newBins = [...prevBins];
                newBins[index] = { ...newBins[index], ...payload };
                return newBins;
              } else {
                // B. 새로운 기기 -> 목록에 추가
                // 첫 데이터라면 화면에 자동 선택
                if (prevBins.length === 0) setSelectedBinId(payload.operatorId);
                return [...prevBins, payload];
              }
            });
          } catch (e) {
            console.error("❌ Data Parsing Error:", e);
          }
        });
      },

      onStompError: (frame) => {
        console.error("❌ Broker Error:", frame.headers["message"]);
      },
      onWebSocketClose: () => {
        console.log("⚠️ Disconnected");
        setConnectionStatus("DISCONNECTED");
      }
    });

    // 3. 연결 시작
    client.activate();

    // 4. 컴포넌트 종료 시 연결 해제
    return () => {
      client.deactivate();
    };
  }, []);

  // 현재 선택된 기기의 데이터 추출
  const currentSelectedData = bins.find(b => b.operatorId === selectedBinId) || bins[0] || null;

  return (
    <Box sx={{ width: "100%", height: "100vh", bgcolor: "#000000", overflow: "hidden", display: "flex", flexDirection: "column" }}>
      <GlobalStyles />
      
      {/* --- Header --- */}
      <Box sx={{ height: "80px", borderBottom: "1px solid #222", bgcolor: "#050505", display: "flex", alignItems: "center", px: 4, justifyContent: "space-between", zIndex: 10 }}>
        <Stack>
          <Typography variant="h3" sx={{ fontWeight: 900, letterSpacing: "6px", fontFamily: "sans-serif", background: "linear-gradient(45deg, #FFF, #888)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
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
             <Typography variant="caption" sx={{ color: "#666" }}>NODES</Typography>
             <Typography variant="body2" sx={{ color: "#FFF", fontWeight: "bold" }}>{bins.length} UNITS</Typography>
           </Box>
        </Stack>
      </Box>

      {/* --- Main Content --- */}
      <Stack direction="row" sx={{ flex: 1, height: "calc(100vh - 80px)" }}>
        
        {/* 1. 지도 영역 (Left) */}
        <Box sx={{ flex: 6, position: "relative", borderRight: "1px solid #222" }}>
           {/* 초기 중심 좌표: 조선대학교 인근 */}
           <MapContainer center={[35.1408, 126.9300]} zoom={14} style={{ width: "100%", height: "100%", background: "#111" }}>
             <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" />
             
             {/* 데이터 수신 시 해당 위치로 카메라 이동 */}
             {currentSelectedData && <MapUpdater center={[currentSelectedData.lat, currentSelectedData.lng]} />}
             
             {/* 기기별 마커 표시 */}
             {bins.map((bin) => (
               bin.lat && bin.lng ? (
                 <Marker 
                   key={`${bin.operatorName}-${bin.operatorId}`}
                   position={[bin.lat, bin.lng]} 
                   icon={selectedBinId === bin.operatorId ? selectedIcon : defaultIcon}
                   eventHandlers={{ click: () => setSelectedBinId(bin.operatorId) }}
                 >
                   <Popup>
                     <div style={{ textAlign: "center" }}>
                       <b>{bin.operatorName}</b> (ID: {bin.operatorId})<br/>
                       Height: {bin.height.toFixed(1)}cm
                     </div>
                   </Popup>
                 </Marker>
               ) : null
             ))}
           </MapContainer>
        </Box>

        {/* 2. 게이지 영역 (Right) */}
        <Box sx={{ flex: 4, bgcolor: "#080808", p: 4, display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}>
           <BigGauge data={currentSelectedData} />
        </Box>

      </Stack>
    </Box>
  );
}