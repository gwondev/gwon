import React, { useState, useEffect, useRef } from "react";
import { Client } from "@stomp/stompjs";
import SockJS from "sockjs-client";
import {
  Box,
  Stack,
  TextField,
  Typography,
  Button,
  Chip,
  CircularProgress,
  useMediaQuery,
  useTheme,
  Paper,
} from "@mui/material";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  useMap,
  Polyline,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import axios from "axios";

// ----------------------------------------------------
// ⚙️ 설정
// ----------------------------------------------------
const SOCKET_URL = "https://gwon.my/ws";
const TOPIC_SUBSCRIBE = "/topic/public";
const MAX_DEPTH = 15.0; // 센서 기준 최대 깊이

// ----------------------------------------------------
// 🎨 스타일 및 아이콘
// ----------------------------------------------------
const GlobalStyles = () => (
  <style>{`
    @keyframes gradient-text {
      0% { background-position: 0% 50%; }
      50% { background-position: 100% 50%; }
      100% { background-position: 0% 50%; }
    }
    @keyframes float {
      0% { transform: translateY(0px); }
      50% { transform: translateY(-10px); }
      100% { transform: translateY(0px); }
    }

    /* ✅ 코드2 리퀴드 애니메이션 이식 */
    @keyframes liquid-move {
      0% { transform: translateX(-50%) translateY(0) rotate(0deg); }
      50% { transform: translateX(-50%) translateY(-2%) rotate(2deg); }
      100% { transform: translateX(-50%) translateY(0) rotate(0deg); }
    }

    .leaflet-popup-content-wrapper {
      background: rgba(0,0,0,0.85) !important;
      color: white !important;
      border: 1px solid #333;
      backdrop-filter: blur(5px);
    }
    .leaflet-popup-tip { background: rgba(0,0,0,0.85) !important; }

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

    ::-webkit-scrollbar { width: 6px; }
    ::-webkit-scrollbar-track { background: #111; }
    ::-webkit-scrollbar-thumb { background: #333; border-radius: 3px; }
  `}</style>
);

const defaultIcon = new L.Icon({
  iconUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
});

const selectedIcon = new L.Icon({
  iconUrl:
    "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
});

const createNumberIcon = (number) => {
  return new L.DivIcon({
    className: "",
    html: `<div class="number-icon ${
      number === 1 ? "start-point" : ""
    }" style="width: 24px; height: 24px;">${number}</div>`,
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
// 🛢️ [UI 이식] 코드2(BigGauge) 스타일을 2개(CAN/PLASTIC)로 확장
// ----------------------------------------------------
const PillGauge = ({ label, percent, isMobile, labelColor }) => {
  const p = Number(percent ?? 0);

  let color = "#00E676";
  if (p > 50) color = "#FFEA00";
  if (p > 80) color = "#FF3D00";

  return (
    <Box sx={{ width: "100%", textAlign: "center", py: isMobile ? 1 : 0 }}>
      <Typography
        variant={isMobile ? "h5" : "h3"}
        sx={{ fontWeight: 900, color: "#fff" }}
      >
        {p.toFixed(0)}%
      </Typography>

      <Typography
        sx={{
          color: labelColor || color,
          fontSize: isMobile ? 12 : 16,
          letterSpacing: "3px",
          fontWeight: "bold",
        }}
      >
        {label}
      </Typography>

      <Box
        sx={{
          mt: isMobile ? 1 : 3,
          mx: "auto",
          width: isMobile ? 72 : 150,
          height: isMobile ? 150 : 320,
          border: `3px solid ${color}`,
          borderRadius: 999,
          position: "relative",
          overflow: "hidden",
        }}
      >
        <Box
          sx={{
            position: "absolute",
            bottom: 0,
            width: "100%",
            height: `${p}%`,
            bgcolor: color,
            transition: "height 0.5s",
            "&::before": {
              content: '""',
              position: "absolute",
              top: -15,
              left: "50%",
              width: "110%",
              height: 30,
              borderRadius: "50%",
              bgcolor: color,
              opacity: 0.6,
              animation: "liquid-move 3s infinite",
            },
          }}
        />
      </Box>
    </Box>
  );
};

// ----------------------------------------------------
// 🏗️ [UI 이식] 선택된 쓰레기통 패널 (코드2 구조/배치 느낌)
// ----------------------------------------------------
const SelectedBinPanel = ({ bin, isMobile }) => {
  if (!bin)
    return (
      <Box
        sx={{
          height: "100%",
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "column",
          color: "#666",
        }}
      >
        <Typography variant="h6" sx={{ mb: 1, fontWeight: "bold" }}>
          TARGET NOT SELECTED
        </Typography>
        <Typography variant="caption">지도에서 쓰레기통을 선택하세요</Typography>
      </Box>
    );

  return (
    <Box
      sx={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: isMobile ? 1.5 : 3,
      }}
    >
      {/* 정보 카드 */}
      <Paper
        sx={{
          px: isMobile ? 2 : 3,
          py: isMobile ? 1 : 2,
          bgcolor: "rgba(255,255,255,0.05)",
          border: "1px solid #333",
          borderRadius: 2,
          textAlign: "center",
          width: "100%",
          maxWidth: 520,
        }}
      >
        <Typography
          sx={{
            color: "#fff",
            fontWeight: 900,
            fontSize: isMobile ? 14 : 18,
            letterSpacing: "2px",
          }}
        >
          {bin.operatorName.toUpperCase()}
        </Typography>
        <Typography
          variant="caption"
          sx={{ color: "#777", fontSize: isMobile ? 10 : 12 }}
        >
          DEVICE ID: #{bin.operatorId}
        </Typography>
      </Paper>

      {/* CAN / PLASTIC 2개 게이지 */}
      <Stack
        direction="row"
        spacing={isMobile ? 2 : 5}
        alignItems="center"
        justifyContent="center"
        sx={{ width: "100%", maxWidth: 520 }}
      >
        <Box sx={{ flex: 1 }}>
          <PillGauge
            label="CAN"
            percent={bin.cans}
            isMobile={isMobile}
            labelColor="#00B0FF"
          />
        </Box>
        <Box sx={{ flex: 1 }}>
          <PillGauge
            label="PLASTIC"
            percent={bin.plastic}
            isMobile={isMobile}
            labelColor="#FF4081"
          />
        </Box>
      </Stack>
    </Box>
  );
};

// ----------------------------------------------------
// 🔐 로그인 화면 (Code 1 디자인 유지)
// ----------------------------------------------------
const LoginScreen = ({ setScreen, input, setInput }) => (
  <Stack
    justifyContent="center"
    alignItems="center"
    sx={{
      width: "100%",
      height: "100vh",
      bgcolor: "#000000",
      position: "relative",
      overflow: "hidden",
    }}
  >
    {/* 배경 장식 */}
    <Box
      sx={{
        position: "absolute",
        top: "-10%",
        left: "-10%",
        width: "500px",
        height: "500px",
        borderRadius: "50%",
        background:
          "radial-gradient(circle, rgba(255,255,255,0.1) 0%, rgba(0,0,0,0) 70%)",
        filter: "blur(50px)",
      }}
    />
    <Box
      sx={{
        position: "absolute",
        bottom: "-10%",
        right: "-10%",
        width: "600px",
        height: "600px",
        borderRadius: "50%",
        background:
          "radial-gradient(circle, rgba(255,255,255,0.05) 0%, rgba(0,0,0,0) 70%)",
        filter: "blur(60px)",
      }}
    />

    <Stack
      alignItems="center"
      sx={{ zIndex: 2, animation: "float 6s ease-in-out infinite" }}
    >
      <Typography
        variant="h1"
        sx={{
          fontWeight: 900,
          letterSpacing: "8px",
          mb: 0,
          background: "linear-gradient(45deg, #FFFFFF, #757575, #FFFFFF)",
          backgroundSize: "200% 200%",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          animation: "gradient-text 5s ease infinite",
        }}
      >
        TRACE
      </Typography>
      <Typography
        variant="h6"
        sx={{ color: "#666", letterSpacing: "8px", mb: 6, fontWeight: "300" }}
      >
        경량형 쓰레기통 모니터링 시스템
      </Typography>
    </Stack>

    <Stack spacing={4} sx={{ width: "340px", zIndex: 2 }}>
      <TextField
        label="Organization Code"
        variant="outlined"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        sx={{
          "& .MuiInputBase-input": {
            color: "#FFFFFF",
            textAlign: "center",
            fontSize: "1.2rem",
            letterSpacing: "2px",
          },
          "& .MuiInputLabel-root": { color: "#888" },
          "& .MuiInputLabel-root.Mui-focused": { color: "#FFFFFF" },
          "& .MuiOutlinedInput-root": {
            borderRadius: "50px",
            bgcolor: "rgba(255,255,255,0.05)",
            "& fieldset": { borderColor: "#333" },
            "&:hover fieldset": { borderColor: "#888" },
            "&.Mui-focused fieldset": {
              borderColor: "#FFFFFF",
              borderWidth: "2px",
            },
          },
        }}
      />
      <Button
        variant="contained"
        size="large"
        sx={{
          borderRadius: "50px",
          py: 1.5,
          bgcolor: "#FFFFFF",
          color: "#000000",
          fontSize: "1.1rem",
          fontWeight: "900",
          letterSpacing: "2px",
          boxShadow: "0 0 20px rgba(255,255,255,0.3)",
          transition: "0.3s",
          "&:hover": {
            bgcolor: "#E0E0E0",
            transform: "scale(1.05)",
            boxShadow: "0 0 30px rgba(255,255,255,0.6)",
          },
        }}
        onClick={() => {
          if (input === "chosun") setScreen("main");
          else alert("Access Denied: Invalid Code");
        }}
      >
        SYSTEM LOGIN
      </Button>
    </Stack>
  </Stack>
);

// ----------------------------------------------------
// 🚀 메인 컴포넌트 (코드1 로직 그대로 + UI만 이식)
// ----------------------------------------------------
export default function TressPages() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));

  const [screen, setScreen] = useState("login");
  const [input, setInput] = useState("");

  const initialTrashBins = [
    {
      id: 0,
      operatorId: 0,
      operatorName: "chosun",
      lat: 35.1402390,
      lng: 126.9341972,
      cans: 0,
      plastic: 0,
    },
    {
      id: 1,
      operatorId: 1,
      operatorName: "chosun",
      lat: 35.1485641,
      lng: 126.9360698,
      cans: 0,
      plastic: 0,
    },
    {
      id: 2,
      operatorId: 2,
      operatorName: "chosun",
      lat: 35.1389457,
      lng: 126.9265309,
      cans: 0,
      plastic: 0,
    },
  ];

  const [bins, setBins] = useState(initialTrashBins);
  const [selectedBinId, setSelectedBinId] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState("DISCONNECTED");

  const [routePath, setRoutePath] = useState([]);
  const [visitOrder, setVisitOrder] = useState({});
  const [isCalculating, setIsCalculating] = useState(false);
  const [routeInfo, setRouteInfo] = useState(null);

  const [zoomTarget, setZoomTarget] = useState(null);
  const [zoomTrigger, setZoomTrigger] = useState(0);

  const stompClientRef = useRef(null);

  const toPercent = (height) => {
    if (!height && height !== 0) return 0;
    const h = parseFloat(height);
    if (h <= 2) return 100;
    if (h >= MAX_DEPTH) return 0;
    return Math.max(0, Math.min(100, 100 - (h / MAX_DEPTH) * 100));
  };

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
              const percentVal = toPercent(payload.height);

              if (idx !== -1) {
                const copy = [...prev];
                const target = copy[idx];

                if (payload.sortType === "can") target.cans = percentVal;
                if (payload.sortType === "pla") target.plastic = percentVal;

                target.lat = payload.lat;
                target.lng = payload.lng;

                return copy;
              }

              return [
                ...prev,
                {
                  id: payload.operatorId,
                  operatorId: payload.operatorId,
                  operatorName: payload.operatorName,
                  lat: payload.lat,
                  lng: payload.lng,
                  cans: payload.sortType === "can" ? percentVal : 0,
                  plastic: payload.sortType === "pla" ? percentVal : 0,
                },
              ];
            });
          } catch (err) {
            console.error(err);
          }
        });
      },
      onStompError: () => {
        setConnectionStatus("ERROR");
      },
      onWebSocketClose: () => {
        setConnectionStatus("DISCONNECTED");
      },
    });

    stompClient.activate();
    stompClientRef.current = stompClient;

    return () => {
      if (stompClientRef.current) stompClientRef.current.deactivate();
    };
  }, []);

  // 🛤️ OSRM 경로 계산
  const handleCalculateRoute = async () => {
    if (selectedBinId === null) {
      alert("먼저 시작점이 될 쓰레기통을 선택해주세요!");
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
      const startBin = bins.find((b) => b.operatorId === selectedBinId);
      const otherBins = bins.filter((b) => b.operatorId !== selectedBinId);
      const sortedBins = [startBin, ...otherBins];

      const coordinates = sortedBins
        .map((bin) => `${bin.lng},${bin.lat}`)
        .join(";");

      const OSRM_API = "https://gwon.my/osrm";
      const url = `${OSRM_API}/trip/v1/driving/${coordinates}?source=first&destination=last&roundtrip=false&overview=full&geometries=geojson`;

      const response = await axios.get(url);

      if (
        response.data.code === "Ok" &&
        response.data.trips &&
        response.data.trips.length > 0
      ) {
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
          stops: waypoints.length,
        });
      }
    } catch (error) {
      console.error("TSP Error:", error);
      alert("경로 계산 실패. OSRM 서버 상태를 확인하세요.");
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

  const selectedBin = bins.find((b) => b.operatorId === selectedBinId) || null;

  const getButtonText = () => {
    if (isCalculating) return "계산중...";
    if (selectedBinId !== null) return isMobile ? "TSP 계산" : "이 위치 기준 최적 경로 (TSP)";
    return isMobile ? "시작점 선택" : "먼저 시작점을 선택하세요";
  };

  // --------------------------------------------------
  // 렌더링 (로그인 vs 메인)
  // --------------------------------------------------
  if (screen === "login") {
    return (
      <Box
        sx={{
          width: "100%",
          height: "100vh",
          bgcolor: "#000000",
          fontFamily: "'Roboto', sans-serif",
        }}
      >
        <GlobalStyles />
        <LoginScreen setScreen={setScreen} input={input} setInput={setInput} />
      </Box>
    );
  }

  return (
    <Box sx={{ height: "100dvh", bgcolor: "#000", overflow: "hidden" }}>
      <GlobalStyles />

      {/* Header */}
      <Box
        sx={{
          height: isMobile ? 50 : 80,
          px: isMobile ? 1.5 : 4,
          borderBottom: "1px solid #222",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          bgcolor: "#050505",
        }}
      >
        <Typography
          variant={isMobile ? "h6" : "h3"}
          sx={{
            fontWeight: 900,
            letterSpacing: isMobile ? 2 : 6,
            background: "linear-gradient(45deg,#fff,#777)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
          }}
        >
          TRESS
        </Typography>

        <Stack direction="row" spacing={1} alignItems="center">
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
              "&:hover": { bgcolor: "#1565C0" },
            }}
          >
            {isCalculating && (
              <CircularProgress size={12} sx={{ color: "white", mr: 0.5 }} />
            )}
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
                "&:hover": {
                  bgcolor: "rgba(255,61,0,0.1)",
                  borderColor: "#FF3D00",
                },
              }}
            >
              ✕
            </Button>
          )}

          <Chip
            label={connectionStatus === "CONNECTED" ? "ON" : "OFF"}
            size="small"
            sx={{
              color: connectionStatus === "CONNECTED" ? "#00E676" : "#FF3D00",
              border: "1px solid",
              fontSize: 10,
              height: 24,
              bgcolor: "transparent",
            }}
          />
        </Stack>
      </Box>

      {/* Content */}
      <Stack
        direction={isMobile ? "column" : "row"}
        sx={{
          height: isMobile
            ? "calc(100dvh - 50px)"
            : "calc(100dvh - 80px)",
        }}
      >
        {/* Map Area */}
        <Box
          sx={{
            flex: isMobile ? "none" : 6,
            height: isMobile ? "60%" : "100%",
            position: "relative",
          }}
        >
          <MapContainer
            center={[35.1408, 126.93]}
            zoom={14}
            style={{ height: "100%", background: "#111" }}
          >
            <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" />

            <MapClickFlyTo targetPosition={zoomTarget} trigger={zoomTrigger} />

            {routePath.length > 0 && (
              <Polyline
                positions={routePath}
                pathOptions={{ color: "#00E676", weight: 6, opacity: 0.8 }}
              />
            )}

            {bins.map((bin) => {
              const order = visitOrder[bin.operatorId];
              let iconToUse;

              if (order) iconToUse = createNumberIcon(order);
              else iconToUse = selectedBinId === bin.operatorId ? selectedIcon : defaultIcon;

              return (
                <Marker
                  key={`${bin.operatorName}-${bin.operatorId}`}
                  position={[bin.lat, bin.lng]}
                  icon={iconToUse}
                  eventHandlers={{ click: () => handleMarkerClick(bin) }}
                  zIndexOffset={
                    order === 1 || selectedBinId === bin.operatorId ? 1000 : 0
                  }
                >
                  <Popup>
                    <b>
                      {order ? `[${order}번]` : ""} {bin.operatorName}
                    </b>
                    <br />
                    <span style={{ color: "blue" }}>CAN: {bin.cans}%</span> /{" "}
                    <span style={{ color: "red" }}>PLA: {bin.plastic}%</span>
                  </Popup>
                </Marker>
              );
            })}
          </MapContainer>

          {/* 경로 정보 오버레이 */}
          {routeInfo && (
            <Paper
              sx={{
                position: "absolute",
                bottom: 16,
                left: 16,
                zIndex: 1000,
                p: 1.5,
                bgcolor: "rgba(0,0,0,0.85)",
                border: "1px solid #00E676",
                borderRadius: 2,
              }}
            >
              <Typography
                sx={{
                  color: "#00E676",
                  fontWeight: "bold",
                  fontSize: isMobile ? 12 : 14,
                }}
              >
                📍 {routeInfo.distance}km · {routeInfo.duration}분 ·{" "}
                {routeInfo.stops}곳
              </Typography>
            </Paper>
          )}
        </Box>

        {/* Right Panel (코드2 배치감으로 이식) */}
        <Box
          sx={{
            flex: isMobile ? "none" : 4,
            height: isMobile ? "40%" : "100%",
            bgcolor: "#080808",
            borderLeft: { md: "1px solid #222" },

            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden",
            p: isMobile ? 1.5 : 3,
          }}
        >
          <SelectedBinPanel bin={selectedBin} isMobile={isMobile} />
        </Box>
      </Stack>
    </Box>
  );
}
