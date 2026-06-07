import { motion } from "framer-motion";

const variants = {
  initial: { opacity: 0, y: 24 },
  enter: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.7, ease: [0.16, 1, 0.3, 1] },
  },
};

export default function PageTransition({ children, className }) {
  return (
    <motion.main
      className={className}
      variants={variants}
      initial="initial"
      animate="enter"
    >
      {children}
    </motion.main>
  );
}
