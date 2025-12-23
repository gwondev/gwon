import React, { useState, useEffect, useRef } from "react";
import { Client } from "@stomp/stompjs";
import SockJS from "sockjs-client";
import { Box, Stack, Typography, Paper, Chip, Button, CircularProgress } from "@mui/material";
import { MapContainer, TileLayer, Marker, Popup, useMap, Polyline } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import axios from "axios";

// ----------------------------------------------------
// ⚙️ 설정
// ----------------------------------------------------
const SOCKET_URL = "https://gwon.my/ws"; 
const TOPIC_SUBSCRIBE = "/topic/public"; 

// ----------------------------------------------------
// 🎨 스타일 및 아이콘 생성 함수
// ----------------------------------------------------
const GlobalStyles = () => (
  <style>{`
    @keyframes liquid-move {
      0% { transform: translateX(-50%) translateY(0) rotate(0deg); }
      50% { transform: translateX(-50%) translateY(-2%) rotate(2deg); }
      100% { transform: translateX(-50%) translateY(0) rotate(0deg); }
    }
    .leaflet-popup-content-wrapper {
      background: rgba(0,0,0,0.8) !important;
      color: white !important;
      border: 1px solid #333;
    }
    .leaflet-popup-tip {
      background: rgba(0,0,0,0.8) !important;
    }
    /* 숫자 마커 스타일 */
    .number-icon {
      background-color: #00E676;
      border: 2px solid #fff;
      border-radius: 50%;
      color: #000;
      font-weight: bold;
      font-size: 14px;
      text-align: center;
      line-height: 24px; /* height와 같게 */
      box-shadow: 0 0 10px rgba(0,230,118, 0.6);
    }
    .number-icon.start-point {
      background-color: #FF3D00 !important; /* 시작점은 붉은색 */
      color: white !important;
      z-index: 1000 !important;
    }
  `}</style>
);

const defaultIcon = new L.Icon({
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

const selectedIcon = new L.Icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

const createNumberIcon = (number) => {
  return new L.DivIcon({
    className: "", 
    html: `<div class="number-icon ${number === 1 ? 'start-point' : ''}" style="width: 24px; height: 24px;">${number}</div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });
};

// ----------------------------------------------------
// 🗺️ 지도 이동 제어
// ----------------------------------------------------
function MapClickFlyTo({ targetPosition, trigger }) {
  const map = useMap();
  useEffect(() => {
    if (targetPosition && targetPosition[0] !== 0) {
      map.flyTo(targetPosition, 16, { duration: 1.0 });
    }
  }, [trigger, targetPosition, map]);
  return null;
}

// ----------------------------------------------------
// 🛢️ 게이지 컴포넌트
// ----------------------------------------------------
const BigGauge = ({ data }) => {
  if (!data) return <Typography sx={{ color: "#555", mt: 10 }}>WAITING...</Typography>;

  const MAX_DEPTH = 100.0;
  const currentHeight = Number(data.height);
  let fillPercent = Math.max(0, Math.min(100, 100 - (currentHeight / MAX_DEPTH) * 100));

  let color = "#00E676";
  if (fillPercent > 50) color = "#FFEA00";
  if (fillPercent > 80) color = "#FF3D00";

  return (
    <Box sx={{ width: "100%", textAlign: "center" }}>
      <Typography variant="h3" sx={{ fontWeight: 900, color: "#fff" }}>{fillPercent.toFixed(1)}%</Typography>
      <Typography sx={{ color }}>{`DIST ${currentHeight.toFixed(2)} cm`}</Typography>
      <Box sx={{ mt: 3, mx: "auto", width: 180, height: 300, border: `4px solid ${color}`, borderRadius: 100, position: "relative", overflow: "hidden" }}>
        <Box sx={{ position: "absolute", bottom: 0, width: "100%", height: `${fillPercent}%`, bgcolor: color, transition: "height 0.5s", "&::before": { content: '""', position: "absolute", top: -20, width: "100%", height: 40, borderRadius: "50%", bgcolor: color, opacity: 0.6, animation: "liquid-move 3s infinite" }}} />
      </Box>
      <Paper sx={{ mt: 3, p: 2, bgcolor: "rgba(255,255,255,0.05)", border: "1px solid #333" }}>
        <Typography sx={{ color: "#fff", fontWeight: "bold" }}>{data.operatorName}</Typography>
        <Typography variant="caption" sx={{ color: "#777" }}>ID {data.operatorId}</Typography>
      </Paper>
    </Box>
  );
};

// ----------------------------------------------------
// 🚀 메인 컴포넌트
// ----------------------------------------------------
export default function TraceTestPages() {
  const [bins, setBins] = useState([]);
  const [selectedBinId, setSelectedBinId] = useState(null); // 초기값 null
  const [connectionStatus, setConnectionStatus] = useState("DISCONNECTED");
  
  const [routePath, setRoutePath] = useState([]); 
  const [visitOrder, setVisitOrder] = useState({}); 
  const [isCalculating, setIsCalculating] = useState(false);
  
  const [zoomTarget, setZoomTarget] = useState(null);
  const [zoomTrigger, setZoomTrigger] = useState(0);

  const stompClientRef = useRef(null);

  useEffect(() => {
    const stompClient = new Client({
      webSocketFactory: () => new SockJS(SOCKET_URL),
      reconnectDelay: 5000,
      onConnect: () => {
        setConnectionStatus("CONNECTED");
        stompClient.subscribe(TOPIC_SUBSCRIBE, (message) => {
          try {
            const payload = JSON.parse(message.body);
            setBins((prev) => {
              const idx = prev.findIndex((b) => b.operatorId === payload.operatorId);
              if (idx !== -1) {
                const copy = [...prev];
                copy[idx] = { ...copy[idx], ...payload };
                return copy;
              }
              return [...prev, payload];
            });
          } catch (err) { console.error(err); }
        });
      },
      onStompError: (frame) => { setConnectionStatus("ERROR"); },
      onWebSocketClose: () => { setConnectionStatus("DISCONNECTED"); },
    });
    stompClient.activate();
    stompClientRef.current = stompClient;
    return () => { if (stompClientRef.current) stompClientRef.current.deactivate(); };
  }, []);

  // ------------------------------------------------------
  // 🛣️ 경로 계산 (Fix: ID가 0일 때도 동작하도록 수정)
  // ------------------------------------------------------
  const handleCalculateRoute = async () => {
    // 🛠️ FIX: !selectedBinId 라고 쓰면 0일 때 false가 되므로 === null로 체크
    if (selectedBinId === null) {
      alert("먼저 시작점이 될 쓰레기통(내 위치)을 지도에서 클릭해주세요!");
      return;
    }
    if (bins.length < 2) {
      alert("최적 경로를 계산하려면 최소 2개 이상의 지점이 필요합니다.");
      return;
    }

    setIsCalculating(true);
    setVisitOrder({}); 

    try {
      const startBin = bins.find(b => b.operatorId === selectedBinId);
      const otherBins = bins.filter(b => b.operatorId !== selectedBinId);
      const sortedBins = [startBin, ...otherBins];

      const coordinates = sortedBins.map((bin) => `${bin.lng},${bin.lat}`).join(";");

      const OSRM_URL = import.meta.env.VITE_OSRM_URL || 'https://gwon.my/osrm';

const url = `${OSRM_URL}/trip/v1/driving/${coordinates}?source=first&roundtrip=false&overview=full&geometries=geojson`;

      const response = await axios.get(url);

      if (response.data.code === "Ok" && response.data.trips.length > 0) {
        const trip = response.data.trips[0];
        
        const geoJsonCoords = trip.geometry.coordinates;
        const leafletCoords = geoJsonCoords.map((coord) => [coord[1], coord[0]]);
        setRoutePath(leafletCoords);

        const indices = trip.waypoint_indices; 
        const newVisitOrder = {};

        indices.forEach((originalIndex, order) => {
          const targetBin = sortedBins[originalIndex];
          if (targetBin) {
            newVisitOrder[targetBin.operatorId] = order + 1; 
          }
        });

        setVisitOrder(newVisitOrder);
        console.log(`최적 경로: ${sortedBins[0].operatorName} 기준, 총 거리 ${(trip.distance/1000).toFixed(2)}km`);
      }
    } catch (error) {
      console.error("TSP Error:", error);
      alert("경로 계산 실패. 잠시 후 다시 시도해주세요.");
    } finally {
      setIsCalculating(false);
    }
  };

  const handleMarkerClick = (bin) => {
    setSelectedBinId(bin.operatorId);
    setZoomTarget([bin.lat, bin.lng]); 
    setZoomTrigger(Date.now());
  };

  // 선택된 것이 없으면 0번째가 아니라 그냥 null일 수도 있음 (보여줄 때는 예외처리 필요)
  const current = bins.find((b) => b.operatorId === selectedBinId) || bins[0];

  return (
    <Box sx={{ height: "100vh", bgcolor: "#000" }}>
      <GlobalStyles />

      {/* Header */}
      <Box sx={{ height: 80, px: 4, borderBottom: "1px solid #222", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Typography variant="h3" sx={{ fontWeight: 900, letterSpacing: 6, background: "linear-gradient(45deg,#fff,#777)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
          TRACE
        </Typography>

        <Stack direction="row" spacing={2} alignItems="center">
          <Button 
            variant="contained" 
            onClick={handleCalculateRoute}
            disabled={isCalculating || bins.length < 2}
            sx={{ 
              bgcolor: isCalculating ? "#333" : "#2979FF",
              color: "white", fontWeight: "bold",
              "&:hover": { bgcolor: "#1565C0" }
            }}
          >
            {isCalculating ? (
              <> <CircularProgress size={20} sx={{ color: "white", mr: 1 }} /> 계산중... </>
            ) : (
              // 🛠️ FIX: selectedBinId가 0일 때도 텍스트가 뜨도록 !== null 체크
              selectedBinId !== null ? "이 위치 기준 최적 경로 (TSP)" : "먼저 시작점을 선택하세요"
            )}
          </Button>
          <Chip label={connectionStatus} sx={{ color: connectionStatus === "CONNECTED" ? "#00E676" : "#FF3D00", border: "1px solid" }} />
        </Stack>
      </Box>

      {/* Body */}
      <Stack direction="row" sx={{ height: "calc(100vh - 80px)" }}>
        {/* Map */}
        <Box sx={{ flex: 6 }}>
          <MapContainer center={[35.1408, 126.93]} zoom={13} style={{ height: "100%", background: "#111" }}>
            <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" />
            
            <MapClickFlyTo targetPosition={zoomTarget} trigger={zoomTrigger} />

            {routePath.length > 0 && (
              <Polyline positions={routePath} pathOptions={{ color: '#00E676', weight: 6, opacity: 0.8 }} />
            )}

            {bins.map((bin) => {
              const order = visitOrder[bin.operatorId];
              let iconToUse;

              if (order) {
                iconToUse = createNumberIcon(order);
              } else {
                iconToUse = selectedBinId === bin.operatorId ? selectedIcon : defaultIcon;
              }

              return (
                <Marker
                  key={`${bin.operatorName}-${bin.operatorId}`}
                  position={[bin.lat, bin.lng]}
                  icon={iconToUse}
                  eventHandlers={{ click: () => handleMarkerClick(bin) }}
                  zIndexOffset={order === 1 ? 1000 : 0} 
                >
                  <Popup>
                    <b>{order ? `[${order}번 방문]` : ''} {bin.operatorName}</b><br />
                    높이: {bin.height}cm
                  </Popup>
                </Marker>
              );
            })}
          </MapContainer>
        </Box>

        {/* Gauge */}
        <Box sx={{ flex: 4, bgcolor: "#080808", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <BigGauge data={current} />
        </Box>
      </Stack>
    </Box>
  );
}