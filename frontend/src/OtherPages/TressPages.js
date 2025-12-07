import React, { useState, useEffect } from "react";
import { Box, Stack, TextField, Typography, Button } from "@mui/material";
import { MapContainer, TileLayer, Marker, Popup, Polyline } from "react-leaflet";
import L from "leaflet"; 
import "leaflet/dist/leaflet.css";

// ----------------------------------------------------
// 🎨 전역 CSS 애니메이션 정의 (스타일 태그 주입)
// ----------------------------------------------------
const GlobalStyles = () => (
  <style>{`
    @keyframes gradient-text {
      0% { background-position: 0% 50%; }
      50% { background-position: 100% 50%; }
      100% { background-position: 0% 50%; }
    }
    @keyframes pulse-red {
      0% { box-shadow: 0 0 0 0 rgba(255, 82, 82, 0.7); }
      70% { box-shadow: 0 0 0 10px rgba(255, 82, 82, 0); }
      100% { box-shadow: 0 0 0 0 rgba(255, 82, 82, 0); }
    }
    @keyframes float {
      0% { transform: translateY(0px); }
      50% { transform: translateY(-10px); }
      100% { transform: translateY(0px); }
    }
    @keyframes slide-in {
      from { opacity: 0; transform: translateY(20px); }
      to { opacity: 1; transform: translateY(0); }
    }
  `}</style>
);

// ----------------------------------------------------
// 📍 아이콘 설정
// ----------------------------------------------------

// 1. 일반 쓰레기통 마커
const binMarker = new L.Icon({
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
  shadowSize: [41, 41],
});

// 2. 수거 차량 (출발지) 마커 - 트럭 아이콘 사용
const truckIcon = new L.Icon({
  iconUrl: "https://cdn-icons-png.flaticon.com/512/2554/2554936.png", // 무료 CDN 트럭 아이콘
  iconSize: [45, 45],
  iconAnchor: [22, 45],
  popupAnchor: [0, -40],
  className: "truck-icon" // CSS 클래스 부여 가능
});

// 출발지 (데포)
const DEPOT_LOC = { lat: 35.1425, lng: 126.9345 }; 

// ----------------------------------------------------
// 🧮 TSP 알고리즘 (거리 계산)
// ----------------------------------------------------
const getDistance = (lat1, lon1, lat2, lon2) => {
    return Math.sqrt(Math.pow(lat1 - lat2, 2) + Math.pow(lon1 - lon2, 2));
};

const permute = (arr) => {
    if (arr.length === 0) return [[]];
    const firstElem = arr[0];
    const rest = arr.slice(1);
    const permsWithoutFirst = permute(rest);
    const allPermutations = [];
    permsWithoutFirst.forEach((perm) => {
        for (let i = 0; i <= perm.length; i++) {
            const permWithFirst = [...perm.slice(0, i), firstElem, ...perm.slice(i)];
            allPermutations.push(permWithFirst);
        }
    });
    return allPermutations;
};

// ----------------------------------------------------
// 📊 게이지 바 (GaugeBar)
// ----------------------------------------------------
const GaugeBar = ({ type, percent }) => {
  let barColor = "#00E676"; // Neon Green
  if (percent >= 50) barColor = "#FFEA00"; // Neon Yellow
  if (percent >= 80) barColor = "#FF3D00"; // Neon Red

  return (
    <Stack alignItems="center" spacing={1} sx={{ width: "45%" }}>
      <Box
        sx={{
          width: "100%",
          height: "100px",
          border: `1px solid ${barColor}`,
          borderRadius: "8px",
          position: "relative",
          overflow: "hidden",
          display: "flex",
          alignItems: "flex-end",
          bgcolor: "rgba(255, 255, 255, 0.05)", // Glass effect background
          boxShadow: percent >= 80 ? `0 0 15px ${barColor}` : "none", // 위험 시 발광
          animation: percent >= 80 ? "pulse-red 2s infinite" : "none", // 위험 시 두근거림
        }}
      >
        <Box
          sx={{
            width: "100%",
            height: `${percent}%`,
            bgcolor: barColor,
            transition: "all 1s cubic-bezier(0.4, 0, 0.2, 1)", // 부드러운 물리 효과
            opacity: 0.9,
            boxShadow: `0 0 20px ${barColor}`, // 내부 발광
          }}
        />
        <Typography
          sx={{
            position: "absolute",
            width: "100%",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            color: "#FFFFFF",
            fontWeight: "900",
            zIndex: 1,
            textShadow: "0px 0px 5px rgba(0,0,0,1)",
            fontFamily: "'Orbitron', sans-serif", // 미래지향적 폰트 느낌
          }}
        >
          {percent}%
        </Typography>
      </Box>
      <Typography variant="caption" sx={{ color: "#B0B0B0", fontWeight: "bold", letterSpacing: "1px" }}>
        {type}
      </Typography>
    </Stack>
  );
};

// ----------------------------------------------------
// 🗑️ 쓰레기통 UI (TrashBin)
// ----------------------------------------------------
const TrashBin = ({ id, name, cans, plastic }) => {
  return (
    <Box
      sx={{
        width: "100%",
        p: 2.5,
        border: "1px solid rgba(255,255,255,0.1)",
        borderRadius: "16px",
        bgcolor: "#0a0a0a",
        textAlign: "center",
        boxShadow: "0 8px 32px 0 rgba(0, 0, 0, 0.37)", // Glassmorphism Shadow
        backdropFilter: "blur(4px)",
        transition: "transform 0.3s ease",
        animation: "slide-in 0.6s ease-out",
        "&:hover": {
            transform: "translateY(-5px)",
            border: "1px solid rgba(255,255,255,0.3)",
            boxShadow: "0 10px 40px 0 rgba(255, 255, 255, 0.1)",
        }
      }}
    >
      <Typography variant="h6" sx={{ color: "#FFFFFF", fontWeight: "700", mb: 2, letterSpacing: "1px" }}>
        {name}
      </Typography>

      <Stack direction="row" justifyContent="space-around" sx={{ width: "100%" }}>
        <GaugeBar type="CAN" percent={cans} />
        <GaugeBar type="PLASTIC" percent={plastic} />
      </Stack>
    </Box>
  );
};

// ----------------------------------------------------
// 🔐 로그인 화면 (LoginScreen)
// ----------------------------------------------------
const LoginScreen = ({ setScreen, input, setInput }) => (
  <Stack
    justifyContent="center"
    alignItems="center"
    sx={{ width: "100%", height: "100vh", bgcolor: "#000000", position: "relative", overflow: "hidden" }}
  >
    {/* 배경 장식 (흐릿한 원) */}
    <Box sx={{ position: "absolute", top: "-10%", left: "-10%", width: "500px", height: "500px", borderRadius: "50%", background: "radial-gradient(circle, rgba(255,255,255,0.1) 0%, rgba(0,0,0,0) 70%)", filter: "blur(50px)" }} />
    <Box sx={{ position: "absolute", bottom: "-10%", right: "-10%", width: "600px", height: "600px", borderRadius: "50%", background: "radial-gradient(circle, rgba(255,255,255,0.05) 0%, rgba(0,0,0,0) 70%)", filter: "blur(60px)" }} />

    <Stack alignItems="center" sx={{ zIndex: 2, animation: "float 6s ease-in-out infinite" }}>
        <Typography 
            variant="h1" 
            sx={{ 
                fontWeight: 900, 
                letterSpacing: "8px",
                mb: 0,
                background: "linear-gradient(45deg, #FFFFFF, #757575, #FFFFFF)", // 메탈릭 그라데이션
                backgroundSize: "200% 200%",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                animation: "gradient-text 5s ease infinite"
            }}
        >
        TRESS
        </Typography>
        <Typography variant="h6" sx={{ color: "#666", letterSpacing: "8px", mb: 6, fontWeight: "300" }}>
            AI ROBOTICS
        </Typography>
    </Stack>

    <Stack spacing={4} sx={{ width: "340px", zIndex: 2 }}>
      <TextField
        label="Organization Code"
        variant="outlined"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        sx={{
          "& .MuiInputBase-input": { color: "#FFFFFF", textAlign: "center", fontSize: "1.2rem", letterSpacing: "2px" },
          "& .MuiInputLabel-root": { color: "#888" },
          "& .MuiInputLabel-root.Mui-focused": { color: "#FFFFFF" },
          "& .MuiOutlinedInput-root": {
            borderRadius: "50px", // 둥근 테두리
            bgcolor: "rgba(255,255,255,0.05)",
            "& fieldset": { borderColor: "#333" },
            "&:hover fieldset": { borderColor: "#888" },
            "&.Mui-focused fieldset": { borderColor: "#FFFFFF", borderWidth: "2px" },
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
          boxShadow: "0 0 20px rgba(255,255,255,0.3)", // 버튼 발광
          transition: "0.3s",
          "&:hover": { 
            bgcolor: "#E0E0E0", 
            transform: "scale(1.05)",
            boxShadow: "0 0 30px rgba(255,255,255,0.6)"
          }
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
// 🗺️ 메인 화면 (MainScreen)
// ----------------------------------------------------
const MainScreen = ({ initialTrashBins }) => {
  const [displayBins, setDisplayBins] = useState(initialTrashBins);
  const [routePath, setRoutePath] = useState([]); 
  
  const handleOptimizeRoute = () => {
    const bins = [...initialTrashBins];
    const permutations = permute(bins);
    
    let minDistance = Infinity;
    let bestOrder = [];

    permutations.forEach((perm) => {
        let currentDist = 0;
        let currentLoc = DEPOT_LOC;

        perm.forEach((bin) => {
            currentDist += getDistance(currentLoc.lat, currentLoc.lng, bin.lat, bin.lng);
            currentLoc = { lat: bin.lat, lng: bin.lng };
        });

        if (currentDist < minDistance) {
            minDistance = currentDist;
            bestOrder = perm;
        }
    });

    setDisplayBins(bestOrder);
    const path = [
        [DEPOT_LOC.lat, DEPOT_LOC.lng], 
        ...bestOrder.map(b => [b.lat, b.lng]) 
    ];
    setRoutePath(path);
  };

  return (
    <Stack direction="column" sx={{ width: "100%", height: "100vh", bgcolor: "#000000" }}>
      
      {/* 헤더 */}
      <Box sx={{ p: 2, textAlign: "center", borderBottom: "1px solid #222", bgcolor: "#050505", boxShadow: "0 4px 20px rgba(0,0,0,0.8)", zIndex: 10 }}>
        <Typography 
            variant="h4" 
            fontWeight="900" 
            sx={{ 
                color: "#FFFFFF", 
                letterSpacing: "4px",
                textShadow: "0 0 10px rgba(255,255,255,0.5)"
            }}
        >
          TRESS
        </Typography>
        <Typography sx={{ color: "#666", fontSize: "0.8rem", letterSpacing: "3px", mt: 0.5 }}>
          AI ROBOTICS • CHOSUN UNIVERSITY
        </Typography>
      </Box>

      <Stack direction={{ xs: "column", md: "row" }} sx={{ flex: 1, overflow: "hidden" }}>
        
        {/* 지도 영역 */}
        <Box sx={{ flex: 2, position: "relative" }}>
            <MapContainer
                center={[35.1408, 126.9300]} 
                zoom={16}
                style={{ width: "100%", height: "100%", background: "#000" }}
            >
                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                
                {/* 🚚 수거 차량 (출발지) - 아이콘 변경됨 */}
                <Marker position={[DEPOT_LOC.lat, DEPOT_LOC.lng]} icon={truckIcon}>
                     <Popup>
                        <div style={{textAlign: "center"}}>
                            <b>ROBOTICS DEPOT</b><br/>수거 차량 대기중
                        </div>
                     </Popup>
                </Marker>

                {displayBins.map((bin, index) => (
                    <Marker key={bin.id} position={[bin.lat, bin.lng]} icon={binMarker}>
                        <Popup>
                            <div style={{ textAlign: "center" }}>
                                <b>{index + 1}번 목표: {bin.name}</b><br/>
                                캔: {bin.cans}% / 플라스틱: {bin.plastic}%
                            </div>
                        </Popup>
                    </Marker>
                ))}

                {routePath.length > 0 && (
                    <Polyline 
                        positions={routePath} 
                        color="#FF3D00" // Neon Red Path
                        dashArray="10, 10" 
                        weight={5}
                        opacity={0.8} 
                    />
                )}
            </MapContainer>
            
            {/* 최적 경로 버튼 (Neumorphism Style) */}
            <Button
                variant="contained"
                onClick={handleOptimizeRoute}
                sx={{
                    position: "absolute",
                    top: 25,
                    right: 25,
                    zIndex: 1000,
                    bgcolor: "#FF3D00",
                    color: "white",
                    fontWeight: "bold",
                    px: 3,
                    py: 1.5,
                    borderRadius: "30px",
                    boxShadow: "0 4px 20px rgba(255, 61, 0, 0.4)",
                    border: "2px solid rgba(255,255,255,0.2)",
                    backdropFilter: "blur(5px)",
                    "&:hover": { 
                        bgcolor: "#D50000",
                        transform: "scale(1.05)",
                        boxShadow: "0 6px 25px rgba(255, 61, 0, 0.6)",
                    }
                }}
            >
                🚀 AI OPTIMIZE ROUTE
            </Button>
        </Box>

        {/* 오른쪽 패널 */}
        <Stack
          sx={{
            flex: 1,
            p: 3,
            bgcolor: "#000000",
            overflowY: "auto",
            borderLeft: { md: "1px solid #222" },
            backgroundImage: "linear-gradient(180deg, rgba(20,20,20,1) 0%, rgba(0,0,0,1) 100%)"
          }}
          spacing={3}
          alignItems="center"
        >
          <Box sx={{ textAlign: "center", width: "100%", mb: 2 }}>
            <Typography variant="h6" fontWeight="bold" sx={{ color: "#FFFFFF", letterSpacing: "2px" }}>
                REAL-TIME STATUS
            </Typography>
            <Typography variant="caption" sx={{ color: "#555", letterSpacing: "1px" }}>
                {routePath.length > 0 ? "OPTIMIZED SEQUENCE ACTIVATE" : "WAITING FOR OPTIMIZATION..."}
            </Typography>
          </Box>
          
          {displayBins.map((bin) => (
            <TrashBin 
                key={bin.id} 
                id={bin.id}
                name={bin.name} 
                cans={bin.cans} 
                plastic={bin.plastic} 
            />
          ))}
        </Stack>
      </Stack>
    </Stack>
  );
};

// ----------------------------------------------------
// 🚀 메인 컴포넌트
// ----------------------------------------------------
export default function TressPages() {
  const [screen, setScreen] = useState("login");
  const [input, setInput] = useState("");

  const initialTrashBins = [
    {
      id: 1,
      name: "IT 융합대학",
      lat: 35.13984029862073,
      lng: 126.93431000324911,
      cans: 10, plastic: 85,
    },
    {
      id: 2,
      name: "중앙도서관",
      lat: 35.14180424502847,
      lng: 126.9324484538076,
      cans: 60, plastic: 40,
    },
    {
      id: 3,
      name: "조선대학교병원",
      lat: 35.13891645579106,
      lng: 126.92655290780027,
      cans: 95, plastic: 20,
    },
  ];

  return (
    <Box sx={{ width: "100%", height: "100vh", bgcolor: "#000000", fontFamily: "'Roboto', sans-serif" }}>
      <GlobalStyles />
      {screen === "login" ? (
        <LoginScreen setScreen={setScreen} input={input} setInput={setInput} />
      ) : (
        <MainScreen initialTrashBins={initialTrashBins} />
      )}
    </Box>
  );
}