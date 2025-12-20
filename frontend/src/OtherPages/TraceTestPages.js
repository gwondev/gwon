import React, { useState, useEffect, useRef } from "react";
import mqtt from "mqtt";
import { Box, Stack, Typography, Paper, Chip } from "@mui/material";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// ----------------------------------------------------
// ⚙️ MQTT 설정 (브로커 직구독)
// ----------------------------------------------------
const MQTT_BROKER_URL = "wss://gwon.my/mqtt";
const TOPIC_SUBSCRIBE = "TRACE/#";

// ----------------------------------------------------
// 🎨 글로벌 스타일
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
// 📍 마커 아이콘
// ----------------------------------------------------
const defaultIcon = new L.Icon({
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

const selectedIcon = new L.Icon({
  iconUrl:
    "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

// ----------------------------------------------------
// 🗺️ 지도 자동 이동
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
// 🛢️ 게이지 컴포넌트
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

      <Typography sx={{ color }}>{`DIST ${currentHeight.toFixed(
        2
      )} cm`}</Typography>

      <Box
        sx={{
          mt: 3,
          mx: "auto",
          width: 180,
          height: 300,
          border: `4px solid ${color}`,
          borderRadius: 100,
          position: "relative",
          overflow: "hidden",
        }}
      >
        <Box
          sx={{
            position: "absolute",
            bottom: 0,
            width: "100%",
            height: `${fillPercent}%`,
            bgcolor: color,
            transition: "height 0.5s",
            "&::before": {
              content: '""',
              position: "absolute",
              top: -20,
              width: "100%",
              height: 40,
              borderRadius: "50%",
              bgcolor: color,
              opacity: 0.6,
              animation: "liquid-move 3s infinite",
            },
          }}
        />
      </Box>

      <Paper
        sx={{
          mt: 3,
          p: 2,
          bgcolor: "rgba(255,255,255,0.05)",
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
  const clientRef = useRef(null);

  useEffect(() => {
    const client = mqtt.connect(MQTT_BROKER_URL, {
      protocol: "ws",          // 🔥 중요: 브로커 직구독 명시
      keepalive: 30,
      clean: true,
      reconnectPeriod: 2000,
      connectTimeout: 5000,
      clientId:
        "trace_web_" + Math.random().toString(16).slice(2),
    });

    clientRef.current = client;

    client.on("connect", () => {
      setConnectionStatus("CONNECTED");
      client.subscribe(TOPIC_SUBSCRIBE, { qos: 0 });
    });

    client.on("reconnect", () => setConnectionStatus("RECONNECTING"));
    client.on("offline", () => setConnectionStatus("OFFLINE"));
    client.on("error", () => setConnectionStatus("ERROR"));

    client.on("message", (topic, message) => {
      try {
        const payload = JSON.parse(message.toString());

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
      } catch {}
    });

    return () => client.end();
  }, []);

  const current = bins.find((b) => b.operatorId === selectedBinId) || bins[0];

  return (
    <Box sx={{ height: "100vh", bgcolor: "#000" }}>
      <GlobalStyles />

      {/* Header */}
      <Box
        sx={{
          height: 80,
          px: 4,
          borderBottom: "1px solid #222",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Typography
          variant="h3"
          sx={{
            fontWeight: 900,
            letterSpacing: 6,
            background: "linear-gradient(45deg,#fff,#777)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
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
                  selectedBinId === bin.operatorId
                    ? selectedIcon
                    : defaultIcon
                }
                eventHandlers={{
                  click: () => setSelectedBinId(bin.operatorId),
                }}
              >
                <Popup>
                  <b>{bin.operatorName}</b>
                  <br />
                  Dist: {bin.height}cm
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        </Box>

        {/* Gauge */}
        <Box
          sx={{
            flex: 4,
            bgcolor: "#080808",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <BigGauge data={current} />
        </Box>
      </Stack>
    </Box>
  );
}
