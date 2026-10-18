import { useState } from "react";
import { findHomography, type CalibrationPoint, type Homography } from "../lib/homography";
import { fuseSensors } from "../lib/sensorFusion";
import StatusBar from "./StatusBar";
import type { TrackingStatus } from "../types";
import type { HandTrackingStatus } from "../lib/useHandTracking";

interface Props {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  cameraStatus: "idle" | "requesting" | "ready" | "error";
  cameraError: string | null;
  calibrated: boolean;
  onCalibrated: (homography: Homography) => void;
  cameras: { deviceId: string; label: string }[];
  selectedCamera: string;
  onSelectCamera: (deviceId: string) => void;
  onStartCamera: (deviceId?: string) => void;
  fingerTracking: boolean;
  handStatus: HandTrackingStatus;
  handError: string | null;
  onFingerTracking: (enabled: boolean) => void;
}

const destination: CalibrationPoint[] = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }];
const labels = ["top-left", "top-right", "bottom-right", "bottom-left"];

export default function CalibrationOverlay({ videoRef, cameraStatus, cameraError, calibrated, onCalibrated, cameras, selectedCamera, onSelectCamera, onStartCamera, fingerTracking, handStatus, handError, onFingerTracking }: Props) {
  const [points, setPoints] = useState<CalibrationPoint[]>([]);
  const status: TrackingStatus = fingerTracking && handStatus === "ready"
    ? "drawing"
    : fingerTracking && handStatus === "hand-not-found"
      ? "hand-not-found"
      : calibrated
    ? "tracking"
    : cameraStatus === "ready"
      ? "calibrating"
      : "camera-off";
  const sensor = fuseSensors({ zLevel: 0.5, acoustic: calibrated ? 0.72 : 0, velocity: 0.08 });

  const reset = () => setPoints([]);
  const capture = (event: React.PointerEvent<HTMLDivElement>) => {
    if (cameraStatus !== "ready" || points.length >= 4) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const next = [...points, { x: (event.clientX - rect.left) / rect.width, y: (event.clientY - rect.top) / rect.height }];
    setPoints(next);
    if (next.length === 4) {
      onCalibrated(findHomography(next, destination));
    }
  };

  return (
    <div className="camera-content">
      <div className="camera-preview" onPointerDown={capture} role="application" aria-label="Camera calibration surface">
        <video ref={videoRef} muted playsInline />
        {points.map((point, i) => <span className="calibration-point" key={`${point.x}-${point.y}`} style={{ left: `${point.x * 100}%`, top: `${point.y * 100}%` }} aria-label={labels[i]} />)}
        {cameraStatus === "ready" && points.length < 4 && <p className="calibration-hint">Tap {labels[points.length]} corner</p>}
      </div>
      <div className="camera-controls">
        <StatusBar status={status} />
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
      {calibrated && (
        <button className="finger-toggle" type="button" aria-pressed={fingerTracking} onClick={() => onFingerTracking(!fingerTracking)}>
          {fingerTracking ? "Stop finger tracking" : "Track index finger"}
        </button>
      )}
      {handStatus === "loading" && <p className="tracking-message">Loading hand model...</p>}
      {handError && <p className="camera-error">{handError}</p>}
      <div className="sensor-card" aria-label="Sensor fusion status">
        <strong>Sensor fusion</strong>
        <span>{sensor.label} · {Math.round(sensor.confidence * 100)}% confidence</span>
        <small>Z-height 45% · acoustic 35% · velocity 20%</small>
      </div>
    </div>
  );
}
