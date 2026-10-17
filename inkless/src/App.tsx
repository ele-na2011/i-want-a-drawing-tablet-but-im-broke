import { useCallback, useState } from "react";
import type { DrawingState, Point, TrackingStatus } from "./types";
import {
  allStrokes, beginStroke, clear, emptyDrawing,
  extendStroke, finishStroke, undo,
} from "./lib/strokes";
import DrawingCanvas from "./components/DrawingCanvas";
import Toolbar from "./components/Toolbar";
import StatusBar from "./components/StatusBar";
import SignIn from "./components/SignIn";
import Home from "./components/Home";
import "./styles.css";

export default function App() {
  const [view, setView] = useState<"signin" | "home" | "editor">("signin");
  const [drawing, setDrawing] = useState<DrawingState>(emptyDrawing);
  const [thickness, setThickness] = useState(4);
  const [status] = useState<TrackingStatus>("manual-mode");

  // ============ THE ONE FUNCTION EVERYONE FEEDS ============
  // Mouse input calls this now. Later the hand tracker calls it:
  //   onSample({x, y, t}, spaceHeld)
  // If tracking is lost, call it with penDown=false so the stroke ends cleanly.
  const onSample = useCallback(
    (p: Point, penDown: boolean) => {
      setDrawing((d) => {
        if (!penDown) return finishStroke(d);
        return d.active ? extendStroke(d, p) : beginStroke(d, p, thickness);
      });
    },
    [thickness]
  );

  const handleExport = () => {
    // TODO (Person 2): lib/exportPng.ts → draw strokes on white canvas → toBlob → download
    alert("Export not built yet");
  };

  if (view === "signin") return <SignIn onSignIn={() => setView("home")} />;
  if (view === "home") return <Home onOpenEditor={() => setView("editor")} />;

  return (
    <div className="app">
      {/* ---------- HEADER: logo / title ---------- */}
      <header className="header">
        <h1>Inkless</h1>
        <StatusBar status={status} />
      </header>

      <main className="main">
        {/* ---------- LEFT: camera preview + calibration ---------- */}
        <section className="camera-panel">
          {/* TODO (Person 1): <CameraView /> goes here */}
          {/* TODO (Person 3): <CalibrationOverlay /> goes on top of it */}
          <div className="placeholder">Camera goes here</div>
        </section>

        {/* ---------- RIGHT: drawing canvas ---------- */}
        <section className="canvas-panel">
          <DrawingCanvas strokes={allStrokes(drawing)} onSample={onSample} />
        </section>
      </main>

      {/* ---------- FOOTER: tools ---------- */}
      <footer className="footer">
        <Toolbar
          thickness={thickness}
          onThickness={setThickness}
          onUndo={() => setDrawing((d) => undo(d))}
          onClear={() => setDrawing(clear())}
          onExport={handleExport}
        />
      </footer>
    </div>
  );
}