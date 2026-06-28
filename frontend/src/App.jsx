import { Routes, Route, Navigate } from "react-router-dom";
import TopBar from "./components/TopBar";
import SiteFooter from "./components/SiteFooter";
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
import ScrollToTop from "./components/ScrollToTop";

export default function App() {
  return (
    <div className="app-shell">
      <ScrollToTop />
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
        <Route path="/admin/chat" element={<Navigate to="/admin" replace />} />
        <Route path="*" element={<RootPage />} />
      </Routes>
      <SiteFooter />
    </div>
  );
}
