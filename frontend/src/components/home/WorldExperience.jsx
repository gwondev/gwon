import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { CAPTIONS, worldState } from "./worldState.js";
import "./WorldExperience.css";

const WorldCanvas = lazy(() => import("./WorldCanvas.jsx"));

function detectEnv() {
  worldState.mobile = window.innerWidth < 768;
  worldState.reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function captionIndex(p) {
  const cuts = [0.12, 0.22, 0.38, 0.54, 0.66, 0.78, 0.9, 2];
  return cuts.findIndex((c) => p < c);
}

export default function WorldExperience() {
  const root = useRef(null);
  const [scene, setScene] = useState(0);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    detectEnv();
    setReady(true);
    const reducedQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onReduce = () => {
      worldState.reduced = reducedQuery.matches;
    };
    reducedQuery.addEventListener("change", onReduce);

    let raf = 0;
    const sync = () => {
      const el = root.current;
      if (!el) return;
      const max = Math.max(1, el.scrollHeight - window.innerHeight);
      const top = el.getBoundingClientRect().top + window.scrollY;
      const p = Math.min(1, Math.max(0, (window.scrollY - top) / max));
      worldState.progress = p;
      const next = captionIndex(p);
      setScene((cur) => (cur === next ? cur : next));
    };
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(sync);
    };
    const onPointer = (e) => {
      worldState.pointerX = (e.clientX / window.innerWidth) * 2 - 1;
      worldState.pointerY = -((e.clientY / window.innerHeight) * 2 - 1);
    };
    const onResize = () => {
      detectEnv();
      sync();
    };

    sync();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("pointermove", onPointer, { passive: true });
    window.addEventListener("resize", onResize);
    return () => {
      reducedQuery.removeEventListener("change", onReduce);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("pointermove", onPointer);
      window.removeEventListener("resize", onResize);
      cancelAnimationFrame(raf);
    };
  }, []);

  const cap = CAPTIONS[scene] || CAPTIONS[0];
  const hero = scene === 0;

  return (
    <main className="page world-page" ref={root}>
      <div className="world-pin">
        {ready && (
          <Suspense fallback={<div className="world-boot" />}>
            <WorldCanvas />
          </Suspense>
        )}
        <div className={`world-copy ${hero ? "is-hero" : ""}`}>
          <p className="world-kicker">{cap.kicker}</p>
          <h1 className="world-title">{cap.title}</h1>
          <p className="world-line">{cap.line}</p>
          {cap.meta && <p className="world-meta">{cap.meta}</p>}
          {cap.note && scene === 3 && <p className="world-note">{cap.note}</p>}
          {scene === 7 && (
            <Link className="world-link" to="/projects">
              CASE STUDIES
            </Link>
          )}
        </div>
      </div>
      <div className="world-spacer" aria-hidden />
    </main>
  );
}
