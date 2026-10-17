import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { PAGE } from "../lib/projects";

const MIN_ZOOM = 0.2;
const MAX_ZOOM = 4;
const clamp = (z: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z));

// The page sits on a desk you can move around: drag the desk (or hold Space / the middle button and drag
// anywhere) to pan, scroll to pan, Ctrl/⌘ + scroll to zoom, double-click the desk to fit the page again.
export default function PageView({ children }: { children: ReactNode }) {
  const desk = useRef<HTMLDivElement>(null);
  const [view, setView] = useState({ x: 0, y: 0, zoom: 1 });
  const [space, setSpace] = useState(false);
  const drag = useRef<{ x: number; y: number } | null>(null);
  const moved = useRef(false); // once the user pans/zooms, stop re-fitting on window resize

  const fit = useCallback(() => {
    const r = desk.current!.getBoundingClientRect();
    const zoom = clamp(Math.min((r.width - 64) / PAGE.w, (r.height - 64) / PAGE.h));
    setView({ zoom, x: (r.width - PAGE.w * zoom) / 2, y: (r.height - PAGE.h * zoom) / 2 });
  }, []);

  useLayoutEffect(() => {
    fit();
    const ro = new ResizeObserver(() => { if (!moved.current) fit(); });
    ro.observe(desk.current!);
    return () => ro.disconnect();
  }, [fit]);

  // Wheel needs a non-passive listener so the browser doesn't also scroll or zoom the whole page.
  useEffect(() => {
    const el = desk.current!;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      moved.current = true;
      if (e.ctrlKey || e.metaKey) {
        const r = el.getBoundingClientRect();
        const cx = e.clientX - r.left, cy = e.clientY - r.top;
        setView((v) => {
          const zoom = clamp(v.zoom * Math.exp(-e.deltaY * 0.002));
          const k = zoom / v.zoom; // keep the point under the cursor still
          return { zoom, x: cx - (cx - v.x) * k, y: cy - (cy - v.y) * k };
        });
      } else {
        setView((v) => ({ ...v, x: v.x - e.deltaX, y: v.y - e.deltaY }));
      }
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  // Hold Space to grab the page from anywhere (like most drawing apps).
  useEffect(() => {
    const typing = (e: KeyboardEvent) => (e.target as HTMLElement).closest("input, textarea, select, dialog");
    const down = (e: KeyboardEvent) => { if (e.code === "Space" && !typing(e)) { e.preventDefault(); setSpace(true); } };
    const up = (e: KeyboardEvent) => { if (e.code === "Space") setSpace(false); };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); };
  }, []);

  return (
    <div
      ref={desk}
      className={`desk${space || drag.current ? " panning" : ""}`}
      onPointerDown={(e) => {
        const onDesk = e.target === e.currentTarget;
        if (!(onDesk || space || e.button === 1)) return;
        e.preventDefault();
        drag.current = { x: e.clientX, y: e.clientY };
        moved.current = true;
        e.currentTarget.setPointerCapture(e.pointerId);
      }}
      onPointerMove={(e) => {
        if (!drag.current) return;
        const dx = e.clientX - drag.current.x, dy = e.clientY - drag.current.y;
        drag.current = { x: e.clientX, y: e.clientY };
        setView((v) => ({ ...v, x: v.x + dx, y: v.y + dy }));
      }}
      onPointerUp={() => { drag.current = null; }}
      onDoubleClick={(e) => { if (e.target === e.currentTarget) { moved.current = false; fit(); } }}
    >
      <div
        className="page"
        style={{ width: PAGE.w, height: PAGE.h, transform: `translate(${view.x}px, ${view.y}px) scale(${view.zoom})` }}
      >
        {children}
      </div>
    </div>
  );
}
