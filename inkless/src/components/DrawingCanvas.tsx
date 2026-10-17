import { useEffect, useRef, useState } from "react";
import type { Point, Stroke } from "../types";
import { drawStrokes } from "../lib/draw";

interface Props {
  strokes: Stroke[];
  // Called for every input sample. penDown=false means pen lifted.
  onSample: (p: Point, penDown: boolean) => void;
  cursorColor: string; // ring follows the pointer in the pen colour...
  cursorSize: number;  // ...and is as wide as the stroke it would draw (css px)
  background: string | null; // imported image shown under the ink
}

// UI OWNER: this is the drawing surface. Size/borders live in styles.css (.canvas-wrap, canvas).
export default function DrawingCanvas({ strokes, onSample, cursorColor, cursorSize, background }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  const down = useRef(false);
  const [size, setSize] = useState({ w: 0, h: 0, dpr: 1 });
  const [hover, setHover] = useState<{ x: number; y: number } | null>(null);

  // Match the canvas pixels to its on-screen box; a fixed size would stretch strokes unevenly.
  useEffect(() => {
    const c = ref.current!;
    const measure = () => {
      const dpr = window.devicePixelRatio || 1;
      setSize({ w: Math.round(c.clientWidth * dpr), h: Math.round(c.clientHeight * dpr), dpr });
    };
    measure(); // size right away; the observer only reports later changes
    const ro = new ResizeObserver(measure);
    ro.observe(c);
    return () => ro.disconnect();
  }, []);

  // Redraw everything whenever strokes or size change.
  useEffect(() => {
    const c = ref.current!;
    if (!size.w || !size.h) return;
    c.width = size.w; // resizing also clears the canvas
    c.height = size.h;
    drawStrokes(c.getContext("2d")!, strokes, c.width, c.height, size.dpr);
  }, [strokes, size]);

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
      {background && <img className="board-bg" src={background} alt="" />}
      <canvas
        ref={ref}
        onPointerDown={(e) => { down.current = true; onSample(toPoint(e), true); }}
        onPointerMove={(e) => {
          setHover({ x: e.nativeEvent.offsetX, y: e.nativeEvent.offsetY });
          if (down.current) onSample(toPoint(e), true);
        }}
        onPointerUp={(e) => { down.current = false; onSample(toPoint(e), false); }}
        onPointerLeave={(e) => {
          setHover(null);
          if (down.current) { down.current = false; onSample(toPoint(e), false); }
        }}
      />
      {hover && (
        <div
          className="cursor-ring" aria-hidden="true"
          style={{ left: hover.x, top: hover.y, width: cursorSize, height: cursorSize, borderColor: cursorColor }}
        />
      )}
    </div>
  );
}