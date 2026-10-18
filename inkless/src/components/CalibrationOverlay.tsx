import { useEffect, useId, useRef, useState } from "react";
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
  onPage: boolean; // the tracked tip maps inside the page
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

export default function CalibrationOverlay({ videoRef, secondaryVideoRef, activeCameraCount, cameraStatus, cameraError, calibrated, onCalibrated, cameras, selectedCamera, onSelectCamera, selectedSecondaryCamera, onSelectSecondaryCamera, onStartCamera, tracking, trackerStatus, trackerError, onTracking, trackingMode, onTrackingMode, onVideoMount, ledPoint, sideLedPoint, penHeight, zCalibrated, onPage, onZCalibrated, ledThreshold: _ledThreshold, onLedThreshold: _onLedThreshold, ledMode: _ledMode, onLedMode: _onLedMode, ledFps: _ledFps, automaticSurface: _automaticSurface, onAutomaticSurface: _onAutomaticSurface, onDrawPress: _onDrawPress, onDrawRelease: _onDrawRelease }: Props): import("react").JSX.Element {
  const [, setXyError] = useState<string | null>(null);
  const [points, setPoints] = useState<CalibrationPoint[]>([]);
  const [calibrationPoints, setCalibrationPoints] = useState<CalibrationPoint[]>([]);
  const [touchY, setTouchY] = useState<number | null>(null);
  const [zError, setZError] = useState<string | null>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const sidePreviewRef = useRef<HTMLDivElement>(null);
  const pickerId = useId(); // this overlay can be mounted twice (side panel + calibration dialog)
  useEffect(onVideoMount, [onVideoMount]);
  const [redoingCorners, setRedoingCorners] = useState(false);
  const pen = trackingMode === "pen";
  const camerasOn = cameraStatus === "ready";
  // The other overlay (home vs editor) may have set the corners, so the shared homography counts too.
  const cornersDone = points.length === 4 || (calibrated && !redoingCorners);
  const status: TrackingStatus = tracking && trackerStatus === "ready" && calibrated
    ? "tracking"
    : tracking && (trackerStatus === "hand-not-found" || trackerStatus === "led-not-found")
      ? trackerStatus
      : calibrated
    ? "tracking"
    : camerasOn
      ? "calibrating"
      : "camera-off";
  // The one thing still stopping you from drawing, so nobody has to guess.
  const nextStep = !camerasOn
    ? "Turn on the cameras."
    : !tracking
      ? `Press ${pen ? "Start pen tracking" : "Start finger tracking"}.`
      : trackerStatus === "loading"
        ? "Loading the tracking model..."
        : !cornersDone
          ? pen ? `Put the pen tip on the paper's ${labels[points.length]} corner and press Capture.` : `Tap the paper's ${labels[points.length]} corner in the preview.`
          : pen && activeCameraCount < 2
            ? "Connect the webcam (Z) so the app can tell when the pen touches the paper."
            : pen && !zCalibrated
              ? "Set the pen height: tip on the paper, then lifted."
              : pen && !ledPoint
                ? "Camera 1 can't see the pen LED."
                : pen && !onPage
                  ? "The pen is off the page. Move it onto the paper, or redo the corners."
                  : "Ready! Touch the paper to draw.";

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
    setRedoingCorners(true);
  };
  const preview = previewRef.current;
  const video = videoRef.current;
  const marker = ledPoint && preview && video
    ? videoToPreviewPoint(ledPoint, preview.getBoundingClientRect(), video)
    : null;

  // previewPoint is where the corner shows on the preview, videoPoint where it is in the raw frame.
  const addCorner = (previewPoint: CalibrationPoint, videoPoint: CalibrationPoint) => {
    if (!camerasOn || cornersDone) return;
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
    if (next.length === 4) {
      onCalibrated(findHomography(nextCalibration, destination));
      setRedoingCorners(false);
    }
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
      <div className="calibration-next">
        <StatusBar status={status} />
        <p>{nextStep}</p>
      </div>

      <section className="calibration-step" data-done={camerasOn && (!pen || activeCameraCount === 2)}>
        <h3>1. Cameras <span>{activeCameraCount}/2 on</span></h3>
        {cameras.length > 0 && (
          <div className="camera-select">
            <label htmlFor={`${pickerId}-xy`}>Camera 1 (X/Y)</label>
            <select id={`${pickerId}-xy`} value={selectedCamera} onChange={(event) => onSelectCamera(event.target.value)}>
              {cameras.map((camera) => <option value={camera.deviceId} key={camera.deviceId}>{camera.label}</option>)}
            </select>
            <label htmlFor={`${pickerId}-z`}>Webcam (Z)</label>
            <select id={`${pickerId}-z`} value={selectedSecondaryCamera} onChange={(event) => onSelectSecondaryCamera(event.target.value)}>
              <option value="">Any other camera</option>
              {cameras.filter((camera) => camera.deviceId !== selectedCamera).map((camera) => <option value={camera.deviceId} key={camera.deviceId}>{camera.label}</option>)}
            </select>
          </div>
        )}
        {/* Camera 1 sets the corners, the webcam sets pen height: after swapping them, redo both. */}
        <button className="step-action" type="button" disabled={cameraStatus === "requesting"} onClick={() => onStartCamera(selectedCamera || undefined, selectedSecondaryCamera || undefined)}>
          {cameraStatus === "requesting" ? "Opening cameras..." : camerasOn ? "Use these cameras" : "Turn on cameras"}
        </button>
        {cameraError && <p className="camera-error">{cameraError}</p>}
      </section>

      <section className="calibration-step" data-done={tracking && trackerStatus === "ready"}>
        <h3>2. Track</h3>
        <div className="tracking-mode" role="group" aria-label="Tracking method">
          <button type="button" aria-pressed={pen} onClick={() => { onTrackingMode("pen"); onTracking(false); }}>Pen + green LED</button>
          <button type="button" aria-pressed={!pen} onClick={() => { onTrackingMode("finger"); onTracking(false); }}>Index finger</button>
        </div>
        <button className="step-action" type="button" aria-pressed={tracking} disabled={!camerasOn} onClick={() => onTracking(!tracking)}>
          {tracking ? "Stop tracking" : pen ? "Start pen tracking" : "Start finger tracking"}
        </button>
        {trackerError && <p className="camera-error">{trackerError}</p>}
      </section>

      <section className="calibration-step" data-done={cornersDone}>
        <h3>3. Page corners <span>{cornersDone ? "done" : `${points.length}/4`}</span></h3>
        <div className="camera-preview" ref={previewRef} onPointerDown={pen ? undefined : capture} role="application" aria-label="Camera 1 preview">
          <video className="camera-video-mirrored" ref={videoRef} muted playsInline />
          {points.map((point, i) => <span className="calibration-point" key={`${point.x}-${point.y}`} style={{ left: `${point.x * 100}%`, top: `${point.y * 100}%` }} aria-label={labels[i]} />)}
          {marker && <span className="led-marker" style={{ left: `${marker.x * 100}%`, top: `${marker.y * 100}%` }} aria-label="Pen LED" />}
        </div>
        {cornersDone
          ? <button className="step-action secondary" type="button" disabled={!camerasOn} onClick={reset}>Redo corners</button>
          : pen && (
            <button className="step-action" type="button" disabled={!tracking || !marker} onClick={captureLed}>
              {!tracking ? "Start tracking first" : marker ? `Capture ${labels[points.length]} corner` : "Can't see the LED"}
            </button>
          )}
      </section>

      {/* Always mounted, even in finger mode: the tracker reads this video through secondaryVideoRef. */}
      <section className="calibration-step" data-done={zCalibrated} hidden={!pen}>
        <h3>4. Pen height <span>{penHeight === null ? "" : penHeight < DOWN_BELOW ? "pen down" : "pen up"}</span></h3>
        <div className="camera-secondary-feed" ref={sidePreviewRef} hidden={activeCameraCount < 2}>
          <video ref={secondaryVideoRef} muted playsInline aria-label="Webcam (Z) feed" />
          {sideMarker && <span className="led-marker" style={{ left: `${sideMarker.x * 100}%`, top: `${sideMarker.y * 100}%` }} aria-label="Pen LED, webcam" />}
        </div>
        {activeCameraCount < 2
          ? <p className="tracking-message">Needs the webcam (Z) from step 1.</p>
          : !tracking
            ? <p className="tracking-message">Start tracking first.</p>
            : (
              <>
                {!sideLedPoint && <p className="tracking-message">The webcam can't see the LED. Point it across the paper at tip height.</p>}
                <div className="tracking-mode">
                  <button type="button" disabled={!sideLedPoint} onClick={() => { setTouchY(sideLedPoint!.y); setZError(null); }}>
                    Tip on paper{touchY !== null ? " ✓" : ""}
                  </button>
                  <button type="button" disabled={!sideLedPoint || touchY === null} onClick={() => setLifted(sideLedPoint!.y)}>
                    Tip lifted
                  </button>
                </div>
              </>
            )}
        {zError && <p className="camera-error">{zError}</p>}
      </section>
    </div>
  );
}
