import React, { useState, useEffect, useRef } from "react";
import { Client } from "@stomp/stompjs";
import SockJS from "sockjs-client";
import { Box, Stack, Typography, Paper, Chip, Button, CircularProgress, useMediaQuery, useTheme } from "@mui/material";
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
    .number-icon {
      background-color: #00E676;
      border: 2px solid #fff;
      border-radius: 50%;
      color: #000;
      font-weight: bold;
      font-size: 14px;
      text-align: center;
      line-height: 24px;
      box-shadow: 0 0 10px rgba(0,230,118, 0.6);
    }
    .number-icon.start-point {
      background-color: #FF3D00 !important;
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
const BigGauge = ({ data, isMobile }) => {
  if (!data) return <Typography sx={{ color: "#555" }}>WAITING...</Typography>;

  const MAX_DEPTH = 100.0;
  const currentHeight = Number(data.height);
  let fillPercent = Math.max(0, Math.min(100, 100 - (currentHeight / MAX_DEPTH) * 100));

  let color = "#00E676";
  if (fillPercent > 50) color = "#FFEA00";
  if (fillPercent > 80) color = "#FF3D00";

  return (
    <Box sx={{ width: "100%", textAlign: "center", py: isMobile ? 1 : 0 }}>
      <Typography 
        variant={isMobile ? "h5" : "h3"}
        sx={{ fontWeight: 900, color: "#fff" }}
      >
        {fillPercent.toFixed(1)}%
      </Typography>
      <Typography sx={{ color, fontSize: isMobile ? 12 : 16 }}>
        {`DIST ${currentHeight.toFixed(2)} cm`}
      </Typography>
      <Box sx={{ 
        mt: isMobile ? 1 : 3, 
        mx: "auto", 
        width: isMobile ? 80 : 180,
        height: isMobile ? 120 : 300,
        border: `3px solid ${color}`, 
        borderRadius: 100, 
        position: "relative", 
        overflow: "hidden" 
      }}>
        <Box sx={{ 
          position: "absolute", 
          bottom: 0, 
          width: "100%", 
          height: `${fillPercent}%`, 
          bgcolor: color, 
          transition: "height 0.5s", 
          "&::before": { 
            content: '""', 
            position: "absolute", 
            top: -15, 
            width: "100%", 
            height: 30, 
            borderRadius: "50%", 
            bgcolor: color, 
            opacity: 0.6, 
            animation: "liquid-move 3s infinite" 
          }
        }} />
      </Box>
      <Paper sx={{ 
        mt: isMobile ? 1 : 3, 
        p: isMobile ? 1 : 2, 
        bgcolor: "rgba(255,255,255,0.05)", 
        border: "1px solid #333" 
      }}>
        <Typography sx={{ color: "#fff", fontWeight: "bold", fontSize: isMobile ? 12 : 16 }}>
          {data.operatorName}
        </Typography>
        <Typography variant="caption" sx={{ color: "#777", fontSize: isMobile ? 10 : 12 }}>
          ID {data.operatorId}
        </Typography>
      </Paper>
    </Box>
  );
};

// ----------------------------------------------------
// 🚀 메인 컴포넌트
// ----------------------------------------------------
export default function TraceTestPages() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const [bins, setBins] = useState([]);
  const [selectedBinId, setSelectedBinId] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState("DISCONNECTED");
  
  const [routePath, setRoutePath] = useState([]); 
  const [visitOrder, setVisitOrder] = useState({}); 
  const [isCalculating, setIsCalculating] = useState(false);
  const [routeInfo, setRouteInfo] = useState(null);
  
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

  const handleCalculateRoute = async () => {
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
    setRouteInfo(null);

    try {
      const startBin = bins.find(b => b.operatorId === selectedBinId);
      const otherBins = bins.filter(b => b.operatorId !== selectedBinId);
      const sortedBins = [startBin, ...otherBins];

      const coordinates = sortedBins.map((bin) => `${bin.lng},${bin.lat}`).join(";");

      const OSRM_URL = "https://gwon.my/osrm";
      const url = `${OSRM_URL}/trip/v1/driving/${coordinates}?source=first&destination=last&roundtrip=false&overview=full&geometries=geojson`;

      const response = await axios.get(url);

      if (response.data.code === "Ok" && response.data.trips && response.data.trips.length > 0) {
        const trip = response.data.trips[0];
        const waypoints = response.data.waypoints;
        
        const geoJsonCoords = trip.geometry.coordinates;
        const leafletCoords = geoJsonCoords.map((coord) => [coord[1], coord[0]]);
        setRoutePath(leafletCoords);

        const newVisitOrder = {};
        waypoints.forEach((wp, idx) => {
          const targetBin = sortedBins[idx];
          if (targetBin) {
            newVisitOrder[targetBin.operatorId] = wp.waypoint_index + 1;
          }
        });
        setVisitOrder(newVisitOrder);

        const totalDistance = (trip.distance / 1000).toFixed(2);
        const totalDuration = Math.round(trip.duration / 60);
        setRouteInfo({
          distance: totalDistance,
          duration: totalDuration,
          stops: waypoints.length
        });

        console.log(`최적 경로: ${startBin.operatorName} 기준, 총 거리 ${totalDistance}km, 예상 ${totalDuration}분`);
      }
    } catch (error) {
      console.error("TSP Error:", error);
      console.error("Response:", error.response?.data);
      alert("경로 계산 실패. 잠시 후 다시 시도해주세요.");
    } finally {
      setIsCalculating(false);
    }
  };

  const handleClearRoute = () => {
    setRoutePath([]);
    setVisitOrder({});
    setRouteInfo(null);
  };

  const handleMarkerClick = (bin) => {
    setSelectedBinId(bin.operatorId);
    setZoomTarget([bin.lat, bin.lng]); 
    setZoomTrigger(Date.now());
  };

  const current = bins.find((b) => b.operatorId === selectedBinId) || bins[0];

  const getButtonText = () => {
    if (isCalculating) {
      return "계산중...";
    }
    if (selectedBinId !== null) {
      return isMobile ? "TSP 계산" : "이 위치 기준 최적 경로 (TSP)";
    }
    return isMobile ? "시작점 선택" : "먼저 시작점을 선택하세요";
  };

  return (
    <Box sx={{ 
      height: "100dvh",
      bgcolor: "#000", 
      overflow: "hidden" 
    }}>
      <GlobalStyles />

      {/* Header */}
      <Box sx={{ 
        height: isMobile ? 50 : 80,
        px: isMobile ? 1.5 : 4, 
        borderBottom: "1px solid #222", 
        display: "flex", 
        alignItems: "center", 
        justifyContent: "space-between" 
      }}>
        <Typography 
          variant={isMobile ? "h6" : "h3"}
          sx={{ 
            fontWeight: 900, 
            letterSpacing: isMobile ? 2 : 6, 
            background: "linear-gradient(45deg,#fff,#777)", 
            WebkitBackgroundClip: "text", 
            WebkitTextFillColor: "transparent" 
          }}
        >
          TRACE
        </Typography>

        <Stack direction="row" spacing={0.5} alignItems="center">
          <Button 
            variant="contained" 
            onClick={handleCalculateRoute}
            disabled={isCalculating || bins.length < 2}
            size="small"
            sx={{ 
              bgcolor: isCalculating ? "#333" : "#2979FF",
              color: "white", 
              fontWeight: "bold",
              fontSize: isMobile ? 10 : 14,
              px: isMobile ? 1 : 2,
              py: isMobile ? 0.5 : 1,
              minWidth: "auto",
              whiteSpace: "nowrap",
              "&:hover": { bgcolor: "#1565C0" }
            }}
          >
            {isCalculating && <CircularProgress size={12} sx={{ color: "white", mr: 0.5 }} />}
            {getButtonText()}
          </Button>

          {routePath.length > 0 && (
            <Button
              variant="outlined"
              onClick={handleClearRoute}
              size="small"
              sx={{
                color: "#FF3D00",
                borderColor: "#FF3D00",
                fontSize: isMobile ? 10 : 13,
                px: isMobile ? 0.8 : 1.5,
                py: isMobile ? 0.3 : 0.8,
                minWidth: "auto",
                "&:hover": { bgcolor: "rgba(255,61,0,0.1)", borderColor: "#FF3D00" }
              }}
            >
              {isMobile ? "✕" : "경로 지우기"}
            </Button>
          )}

          <Chip 
            label={connectionStatus === "CONNECTED" ? "ON" : "OFF"} 
            size="small"
            sx={{ 
              color: connectionStatus === "CONNECTED" ? "#00E676" : "#FF3D00", 
              border: "1px solid",
              fontSize: 10,
              height: 24
            }} 
          />
        </Stack>
      </Box>

      {/* Body */}
      <Stack 
        direction={isMobile ? "column" : "row"} 
        sx={{ height: isMobile ? "calc(100dvh - 50px)" : "calc(100dvh - 80px)" }}
      >
        {/* Map */}
        <Box sx={{ 
          flex: isMobile ? "none" : 6, 
          height: isMobile ? "60%" : "100%",
          position: "relative" 
        }}>
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
                    <b>{order ? `[${order}번]` : ''} {bin.operatorName}</b><br />
                    높이: {bin.height}cm
                  </Popup>
                </Marker>
              );
            })}
          </MapContainer>

          {/* 경로 정보 오버레이 */}
          {routeInfo && (
            <Paper sx={{
              position: "absolute",
              bottom: 8,
              left: 8,
              zIndex: 1000,
              p: 1,
              bgcolor: "rgba(0,0,0,0.85)",
              border: "1px solid #00E676",
              borderRadius: 1
            }}>
              <Typography sx={{ color: "#00E676", fontWeight: "bold", fontSize: 12 }}>
                📍 {routeInfo.distance}km · {routeInfo.duration}분 · {routeInfo.stops}곳
              </Typography>
            </Paper>
          )}
        </Box>

        {/* Gauge */}
        <Box sx={{ 
          flex: isMobile ? "none" : 4, 
          height: isMobile ? "40%" : "100%",
          bgcolor: "#080808", 
          display: "flex", 
          alignItems: "center", 
          justifyContent: "center",
          overflow: "hidden"
        }}>
          <BigGauge data={current} isMobile={isMobile} />
        </Box>
      </Stack>
    </Box>
  );
}