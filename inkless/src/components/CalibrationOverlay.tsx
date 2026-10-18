import { useEffect, useRef, useState } from "react";
import { findHomography, type CalibrationPoint, type Homography } from "../lib/homography";
import { fuseSensors } from "../lib/sensorFusion";
import { previewToVideoPoint, videoToPreviewPoint } from "../lib/preview";
import StatusBar from "./StatusBar";
import type { TrackingStatus } from "../types";
import type { HandTrackingStatus } from "../lib/useHandTracking";
import type { LedTrackingStatus } from "../lib/useLedTracking";

interface Props {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  secondaryVideoRef: React.RefObject<HTMLVideoElement | null>;
  activeCameraCount: number;
  cameraStatus: "idle" | "requesting" | "ready" | "error";
  cameraError: string | null;
  calibrated: boolean;
  onCalibrated: (homography: Homography) => void;
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
}

const destination: CalibrationPoint[] = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }];
const labels = ["top-left", "top-right", "bottom-right", "bottom-left"];

export default function CalibrationOverlay({ videoRef, secondaryVideoRef, activeCameraCount, cameraStatus, cameraError, calibrated, onCalibrated, cameras, selectedCamera, onSelectCamera, onStartCamera, tracking, trackerStatus, trackerError, onTracking, trackingMode, onTrackingMode, onVideoMount, ledPoint }: Props) {
  const [points, setPoints] = useState<CalibrationPoint[]>([]);
  const [calibrationPoints, setCalibrationPoints] = useState<CalibrationPoint[]>([]);
  const previewRef = useRef<HTMLDivElement>(null);
  useEffect(onVideoMount, [onVideoMount]);
  const status: TrackingStatus = tracking && trackerStatus === "ready"
    ? "drawing"
    : tracking && (trackerStatus === "hand-not-found" || trackerStatus === "led-not-found")
      ? trackerStatus
      : calibrated
    ? "tracking"
    : cameraStatus === "ready"
      ? "calibrating"
      : "camera-off";
  const sensor = fuseSensors({ zLevel: 0.5, acoustic: calibrated ? 0.72 : 0, velocity: 0.08 });

  const reset = () => {
    setPoints([]);
    setCalibrationPoints([]);
  };
  const preview = previewRef.current;
  const video = videoRef.current;
  const marker = ledPoint && preview && video
    ? videoToPreviewPoint(ledPoint, preview.getBoundingClientRect(), video)
    : null;

  const capture = (event: React.PointerEvent<HTMLDivElement>) => {
    if (cameraStatus !== "ready" || points.length >= 4) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const next = [...points, { x: (event.clientX - rect.left) / rect.width, y: (event.clientY - rect.top) / rect.height }];
    const nextCalibration = [
      ...calibrationPoints,
      previewToVideoPoint(
        next[next.length - 1],
        { width: rect.width, height: rect.height },
        { videoWidth: videoRef.current?.videoWidth ?? 0, videoHeight: videoRef.current?.videoHeight ?? 0 },
      ),
    ];
    setPoints(next);
    setCalibrationPoints(nextCalibration);
    if (next.length === 4) {
      onCalibrated(findHomography(nextCalibration, destination));
    }
  };

  return (
    <div className="camera-content">
      <div className="camera-preview" ref={previewRef} onPointerDown={capture} role="application" aria-label="Camera calibration surface">
        <video className="camera-video-mirrored" ref={videoRef} muted playsInline />
        <video className="camera-video-mirrored camera-secondary-feed" ref={secondaryVideoRef} muted playsInline aria-label="Second camera feed" />
        {points.map((point, i) => <span className="calibration-point" key={`${point.x}-${point.y}`} style={{ left: `${point.x * 100}%`, top: `${point.y * 100}%` }} aria-label={labels[i]} />)}
        {marker && <span className="led-marker" style={{ left: `${marker.x * 100}%`, top: `${marker.y * 100}%` }} aria-label="Pen LED" />}
        {cameraStatus === "ready" && points.length < 4 && <p className="calibration-hint">Tap {labels[points.length]} corner</p>}
      </div>
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
          <button type="button" aria-pressed={trackingMode === "pen"} onClick={() => { onTrackingMode("pen"); onTracking(false); }}>
            Pen + green LED
          </button>
          <button type="button" aria-pressed={trackingMode === "finger"} onClick={() => { onTrackingMode("finger"); onTracking(false); }}>
            Index finger
          </button>
        </div>
      </div>
      {trackingMode === "pen" && !calibrated && (
        <p className="tracking-message">Pen mode: put the green LED on the pen tip, then calibrate the workspace. The pen draws while the LED is inside the page.</p>
      )}
      {calibrated && (
        <button className="finger-toggle" type="button" aria-pressed={tracking} onClick={() => onTracking(!tracking)}>
          {trackingMode === "pen"
            ? tracking ? "Stop pen tracking" : "Track pen LED"
            : tracking ? "Stop finger tracking" : "Track index finger"}
        </button>
      )}
      {trackerStatus === "loading" && <p className="tracking-message">Loading {trackingMode === "pen" ? "LED" : "hand"} model...</p>}
      {trackerError && <p className="camera-error">{trackerError}</p>}
      <div className="sensor-card" aria-label="Sensor fusion status">
        <strong>Sensor fusion</strong>
        <span>{sensor.label} · {Math.round(sensor.confidence * 100)}% confidence</span>
        <small>Z-height 45% · acoustic 35% · velocity 20%</small>
      </div>
    </div>
  );
}
