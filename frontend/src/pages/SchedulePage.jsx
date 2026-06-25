import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import PageTransition from "../components/PageTransition";
import ScheduleTab from "../components/ScheduleTab";
import { useAuth } from "../context/AuthContext";
import "./SchedulePage.css";

export default function SchedulePage() {
  const { isCalendarAdmin, loading } = useAuth();
  const navigate = useNavigate();

  if (loading) return null;

  if (!isCalendarAdmin) {
    return (
      <PageTransition className="page schedule-page schedule-page--denied">
        <motion.div
          className="schedule-page__denied"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
        >
          <p className="schedule-page__denied-title">접근 권한이 없습니다</p>
          <p className="schedule-page__denied-desc">
            일정 관리는 관리자(ADMIN) 이상 권한이 있는 회원만 이용할 수 있습니다.
          </p>
          <button type="button" className="btn btn-accent" onClick={() => navigate("/")}>
            메인으로
          </button>
        </motion.div>
      </PageTransition>
    );
  }

  return (
    <PageTransition className="page schedule-page">
      <motion.div
        className="schedule-page__body"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      >
        <ScheduleTab />
      </motion.div>
    </PageTransition>
  );
}
