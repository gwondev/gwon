import { useEffect, useRef } from "react";

const STAR_DENSITY = 0.00012; // stars per px^2
const MAX_STARS = 420;
const METEOR_MIN_GAP = 4500;
const METEOR_MAX_GAP = 11000;

function rand(min, max) {
  return min + Math.random() * (max - min);
}

export default function Starfield() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let width = 0;
    let height = 0;
    let dpr = Math.min(window.devicePixelRatio || 1, 2);
    let stars = [];
    let meteor = null;
    let nextMeteorAt = performance.now() + rand(1200, 4000);
    let rafId = null;

    function buildStars() {
      const count = Math.min(MAX_STARS, Math.round(width * height * STAR_DENSITY));
      stars = Array.from({ length: count }, () => {
        const depth = rand(0.3, 1); // 0.3 far/slow, 1 near/fast
        return {
          x: Math.random() * width,
          y: Math.random() * height,
          r: rand(0.4, 1.5) * depth + 0.3,
          baseAlpha: rand(0.25, 0.9),
          phase: rand(0, Math.PI * 2),
          twinkleSpeed: rand(0.6, 1.8),
          depth,
          hue: Math.random() < 0.18 ? rand(190, 265) : 210,
        };
      });
    }

    function resize() {
      width = canvas.parentElement.clientWidth;
      height = canvas.parentElement.clientHeight;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      buildStars();
    }

    function spawnMeteor() {
      const fromLeft = Math.random() < 0.5;
      const startX = fromLeft ? rand(-40, width * 0.4) : rand(width * 0.6, width + 40);
      const startY = rand(-20, height * 0.35);
      const angle = fromLeft ? rand(0.35, 0.55) : Math.PI - rand(0.35, 0.55);
      const speed = rand(9, 14);
      meteor = {
        x: startX,
        y: startY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0,
        maxLife: rand(30, 46),
      };
    }

    function drawFrame(t) {
      ctx.clearRect(0, 0, width, height);

      for (const s of stars) {
        s.x += s.depth * 0.012;
        if (s.x > width + 2) s.x = -2;
        const tw = reduced ? 1 : 0.55 + 0.45 * Math.sin(t * 0.001 * s.twinkleSpeed + s.phase);
        const alpha = s.baseAlpha * tw;
        ctx.beginPath();
        ctx.fillStyle = `hsla(${s.hue}, 90%, 88%, ${alpha})`;
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fill();
      }

      if (!reduced) {
        if (meteor) {
          meteor.life += 1;
          meteor.x += meteor.vx;
          meteor.y += meteor.vy;
          const p = meteor.life / meteor.maxLife;
          const fade = Math.max(0, 1 - p);
          if (fade > 0 && meteor.x < width + 60 && meteor.y < height + 60) {
            const tailX = meteor.x - meteor.vx * 6;
            const tailY = meteor.y - meteor.vy * 6;
            const grad = ctx.createLinearGradient(meteor.x, meteor.y, tailX, tailY);
            grad.addColorStop(0, `rgba(200, 230, 255, ${0.9 * fade})`);
            grad.addColorStop(1, "rgba(200, 230, 255, 0)");
            ctx.strokeStyle = grad;
            ctx.lineWidth = 1.6;
            ctx.beginPath();
            ctx.moveTo(meteor.x, meteor.y);
            ctx.lineTo(tailX, tailY);
            ctx.stroke();
          } else {
            meteor = null;
          }
        } else if (t > nextMeteorAt) {
          spawnMeteor();
          nextMeteorAt = t + rand(METEOR_MIN_GAP, METEOR_MAX_GAP);
        }
      }

      rafId = reduced ? null : requestAnimationFrame(drawFrame);
    }

    resize();
    window.addEventListener("resize", resize);
    if (reduced) {
      drawFrame(0);
    } else {
      rafId = requestAnimationFrame(drawFrame);
    }

    return () => {
      window.removeEventListener("resize", resize);
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, []);

  return (
    <div className="starfield" aria-hidden="true">
      <canvas ref={canvasRef} className="starfield__canvas" />
    </div>
  );
}
