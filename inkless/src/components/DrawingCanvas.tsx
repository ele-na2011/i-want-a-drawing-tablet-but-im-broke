import { useEffect, useRef } from "react";
import type { Point, Stroke } from "../types";

interface Props {
  strokes: Stroke[];
  // Called for every input sample. penDown=false means pen lifted.
  onSample: (p: Point, penDown: boolean) => void;
}

// UI OWNER: this is the drawing surface. Size/borders live in styles.css (.canvas-wrap, canvas).
export default function DrawingCanvas({ strokes, onSample }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  const down = useRef(false);

  // Redraw everything whenever strokes change.
  useEffect(() => {
    const c = ref.current!;
    const ctx = c.getContext("2d")!;
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#111"; // TODO: ink color from your design
    for (const s of strokes) {
      if (s.points.length < 2) continue;
      ctx.lineWidth = s.thickness;
      ctx.beginPath();
      s.points.forEach((p, i) => {
        const x = p.x * c.width, y = p.y * c.height;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();
    }
  }, [strokes]);

  // Mouse/touch input so you can build and test without the webcam.
  // Delete or keep as a fallback once tracking works.
  const toPoint = (e: React.PointerEvent): Point => {
    const r = ref.current!.getBoundingClientRect();
    return {
      x: (e.clientX - r.left) / r.width,
      y: (e.clientY - r.top) / r.height,
      t: performance.now(),
    };
  };

  return (
    <div className="canvas-wrap">
      <canvas
        ref={ref}
        width={1600}
        height={1000}
        onPointerDown={(e) => { down.current = true; onSample(toPoint(e), true); }}
        onPointerMove={(e) => { if (down.current) onSample(toPoint(e), true); }}
        onPointerUp={(e) => { down.current = false; onSample(toPoint(e), false); }}
        onPointerLeave={(e) => { if (down.current) { down.current = false; onSample(toPoint(e), false); } }}
      />
    </div>
  );
}