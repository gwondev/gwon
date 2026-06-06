import { motion } from "framer-motion";
import PageTransition from "./PageTransition";
import TabNav from "./TabNav";
import "./SectionLayout.css";

export default function SectionLayout({ active, title, sub, count, children }) {
  return (
    <PageTransition className="page section">
      <div className="section__top">
        <TabNav active={active} />
      </div>

      <motion.header
        className="section__head"
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
      >
        <div>
          <span className="eyebrow">{sub}</span>
          <h1 className="section-title">{title}</h1>
        </div>
        {typeof count === "number" && <span className="section__count">{count}</span>}
      </motion.header>

      {children}
    </PageTransition>
  );
}
