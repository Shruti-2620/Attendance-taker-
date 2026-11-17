import { useEffect, useRef } from "react";

/* A halftone flower made of dots, with the thin circles and crosshairs
   from the poster drawn over it. It sits fixed behind the page and fades
   as you scroll. */
export default function Bloom() {
  const ref = useRef(null);

  useEffect(() => {
    const c = ref.current;
    const ctx = c.getContext("2d");
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    let w = 0, h = 0, raf = 0, t = 0, mx = 0, my = 0;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = c.clientWidth;
      h = c.clientHeight;
      c.width = w * dpr;
      c.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (reduce) draw();
    };

    const petalEdge = (a) => 0.6 + 0.4 * Math.abs(Math.cos(2.5 * a + t * 0.12));

    function draw() {
      ctx.clearRect(0, 0, w, h);
      const R = Math.min(w * 0.46, h * 0.4);
      const cx = w / 2 + mx * 26;
      const cy = h * 0.5 + my * 18;
      const step = Math.max(8, Math.round(R / 36));

      // HUD: dashed axes and rings
      ctx.lineWidth = 1;
      ctx.strokeStyle = "rgba(236,227,192,.22)";
      ctx.setLineDash([3, 6]);
      ctx.beginPath();
      ctx.moveTo(cx, 0); ctx.lineTo(cx, h);
      ctx.moveTo(0, cy); ctx.lineTo(w, cy);
      ctx.stroke();
      ctx.setLineDash([]);
      [0.5, 1.02, 1.3].forEach((k, i) => {
        ctx.strokeStyle = `rgba(236,227,192,${0.34 - i * 0.08})`;
        ctx.beginPath();
        ctx.arc(cx, cy, R * k, 0, Math.PI * 2);
        ctx.stroke();
      });

      // halftone petals
      const x0 = Math.floor((cx - R * 1.05) / step) * step;
      const y0 = Math.floor((cy - R * 1.05) / step) * step;
      for (let y = y0; y < cy + R * 1.05; y += step) {
        for (let x = x0; x < cx + R * 1.05; x += step) {
          const dx = (x - cx) / R, dy = (y - cy) / R;
          const r = Math.hypot(dx, dy);
          const a = Math.atan2(dy, dx);
          const edge = petalEdge(a);
          if (r > edge) continue;
          let v = Math.min(1, (edge - r) / 0.28);            // soft petal edge
          v *= 0.62 + 0.38 * Math.cos(a * 10 + r * 7 + t * 0.2); // veins
          v *= r < 0.12 ? r / 0.12 : 1;                      // hollow heart
          v *= 0.92 + 0.08 * Math.sin(t + x * 0.05);
          if (v < 0.07) continue;
          const pink = Math.max(0, (r - 0.55) / 0.45);
          const g = Math.round(228 - pink * 62), b = Math.round(190 - pink * 22);
          ctx.fillStyle = `rgba(240,${g},${b},${0.35 + v * 0.6})`;
          ctx.beginPath();
          ctx.arc(x, y, step * 0.5 * v, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // HUD: crosses and tiny notes
      ctx.fillStyle = "rgba(236,227,192,.7)";
      ctx.font = "10px 'JetBrains Mono', monospace";
      const notes = [
        [0.5, -0.5, "r 0.50"], [1.02, 0.12, "r 1.00"], [-0.9, -0.95, "n = 5 petals"],
        [-1.02, 0.7, "x " + Math.round(cx)], [0.8, 1.0, "y " + Math.round(cy)],
      ];
      notes.forEach(([nx, ny, s]) => {
        const px = cx + nx * R, py = cy + ny * R;
        ctx.fillRect(px - 4, py, 9, 1);
        ctx.fillRect(px, py - 4, 1, 9);
        ctx.fillText(s, px + 8, py - 6);
      });
    }

    const loop = () => {
      t += 0.012;
      draw();
      raf = requestAnimationFrame(loop);
    };

    const onMove = (e) => {
      mx = e.clientX / window.innerWidth - 0.5;
      my = e.clientY / window.innerHeight - 0.5;
    };
    const onScroll = () => {
      c.style.opacity = Math.max(0.16, 1 - window.scrollY / (window.innerHeight * 0.75));
    };

    resize();
    window.addEventListener("resize", resize);
    window.addEventListener("scroll", onScroll, { passive: true });
    if (!reduce) {
      window.addEventListener("pointermove", onMove);
      loop();
    }
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("pointermove", onMove);
    };
  }, []);

  return <canvas ref={ref} className="bloom" aria-hidden="true" />;
}
