import { Routes, Route, useLocation } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import TopBar from "./components/TopBar";
import RootPage from "./pages/RootPage";
import ProjectsPage from "./pages/ProjectsPage";
import ActivitiesPage from "./pages/ActivitiesPage";
import CertificationsPage from "./pages/CertificationsPage";
import CareerPage from "./pages/CareerPage";
import NicknameSetupPage from "./pages/NicknameSetupPage";

export default function App() {
  const location = useLocation();

  return (
    <div className="app-shell">
      <TopBar />
      <AnimatePresence mode="wait">
        <Routes location={location} key={location.pathname}>
          <Route path="/" element={<RootPage />} />
          <Route path="/projects" element={<ProjectsPage />} />
          <Route path="/activities" element={<ActivitiesPage />} />
          <Route path="/certifications" element={<CertificationsPage />} />
          <Route path="/career" element={<CareerPage />} />
          <Route path="/setup-nickname" element={<NicknameSetupPage />} />
          <Route path="*" element={<RootPage />} />
        </Routes>
      </AnimatePresence>
    </div>
  );
}
