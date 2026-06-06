import { Routes, Route, useLocation } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import TopBar from "./components/TopBar";
import SiteFooter from "./components/SiteFooter";
import RootPage from "./pages/RootPage";
import ProjectsPage from "./pages/ProjectsPage";
import ActivitiesPage from "./pages/ActivitiesPage";
import CertificationsPage from "./pages/CertificationsPage";
import CareerPage from "./pages/CareerPage";
import OverviewPage from "./pages/OverviewPage";
import NicknameSetupPage from "./pages/NicknameSetupPage";
import MyPage from "./pages/MyPage";
import AdminPage from "./pages/AdminPage";
import ChatAdminPage from "./pages/ChatAdminPage";
import ScrollToTop from "./components/ScrollToTop";

export default function App() {
  const location = useLocation();

  return (
    <div className="app-shell">
      <ScrollToTop />
      <TopBar />
      <AnimatePresence mode="wait">
        <Routes location={location} key={location.pathname}>
          <Route path="/" element={<RootPage />} />
          <Route path="/projects" element={<ProjectsPage />} />
          <Route path="/activities" element={<ActivitiesPage />} />
          <Route path="/certifications" element={<CertificationsPage />} />
          <Route path="/career" element={<CareerPage />} />
          <Route path="/overview" element={<OverviewPage />} />
          <Route path="/setup-nickname" element={<NicknameSetupPage />} />
          <Route path="/mypage" element={<MyPage />} />
          <Route path="/admin" element={<AdminPage />} />
          <Route path="/admin/chat" element={<ChatAdminPage />} />
          <Route path="*" element={<RootPage />} />
        </Routes>
      </AnimatePresence>
      <SiteFooter />
    </div>
  );
}
