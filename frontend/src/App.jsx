import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import TopBar from "./components/TopBar";
import SiteFooter from "./components/SiteFooter";
import Starfield from "./components/Starfield";
import ScrollProgress from "./components/ScrollProgress";
import ChatWidget from "./components/ChatWidget";
import RootPage from "./pages/RootPage";
import ProjectsPage from "./pages/ProjectsPage";
import CompetitionsPage from "./pages/CompetitionsPage";
import TechStackPage from "./pages/TechStackPage";
import ActivitiesPage from "./pages/ActivitiesPage";
import CertificationsPage from "./pages/CertificationsPage";
import CareerPage from "./pages/CareerPage";
import OverviewPage from "./pages/OverviewPage";
import NicknameSetupPage from "./pages/NicknameSetupPage";
import MyPage from "./pages/MyPage";
import SchedulePage from "./pages/SchedulePage";
import AdminPage from "./pages/AdminPage";
import DataPage from "./pages/DataPage";
import BinancePage from "./pages/BinancePage";
import ScrollToTop from "./components/ScrollToTop";
import "./styles/cosmic.css";

export default function App() {
  const location = useLocation();
  const path = location.pathname;
  // 홈·일정·바이낸스는 블랙 골드 톤. 세부 포트폴리오 페이지만 코스믹.
  const isHome = path === "/";
  const isCosmic =
    path !== "/" && path !== "/schedule" && path !== "/BINANCE" && path !== "/binance";

  return (
    <div className={`app-shell ${isCosmic ? "cosmic" : ""} ${isHome ? "app-shell--world" : ""}`}>
      <ScrollToTop />
      {isCosmic && <Starfield />}
      {isCosmic && <ScrollProgress />}
      <TopBar />
      <Routes>
        <Route path="/" element={<RootPage />} />
        <Route path="/tech-stack" element={<TechStackPage />} />
        <Route path="/competitions" element={<CompetitionsPage />} />
        <Route path="/projects" element={<ProjectsPage />} />
        <Route path="/activities" element={<ActivitiesPage />} />
        <Route path="/certifications" element={<CertificationsPage />} />
        <Route path="/career" element={<CareerPage />} />
        <Route path="/overview" element={<OverviewPage />} />
        <Route path="/setup-nickname" element={<NicknameSetupPage />} />
        <Route path="/mypage" element={<MyPage />} />
        <Route path="/schedule" element={<SchedulePage />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="/data" element={<DataPage />} />
        <Route path="/BINANCE" element={<BinancePage />} />
        <Route path="/binance" element={<BinancePage />} />
        <Route path="/admin/chat" element={<Navigate to="/admin" replace />} />
        <Route path="*" element={<RootPage />} />
      </Routes>
      <SiteFooter />
      {path !== "/" && path !== "/schedule" && path !== "/BINANCE" && path !== "/binance" && (
        <ChatWidget />
      )}
    </div>
  );
}
