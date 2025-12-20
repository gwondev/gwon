import React, { useState, useEffect, useRef } from "react";
// mqtt 제거하고 stompjs, sockjs-client 사용
import { Client } from "@stomp/stompjs";
import SockJS from "sockjs-client";
import { Box, Stack, Typography, Paper, Chip } from "@mui/material";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// ----------------------------------------------------
// ⚙️ 설정: Spring Boot 웹소켓 주소
// ----------------------------------------------------
// Caddy에서 /ws를 Spring Boot 8080으로 연결해두었으므로 이 주소 사용
const SOCKET_URL = "https://gwon.my/ws"; 
const TOPIC_SUBSCRIBE = "/topic/public"; // Spring Boot가 보내주는 경로

// ----------------------------------------------------
// 🎨 글로벌 스타일 (그대로 유지)
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
  `}</style>
);

// ----------------------------------------------------
// 📍 마커 아이콘 (그대로 유지)
// ----------------------------------------------------
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

// ----------------------------------------------------
// 🗺️ 지도 자동 이동 (그대로 유지)
// ----------------------------------------------------
function MapUpdater({ center }) {
  const map = useMap();
  useEffect(() => {
    if (center && center[0] !== 0) {
      map.flyTo(center, 18, { duration: 1.2 });
    }
  }, [center, map]);
  return null;
}

// ----------------------------------------------------
// 🛢️ 게이지 컴포넌트 (그대로 유지)
// ----------------------------------------------------
const BigGauge = ({ data }) => {
  if (!data)
    return (
      <Typography sx={{ color: "#555", mt: 10 }}>
        WAITING FOR DATA...
      </Typography>
    );

  const MAX_DEPTH = 100.0;
  const currentHeight = Number(data.height);

  let fillPercent = Math.max(
    0,
    Math.min(100, 100 - (currentHeight / MAX_DEPTH) * 100)
  );

  let color = "#00E676";
  if (fillPercent > 50) color = "#FFEA00";
  if (fillPercent > 80) color = "#FF3D00";

  return (
    <Box sx={{ width: "100%", textAlign: "center" }}>
      <Typography variant="h3" sx={{ fontWeight: 900, color: "#fff" }}>
        {fillPercent.toFixed(1)}%
      </Typography>

      <Typography sx={{ color }}>{`DIST ${currentHeight.toFixed(2)} cm`}</Typography>

      <Box
        sx={{
          mt: 3, mx: "auto", width: 180, height: 300,
          border: `4px solid ${color}`, borderRadius: 100,
          position: "relative", overflow: "hidden",
        }}
      >
        <Box
          sx={{
            position: "absolute", bottom: 0, width: "100%",
            height: `${fillPercent}%`, bgcolor: color,
            transition: "height 0.5s",
            "&::before": {
              content: '""', position: "absolute", top: -20,
              width: "100%", height: 40, borderRadius: "50%",
              bgcolor: color, opacity: 0.6,
              animation: "liquid-move 3s infinite",
            },
          }}
        />
      </Box>

      <Paper
        sx={{
          mt: 3, p: 2, bgcolor: "rgba(255,255,255,0.05)",
          border: "1px solid #333",
        }}
      >
        <Typography sx={{ color: "#fff", fontWeight: "bold" }}>
          {data.operatorName}
        </Typography>
        <Typography variant="caption" sx={{ color: "#777" }}>
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
  const [bins, setBins] = useState([]);
  const [selectedBinId, setSelectedBinId] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState("DISCONNECTED");
  const stompClientRef = useRef(null);

  useEffect(() => {
    // 1. STOMP 클라이언트 생성
    const stompClient = new Client({
      // SockJS를 통해 연결 (http -> ws 업그레이드)
      webSocketFactory: () => new SockJS(SOCKET_URL),
      reconnectDelay: 5000, // 끊어지면 5초 뒤 재연결
      heartbeatIncoming: 4000,
      heartbeatOutgoing: 4000,
      
      onConnect: () => {
        setConnectionStatus("CONNECTED");
        console.log(">>> STOMP Connected!");

        // 2. 구독 설정 (/topic/public)
        stompClient.subscribe(TOPIC_SUBSCRIBE, (message) => {
          try {
            // Spring이 보낸 body 문자열을 JSON 파싱
            const payload = JSON.parse(message.body);
            console.log("Received:", payload);

            setBins((prev) => {
              const idx = prev.findIndex(
                (b) =>
                  b.operatorId === payload.operatorId &&
                  b.operatorName === payload.operatorName
              );

              if (idx !== -1) {
                const copy = [...prev];
                copy[idx] = { ...copy[idx], ...payload };
                return copy;
              }

              if (prev.length === 0) setSelectedBinId(payload.operatorId);
              return [...prev, payload];
            });
          } catch (err) {
            console.error("JSON Parse Error:", err);
          }
        });
      },

      onStompError: (frame) => {
        console.error("Broker reported error: " + frame.headers["message"]);
        console.error("Additional details: " + frame.body);
        setConnectionStatus("ERROR");
      },

      onWebSocketClose: () => {
        console.log("WebSocket Disconnected");
        setConnectionStatus("DISCONNECTED");
      },
    });

    // 3. 연결 시작
    stompClient.activate();
    stompClientRef.current = stompClient;

    // 4. 컴포넌트 언마운트 시 연결 종료
    return () => {
      if (stompClientRef.current) {
        stompClientRef.current.deactivate();
      }
    };
  }, []);

  const current = bins.find((b) => b.operatorId === selectedBinId) || bins[0];

  return (
    <Box sx={{ height: "100vh", bgcolor: "#000" }}>
      <GlobalStyles />

      {/* Header */}
      <Box
        sx={{
          height: 80, px: 4, borderBottom: "1px solid #222",
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}
      >
        <Typography
          variant="h3"
          sx={{
            fontWeight: 900, letterSpacing: 6,
            background: "linear-gradient(45deg,#fff,#777)",
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
          }}
        >
          TRACE
        </Typography>

        <Chip
          label={connectionStatus}
          sx={{
            color: connectionStatus === "CONNECTED" ? "#00E676" : "#FF3D00",
            border: "1px solid",
          }}
        />
      </Box>

      {/* Body */}
      <Stack direction="row" sx={{ height: "calc(100vh - 80px)" }}>
        {/* Map */}
        <Box sx={{ flex: 6 }}>
          <MapContainer
            center={[35.1408, 126.93]}
            zoom={14}
            style={{ height: "100%", background: "#111" }}
          >
            <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" />

            {current && (
              <MapUpdater center={[current.lat, current.lng]} />
            )}

            {bins.map((bin) => (
              <Marker
                key={`${bin.operatorName}-${bin.operatorId}`}
                position={[bin.lat, bin.lng]}
                icon={
                  selectedBinId === bin.operatorId ? selectedIcon : defaultIcon
                }
                eventHandlers={{
                  click: () => setSelectedBinId(bin.operatorId),
                }}
              >
                <Popup>
                  <b>{bin.operatorName}</b><br />
                  Dist: {bin.height}cm
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        </Box>

        {/* Gauge */}
        <Box
          sx={{
            flex: 4, bgcolor: "#080808",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}
        >
          <BigGauge data={current} />
        </Box>
      </Stack>
    </Box>
  );
}