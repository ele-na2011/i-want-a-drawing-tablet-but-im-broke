import { useEffect, useId, useRef, useState } from "react";
import { findHomography, type CalibrationPoint, type Homography } from "../lib/homography";
import { fuseSensors } from "../lib/sensorFusion";
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
  onCalibrated: (homography: Homography) => void;
  cameras: { deviceId: string; label: string }[];
  selectedCamera: string;
  onSelectCamera: (deviceId: string) => void;
  selectedSecondaryCamera: string;
  onSelectSecondaryCamera: (deviceId: string) => void;
  onStartCamera: (deviceId?: string, secondaryDeviceId?: string) => void;
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
}

const destination: CalibrationPoint[] = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }];
const labels = ["top-left", "top-right", "bottom-right", "bottom-left"];

export default function CalibrationOverlay({ videoRef, secondaryVideoRef, activeCameraCount, cameraStatus, cameraError, calibrated, onCalibrated, cameras, selectedCamera, onSelectCamera, selectedSecondaryCamera, onSelectSecondaryCamera, onStartCamera, tracking, trackerStatus, trackerError, onTracking, trackingMode, onTrackingMode, onVideoMount, ledPoint, sideLedPoint, penHeight, zCalibrated, onZCalibrated }: Props) {
  const [points, setPoints] = useState<CalibrationPoint[]>([]);
  const [calibrationPoints, setCalibrationPoints] = useState<CalibrationPoint[]>([]);
  const [touchY, setTouchY] = useState<number | null>(null);
  const [zError, setZError] = useState<string | null>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const sidePreviewRef = useRef<HTMLDivElement>(null);
  const pickerId = useId(); // this overlay can be mounted twice (side panel + calibration dialog)
  useEffect(onVideoMount, [onVideoMount]);
  const status: TrackingStatus = tracking && trackerStatus === "ready" && calibrated
    ? "drawing"
    : tracking && (trackerStatus === "hand-not-found" || trackerStatus === "led-not-found")
      ? trackerStatus
      : calibrated
    ? "tracking"
    : cameraStatus === "ready"
      ? "calibrating"
      : "camera-off";
  const sensor = fuseSensors({ zLevel: 0.5, acoustic: calibrated ? 0.72 : 0, velocity: 0.08 });

  const setLifted = (hoverY: number) => {
    // Too close and every bit of detector jitter flips the pen up and down.
    if (touchY === null || Math.abs(hoverY - touchY) < 0.02) {
      setZError("The lifted LED is too close to the on-paper one. Lift the pen about 1 cm and try again.");
      return;
    }
    setZError(null);
    onZCalibrated({ touchY, hoverY });
    setTouchY(null);
  };

  const reset = () => {
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
    const next = [...points, previewPoint];
    const nextCalibration = [...calibrationPoints, videoPoint];
    setPoints(next);
    setCalibrationPoints(nextCalibration);
    if (next.length === 4) {
      onCalibrated(findHomography(nextCalibration, destination));
    }
  };

  const sidePreview = sidePreviewRef.current;
  const sideVideo = secondaryVideoRef.current;
  const sideMarker = sideLedPoint && sidePreview && sideVideo
    ? videoToPreviewPoint(sideLedPoint, sidePreview.getBoundingClientRect(), sideVideo)
    : null;

  const capture = (event: React.PointerEvent<HTMLDivElement>) => {
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
      <div className="camera-preview" ref={previewRef} onPointerDown={capture} role="application" aria-label="Camera calibration surface">
        <video className="camera-video-mirrored" ref={videoRef} muted playsInline />
        {points.map((point, i) => <span className="calibration-point" key={`${point.x}-${point.y}`} style={{ left: `${point.x * 100}%`, top: `${point.y * 100}%` }} aria-label={labels[i]} />)}
        {marker && <span className="led-marker" style={{ left: `${marker.x * 100}%`, top: `${marker.y * 100}%` }} aria-label="Pen LED" />}
        {cameraStatus === "ready" && points.length < 4 && (
          <p className="calibration-hint">
            {trackingMode === "pen" && tracking
              ? `Put the pen tip on the paper's ${labels[points.length]} corner, then press Capture corner`
              : `Tap ${labels[points.length]} corner`}
          </p>
        )}
      </div>
      {/* The bottom camera gets its own box, so it never covers a corner of the main preview. */}
      <div className="camera-secondary-feed" ref={sidePreviewRef} hidden={activeCameraCount < 2}>
        <video ref={secondaryVideoRef} muted playsInline aria-label="Bottom camera feed" />
        {sideMarker && <span className="led-marker" style={{ left: `${sideMarker.x * 100}%`, top: `${sideMarker.y * 100}%` }} aria-label="Pen LED, bottom camera" />}
      </div>
      {trackingMode === "pen" && tracking && points.length < 4 && (
        <button type="button" disabled={!marker} onClick={captureLed}>
          {marker ? `Capture ${labels[points.length]} corner` : "Capture corner (LED not seen)"}
        </button>
      )}
      <div className="camera-controls">
        <StatusBar status={status} />
        <span className="camera-count" aria-label={`${activeCameraCount} of 2 cameras active`}>
          Two-camera setup: {activeCameraCount}/2 active
        </span>
        {cameraError && <p className="camera-error">{cameraError}</p>}
        {cameraStatus !== "ready" && <button onClick={() => onStartCamera(selectedCamera || undefined, selectedSecondaryCamera || undefined)}>{cameraStatus === "requesting" ? "Opening camera..." : "Enable camera"}</button>}
        {cameraStatus === "ready" && <button onClick={reset}>{points.length === 4 ? "Recalibrate" : "Calibrate workspace"}</button>}
      </div>
      {cameras.length > 0 && (
        // Camera 1 sets the corners, the webcam sets pen height: after swapping them, redo both calibrations.
        <div className="camera-select">
          <label htmlFor={`${pickerId}-xy`}>Camera (X/Y)</label>
          <select id={`${pickerId}-xy`} value={selectedCamera} onChange={(event) => onSelectCamera(event.target.value)}>
            {cameras.map((camera) => <option value={camera.deviceId} key={camera.deviceId}>{camera.label}</option>)}
          </select>
          <button type="button" onClick={() => onStartCamera(selectedCamera, selectedSecondaryCamera || undefined)}>Use selected</button>
          <label htmlFor={`${pickerId}-z`}>Webcam (Z)</label>
          <select id={`${pickerId}-z`} value={selectedSecondaryCamera} onChange={(event) => onSelectSecondaryCamera(event.target.value)}>
            <option value="">Any other camera</option>
            {cameras.filter((camera) => camera.deviceId !== selectedCamera).map((camera) => <option value={camera.deviceId} key={camera.deviceId}>{camera.label}</option>)}
          </select>
        </div>
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
        <p className="tracking-message">Pen mode: put the green LED on the pen tip, press Track pen LED, then capture the four corners of the paper with the pen.</p>
      )}
      {(calibrated || (trackingMode === "pen" && cameraStatus === "ready")) && (
        <button className="finger-toggle" type="button" aria-pressed={tracking} onClick={() => onTracking(!tracking)}>
          {trackingMode === "pen"
            ? tracking ? "Stop pen tracking" : "Track pen LED"
            : tracking ? "Stop finger tracking" : "Track index finger"}
        </button>
      )}
      {trackingMode === "pen" && tracking && activeCameraCount < 2 && (
        <p className="tracking-message">Pen up/down needs the webcam (Z) too. Pick it under Webcam (Z) and press Use selected.</p>
      )}
      {trackingMode === "pen" && tracking && activeCameraCount === 2 && (
        <div className="tracking-mode" aria-label="Pen height calibration">
          <strong>Pen up / down (bottom camera){zCalibrated ? " · calibrated" : ""}</strong>
          {!sideLedPoint && <p className="tracking-message">The bottom camera can't see the LED. Point it across the paper at tip height.</p>}
          <div>
            <button type="button" disabled={!sideLedPoint} onClick={() => { setTouchY(sideLedPoint!.y); setZError(null); }}>
              1. Tip on paper{touchY !== null ? " ✓" : ""}
            </button>
            <button type="button" disabled={!sideLedPoint || touchY === null} onClick={() => setLifted(sideLedPoint!.y)}>
              2. Tip lifted
            </button>
          </div>
          {zError && <p className="camera-error">{zError}</p>}
          {!zCalibrated && <p className="tracking-message">Until this is set, the pen stays up and nothing is drawn.</p>}
          {penHeight !== null && <small>Height {penHeight.toFixed(2)} · {penHeight < DOWN_BELOW ? "pen down" : "pen up"}</small>}
        </div>
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
