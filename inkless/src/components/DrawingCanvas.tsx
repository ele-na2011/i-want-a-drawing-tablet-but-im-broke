import { useEffect, useRef, useState } from "react";
import type { Point, Stroke } from "../types";
import { drawStrokes } from "../lib/draw";
import { PAGE } from "../lib/projects";

interface Props {
  strokes: Stroke[];
  // Called for every input sample. penDown=false means pen lifted.
  onSample: (p: Point, penDown: boolean) => void;
  cursorColor: string; // ring follows the pointer in the pen colour...
  cursorSize: number;  // ...and is as wide as the stroke it would draw (page px)
  background: string | null; // imported image shown under the ink
  penPoint?: { x: number; y: number } | null; // where the tracked pen tip is, 0..1, even while lifted
}

// Pixels per page px: at least 2 so the page stays sharp when zoomed in or on high-density screens.
const DENSITY = 2; // Keep live drawing responsive even on very high-density displays.

// UI OWNER: this is the drawing surface, one fixed-size page. PageView moves and zooms it.
export default function DrawingCanvas({ strokes, onSample, cursorColor, cursorSize, background, penPoint }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  const down = useRef(false);
  const [hover, setHover] = useState<{ x: number; y: number } | null>(null);

  // Cache completed strokes; only the last (possibly active) stroke is rebuilt per sample.
  const cache = useRef<{ canvas: HTMLCanvasElement; prefix: Stroke[] } | null>(null);
  useEffect(() => {
    const c = ref.current!;
    const ctx = c.getContext("2d")!;
    if (!cache.current) {
      const canvas = document.createElement("canvas");
      canvas.width = c.width; canvas.height = c.height;
      cache.current = { canvas, prefix: [] };
    }
    const prefix = strokes.slice(0, -1);
    const cached = cache.current;
    if (prefix.length !== cached.prefix.length || prefix.some((s, i) => s !== cached.prefix[i])) {
      const base = cached.canvas.getContext("2d")!;
      base.clearRect(0, 0, c.width, c.height);
      drawStrokes(base, prefix, c.width, c.height, DENSITY);
      cached.prefix = prefix;
    }
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.drawImage(cached.canvas, 0, 0);
    if (strokes.length) drawStrokes(ctx, [strokes[strokes.length - 1]], c.width, c.height, DENSITY);
  }, [strokes]);

  // Mouse/touch input so you can build and test without the webcam.
  // Delete or keep as a fallback once tracking works.
  const toPoint = (e: React.PointerEvent): Point => {
    const r = ref.current!.getBoundingClientRect(); // includes the zoom, so points stay 0..1
    return {
      x: (e.clientX - r.left) / r.width,
      y: (e.clientY - r.top) / r.height,
      t: performance.now(),
    };
  };

  return (
    <div className="canvas-wrap">
      {background && <img className="board-bg" src={background} alt="" />}
      <canvas
        ref={ref}
        width={PAGE.w * DENSITY}
        height={PAGE.h * DENSITY}
        onPointerDown={(e) => {
          if (e.button !== 0) return; // middle/right button belong to panning
          down.current = true;
          e.currentTarget.setPointerCapture(e.pointerId); // keep the stroke going if the pen leaves the page
          onSample(toPoint(e), true);
        }}
        onPointerMove={(e) => {
          setHover({ x: e.nativeEvent.offsetX, y: e.nativeEvent.offsetY });
          if (down.current) onSample(toPoint(e), true);
        }}
        onPointerUp={(e) => { if (down.current) { down.current = false; onSample(toPoint(e), false); } }}
        onPointerCancel={(e) => { if (down.current) { down.current = false; onSample(toPoint(e), false); } }}
        onPointerLeave={() => setHover(null)}
      />
      {hover && (
        <div
          className="cursor-ring" aria-hidden="true"
          style={{ left: hover.x, top: hover.y, width: cursorSize, height: cursorSize, borderColor: cursorColor }}
        />
      )}
      {penPoint && (
        <div
          className="cursor-ring pen-ring" aria-hidden="true"
          style={{ left: `${penPoint.x * 100}%`, top: `${penPoint.y * 100}%`, width: cursorSize, height: cursorSize, borderColor: cursorColor }}
        />
      )}
    </div>
  );
}
