import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import TopBar from "./components/TopBar";
import SiteFooter from "./components/SiteFooter";
import Starfield from "./components/Starfield";
import ScrollProgress from "./components/ScrollProgress";
import ChatWidget from "./components/ChatWidget";
import RootPage from "./pages/RootPage";
import NicknameSetupPage from "./pages/NicknameSetupPage";
import MyPage from "./pages/MyPage";
import SchedulePage from "./pages/SchedulePage";
import BinancePage from "./pages/BinancePage";
import VaultStudio from "./pages/VaultStudio";
import ScrollToTop from "./components/ScrollToTop";
import "./styles/cosmic.css";

export default function App() {
  const location = useLocation();
  const path = location.pathname;
  // 홈·일정·바이낸스·마이페이지는 블랙 골드 톤. 세부 포트폴리오 페이지만 코스믹.
  const isHome = path === "/";
  const phone = new URLSearchParams(location.search).has("phone");
  const isCosmic =
    path !== "/" &&
    path !== "/schedule" &&
    path !== "/mypage" &&
    path !== "/studio" &&
    path !== "/BINANCE" &&
    path !== "/binance";

  const inner = (
    <>
      <ScrollToTop />
      {isCosmic && <Starfield />}
      {isCosmic && <ScrollProgress />}
      <TopBar />
      <Routes>
        <Route path="/" element={<RootPage />} />
        <Route path="/tech-stack" element={<Navigate to="/" replace />} />
        <Route path="/competitions" element={<Navigate to="/" replace />} />
        <Route path="/projects" element={<Navigate to="/" replace />} />
        <Route path="/activities" element={<Navigate to="/" replace />} />
        <Route path="/certifications" element={<Navigate to="/" replace />} />
        <Route path="/career" element={<Navigate to="/" replace />} />
        <Route path="/overview" element={<Navigate to="/" replace />} />
        <Route path="/setup-nickname" element={<NicknameSetupPage />} />
        <Route path="/mypage" element={<MyPage />} />
        <Route path="/schedule" element={<SchedulePage />} />
        <Route path="/studio" element={<VaultStudio />} />
        <Route path="/admin" element={<Navigate to="/mypage" replace />} />
        <Route path="/data" element={<Navigate to="/" replace />} />
        <Route path="/BINANCE" element={<BinancePage />} />
        <Route path="/binance" element={<BinancePage />} />
        <Route path="/ai" element={<Navigate to="/" replace />} />
        <Route path="/admin/chat" element={<Navigate to="/" replace />} />
        <Route path="*" element={<RootPage />} />
      </Routes>
      <SiteFooter />
      {isHome && <ChatWidget home />}
      {!isHome &&
        path !== "/schedule" &&
        path !== "/mypage" &&
        path !== "/studio" &&
        path !== "/BINANCE" &&
        path !== "/binance" && <ChatWidget />}
    </>
  );

  return (
    <div className={`app-shell ${isCosmic ? "cosmic" : ""} ${isHome ? "app-shell--world" : ""} ${phone ? "app-shell--phone" : ""}`}>
      {phone ? (
        <>
          <p className="phone-desk__hint">PHONE PREVIEW · 390×844 · 주소에서 ?phone 을 빼면 원래 화면</p>
          <div className="phone-frame">{inner}</div>
        </>
      ) : (
        inner
      )}
    </div>
  );
}
