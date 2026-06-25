import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import PageTransition from "../components/PageTransition";
import ScheduleTab from "../components/ScheduleTab";
import { useAuth } from "../context/AuthContext";
import "./SchedulePage.css";

export default function SchedulePage() {
  const { isCalendarAdmin, isAuthed, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && (!isAuthed || !isCalendarAdmin)) navigate("/");
  }, [loading, isAuthed, isCalendarAdmin, navigate]);

  if (!isCalendarAdmin) return null;

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
