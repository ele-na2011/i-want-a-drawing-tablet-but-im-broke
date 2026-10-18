import { useEffect, useRef, useState } from "react";
import { findHomography, type CalibrationPoint, type Homography } from "../lib/homography";
import { previewToVideoPoint, videoToPreviewPoint } from "../lib/preview";
import StatusBar from "./StatusBar";
import type { TrackingStatus } from "../types";
import type { HandTrackingStatus } from "../lib/useHandTracking";
import type { LedTrackingStatus } from "../lib/useLedTracking";
import { DOWN_BELOW, type ZCalibration } from "../lib/ledDetect";

interface Props {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  secondaryVideoRef: React.RefObject<HTMLVideoElement | null>;
  activeCameraCount: number;
  cameraStatus: "idle" | "requesting" | "ready" | "error";
  cameraError: string | null;
  calibrated: boolean;
  onCalibrated: (homography: Homography | null) => void;
  cameras: { deviceId: string; label: string }[];
  selectedCamera: string;
  onSelectCamera: (deviceId: string) => void;
  onStartCamera: (deviceId?: string) => void;
  tracking: boolean;
  trackerStatus: HandTrackingStatus | LedTrackingStatus; // of the tracker trackingMode picks
  trackerError: string | null;
  onTracking: (enabled: boolean) => void;
  trackingMode: "pen" | "finger";
  onTrackingMode: (mode: "pen" | "finger") => void;
  onVideoMount: () => void;
  ledPoint: CalibrationPoint | null; // where the pen LED was last seen, in raw video coordinates
  sideLedPoint: CalibrationPoint | null; // same, in the bottom camera
  penHeight: number | null; // 0 on the paper, 1 at the lifted reference
  zCalibrated: boolean;
  onZCalibrated: (calibration: ZCalibration) => void;
  ledThreshold: number;
  onLedThreshold: (threshold: number) => void;
  ledMode: "green" | "bright";
  onLedMode: (mode: "green" | "bright") => void;
  ledFps: number;
  automaticSurface: boolean;
  onAutomaticSurface: (value: boolean) => void;
  onDrawPress: () => void;
  onDrawRelease: () => void;
}

const destination: CalibrationPoint[] = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }];
const labels = ["top-left", "top-right", "bottom-right", "bottom-left"];

export default function CalibrationOverlay({ videoRef, secondaryVideoRef, activeCameraCount, cameraStatus, cameraError, calibrated, onCalibrated, cameras, selectedCamera, onSelectCamera, onStartCamera, tracking, trackerStatus, trackerError, onTracking, trackingMode, onTrackingMode, onVideoMount, ledPoint, sideLedPoint, penHeight, zCalibrated, onZCalibrated, ledThreshold, onLedThreshold, ledMode, onLedMode, ledFps, automaticSurface, onAutomaticSurface, onDrawPress, onDrawRelease }: Props) {
  const targetName = trackingMode === "pen" ? "LED" : "Index fingertip";
  const [xyError, setXyError] = useState<string | null>(null);
  const [points, setPoints] = useState<CalibrationPoint[]>([]);
  const [calibrationPoints, setCalibrationPoints] = useState<CalibrationPoint[]>([]);
  const [touchY, setTouchY] = useState<number | null>(null);
  const [zError, setZError] = useState<string | null>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const sidePreviewRef = useRef<HTMLDivElement>(null);
  useEffect(onVideoMount, [onVideoMount]);
  const status: TrackingStatus = tracking && trackerStatus === "ready" && calibrated
    ? "tracking"
    : tracking && (trackerStatus === "hand-not-found" || trackerStatus === "led-not-found")
      ? trackerStatus
      : calibrated
    ? "tracking"
    : cameraStatus === "ready"
      ? "calibrating"
      : "camera-off";


  const setLifted = (hoverY: number) => {
    // Too close and every bit of detector jitter flips the pen up and down.
    if (touchY === null || Math.abs(hoverY - touchY) < 0.02) {
      setZError("The lifted target is too close to its touching position. Lift the finger or pen about 1 cm and try again.");
      return;
    }
    setZError(null);
    onZCalibrated({ touchY, hoverY });
    setTouchY(null);
  };

  const reset = () => {
    onCalibrated(null);
    setXyError(null);
    setPoints([]);
    setCalibrationPoints([]);
  };
  const preview = previewRef.current;
  const video = videoRef.current;
  const marker = ledPoint && preview && video
    ? videoToPreviewPoint(ledPoint, preview.getBoundingClientRect(), video)
    : null;

  // previewPoint is where the corner shows on the preview, videoPoint where it is in the raw frame.
  const addCorner = (previewPoint: CalibrationPoint, videoPoint: CalibrationPoint) => {
    if (cameraStatus !== "ready" || points.length >= 4) return;
    if (![previewPoint.x, previewPoint.y, videoPoint.x, videoPoint.y].every(Number.isFinite)) return;
    if (calibrationPoints.some(p => Math.hypot(p.x - videoPoint.x, p.y - videoPoint.y) < 0.04)) {
      setXyError("This corner is too close to an earlier one. Move the fingertip or LED to the next corner before capturing.");
      return;
    }
    const next = [...points, previewPoint];
    const nextCalibration = [...calibrationPoints, videoPoint];
    if (next.length === 4) {
      try {
        const turns = next.map((p, i) => {
          const q = next[(i + 1) % 4], r = next[(i + 2) % 4];
          return (q.x - p.x) * (r.y - q.y) - (q.y - p.y) * (r.x - q.x);
        });
        if (!turns.every(t => t > 0.001)) {
          throw new Error("Use the preview's corners in order: top-left, top-right, bottom-right, bottom-left. Press Recalibrate to restart.");
        }
        onCalibrated(findHomography(nextCalibration, destination));
      } catch (e) {
        setXyError(e instanceof Error ? e.message : String(e));
        return;
      }
    }
    setXyError(null);
    setPoints(next);
    setCalibrationPoints(nextCalibration);
  };

  const sidePreview = sidePreviewRef.current;
  const sideVideo = secondaryVideoRef.current;
  const sideMarker = sideLedPoint && sidePreview && sideVideo
    ? videoToPreviewPoint(sideLedPoint, sidePreview.getBoundingClientRect(), sideVideo)
    : null;

  const capture = (event: React.PointerEvent<HTMLDivElement>) => {
    if (tracking) return; // use Capture corner; clicking preview must not add another point
    const rect = event.currentTarget.getBoundingClientRect();
    const point = { x: (event.clientX - rect.left) / rect.width, y: (event.clientY - rect.top) / rect.height };
    addCorner(point, previewToVideoPoint(
      point,
      { width: rect.width, height: rect.height },
      { videoWidth: videoRef.current?.videoWidth ?? 0, videoHeight: videoRef.current?.videoHeight ?? 0 },
    ));
  };

  // shortcut: one frame's LED position; average a few frames if corners come out jittery.
  const captureLed = () => {
    if (ledPoint && marker) addCorner(marker, ledPoint);
  };

  return (
    <div className="camera-content">
      {xyError && <p className="camera-error" role="alert">{xyError}</p>}
      {trackingMode === "pen" && <div className="tracking-mode">
        <label>LED detector <select value={ledMode} onChange={e => onLedMode(e.target.value as "green" | "bright")}>
          <option value="green">Green LED</option>
          <option value="bright">Bright / white LED core</option>
        </select></label>
        <label>Brightness cutoff: {ledThreshold}
          <input type="range" min="60" max="250" value={ledThreshold} onChange={e => onLedThreshold(Number(e.target.value))} />
        </label>

        <small>A green square marks a candidate, not a guarantee it is your LED. Move the pen and check the square follows it.</small>
      </div>}
      <small role="status">{ledFps} processed FPS · {ledPoint ? `${targetName} x=${ledPoint.x.toFixed(3)}, y=${ledPoint.y.toFixed(3)}` : `${targetName} not detected`}</small>
      <p className="tracking-message">Surface writing only. Point the top camera down at the desk so your entire writing area is visible.</p>
      <div className="camera-preview" ref={previewRef} onPointerDown={capture} role="application" aria-label="Camera calibration surface">
        <video className="camera-video-mirrored" ref={videoRef} muted playsInline />
        {points.map((point, i) => <span className="calibration-point" key={`${point.x}-${point.y}`} style={{ left: `${point.x * 100}%`, top: `${point.y * 100}%` }} aria-label={labels[i]} />)}
        {marker && <span className="led-marker" style={{ left: `${marker.x * 100}%`, top: `${marker.y * 100}%` }} aria-label={targetName}>{targetName}</span>}
        {cameraStatus === "ready" && points.length < 4 && (
          <p className="calibration-hint">
            {tracking
              ? `Place your ${trackingMode === "pen" ? "pen tip" : "index fingertip"} on the surface at the preview's ${labels[points.length]} corner, then press Capture corner`
              : `Tap ${labels[points.length]} corner`}
          </p>
        )}
      </div>
      {/* The bottom camera gets its own box, so it never covers a corner of the main preview. */}
      <div className="camera-secondary-feed" ref={sidePreviewRef} hidden={activeCameraCount < 2}>
        <video ref={secondaryVideoRef} muted playsInline aria-label="Bottom camera feed" />
        {sideMarker && <span className="led-marker" style={{ left: `${sideMarker.x * 100}%`, top: `${sideMarker.y * 100}%` }} aria-label={`${targetName}, side camera`}>{targetName}</span>}
      </div>
      {tracking && points.length < 4 && (
        <button type="button" disabled={!marker} onClick={captureLed}>
          {marker ? `Capture ${labels[points.length]} corner` : `Capture corner (${targetName} not seen)`}
        </button>
      )}
      <div className="camera-controls">
        <StatusBar status={status} />
        <span className="camera-count" aria-label={`${activeCameraCount} of 2 cameras active`}>
          Two-camera setup: {activeCameraCount}/2 active
        </span>
        {cameraError && <p className="camera-error">{cameraError}</p>}
        {cameraStatus !== "ready" && <button onClick={() => onStartCamera(selectedCamera || undefined)}>{cameraStatus === "requesting" ? "Opening camera..." : "Enable camera"}</button>}
        {cameraStatus === "ready" && <button onClick={reset}>{points.length === 4 ? "Recalibrate" : "Calibrate workspace"}</button>}
      </div>
      {cameras.length > 0 && (
        <label className="camera-select">
          Webcam
          <select value={selectedCamera} onChange={(event) => onSelectCamera(event.target.value)}>
            {cameras.map((camera) => <option value={camera.deviceId} key={camera.deviceId}>{camera.label}</option>)}
          </select>
          <button type="button" onClick={() => onStartCamera(selectedCamera)}>Use selected</button>
        </label>
      )}
      <div className="tracking-mode" aria-label="Tracking method">
        <strong>Tracking method</strong>
        <div>
          <button type="button" aria-pressed={trackingMode === "pen"} onClick={() => { onTrackingMode("pen"); onTracking(true); }}>
            Pen + LED
          </button>
          <button type="button" aria-pressed={trackingMode === "finger"} onClick={() => { onTrackingMode("finger"); onTracking(true); }}>
            Index finger on surface
          </button>
        </div>
      </div>
      {!calibrated && <p className="tracking-message">Start tracking first. A green square should follow your {targetName.toLowerCase()} before you capture any corners. Capturing corners never draws.</p>}
      {(cameraStatus === "ready") && (
        <button className="finger-toggle" type="button" aria-pressed={tracking} onClick={() => onTracking(!tracking)}>
          {trackingMode === "pen"
            ? tracking ? "Stop pen tracking" : "Track pen LED"
            : tracking ? "Stop finger tracking" : "Track index fingertip"}
        </button>
      )}
      {tracking && activeCameraCount === 2 && (
        <div className="tracking-mode" aria-label="Pen height calibration">
          <strong>Surface contact (side camera){zCalibrated ? " · calibrated" : ""}</strong>
          {!sideLedPoint && <p className="tracking-message">The side camera cannot see the target. Point it across the surface at fingertip / pen-tip height.</p>}
          <div>
            <button type="button" disabled={!sideLedPoint} onClick={() => { setTouchY(sideLedPoint!.y); setZError(null); }}>
              1. Tip touching surface{touchY !== null ? " ✓" : ""}
            </button>
            <button type="button" disabled={!sideLedPoint || touchY === null} onClick={() => setLifted(sideLedPoint!.y)}>
              2. Tip lifted
            </button>
          </div>
          {zError && <p className="camera-error">{zError}</p>}
          {!zCalibrated && <p className="tracking-message">Required for automatic surface mode. Manual Hold to draw works without this calibration.</p>}
          {penHeight !== null && <small>Height {penHeight.toFixed(2)} · {penHeight < DOWN_BELOW ? "near surface" : "lifted"}</small>}
        </div>
      )}
      {trackerStatus === "loading" && <p className="tracking-message">Starting {trackingMode === "pen" ? "LED detector" : "hand model"}...</p>}
      {trackerError && <p className="camera-error">{trackerError}</p>}
      <div className="sensor-card" aria-label="Surface drawing controls">
        <strong>Surface drawing</strong>
        <label><input type="checkbox" checked={automaticSurface} disabled={!automaticSurface && (activeCameraCount < 2 || !zCalibrated)}
          onChange={e => onAutomaticSurface(e.target.checked)} /> Automatic surface estimate (experimental)</label>
        {!automaticSurface && <>
          <small>Move along the desk while holding Space or this button. Release before lifting or repositioning. Merely detecting a finger / LED never draws.</small>
          <button type="button" disabled={!calibrated || !tracking} style={{ touchAction: "none" }}
            onPointerDown={e => { e.currentTarget.setPointerCapture(e.pointerId); onDrawPress(); }}
            onPointerUp={onDrawRelease} onPointerCancel={onDrawRelease} onLostPointerCapture={onDrawRelease}
            onKeyDown={e => { if (e.code === "Space" || e.code === "Enter") { e.preventDefault(); onDrawPress(); } }}
            onKeyUp={onDrawRelease} onBlur={onDrawRelease}>Hold to draw on surface</button>
        </>}
        <small>{automaticSurface ? "Drawing uses the calibrated side-camera contact estimate. If the target is lost, drawing stops." : "Manual control is active. Physical contact is not measured in this mode."}</small>
      </div>
    </div>
  );
}
