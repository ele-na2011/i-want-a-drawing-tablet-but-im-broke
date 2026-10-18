import { useEffect, useRef, useState, type RefObject } from "react";
import * as ort from "onnxruntime-web/webgpu";
import { project, type Homography } from "./homography";
import { INPUT, letterbox, nextPenDown, pickLed, toTensor, zLevel, type ZCalibration } from "./ledDetect";
import type { Point } from "../types";

export type LedTrackingStatus = "off" | "loading" | "ready" | "led-not-found" | "error";

// Same model as track_led.py (best.pt), exported with: YOLO("best.pt").export(format="onnx", imgsz=640, opset=17)
const MODEL_URL = "/models/green_led.onnx";
ort.env.wasm.wasmPaths = "https://cdn.jsdelivr.net/npm/onnxruntime-web@1.30.0/dist/"; // keep in step with package.json

interface Options {
  videoRef: RefObject<HTMLVideoElement | null>;
  homography: Homography | null;
  sideVideoRef: RefObject<HTMLVideoElement | null>; // the bottom camera, looking across the paper
  zCalibration: ZCalibration | null;
  enabled: boolean;
  onSample: (point: Point, penDown: boolean) => void;
}

// With the side camera calibrated, the pen is down when its LED is near the paper there (contact_detection.py).
// With one camera, it counts as down whenever the LED is seen inside the page.
export function useLedTracking({ videoRef, homography, sideVideoRef, zCalibration, enabled, onSample }: Options) {
  const [status, setStatus] = useState<LedTrackingStatus>("off");
  const [error, setError] = useState<string | null>(null);
  const [point, setPoint] = useState<{ x: number; y: number } | null>(null); // last LED seen, 0..1 in the raw video frame
  const [sidePoint, setSidePoint] = useState<{ x: number; y: number } | null>(null); // same, in the side camera
  const [z, setZ] = useState<number | null>(null);
  const [pagePoint, setPagePoint] = useState<{ x: number; y: number } | null>(null); // the tip on the page, 0..1, pen up or down
  const callbackRef = useRef(onSample);
  const homographyRef = useRef(homography);
  const zCalibrationRef = useRef(zCalibration);
  callbackRef.current = onSample;
  homographyRef.current = homography;
  zCalibrationRef.current = zCalibration;

  useEffect(() => {
    if (!enabled) {
      setStatus("off");
      setPoint(null);
      setSidePoint(null);
      setZ(null);
      setPagePoint(null);
      return;
    }
    let cancelled = false;
    let frame = 0;
    let busy = false;
    let lastTimestamp = -1;
    let session: ort.InferenceSession | null = null;
    let smoothed: { x: number; y: number } | null = null;
    let down = false;
    let lastReportedStatus: LedTrackingStatus = "loading";
    const reportStatus = (next: LedTrackingStatus) => {
      if (lastReportedStatus !== next) {
        lastReportedStatus = next;
        setStatus(next);
      }
    };
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = INPUT;
    const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
    const input = new Float32Array(3 * INPUT * INPUT);

    const lost = (now: number) => {
      smoothed = null;
      down = false;
      setPagePoint(null);
      callbackRef.current({ x: 0, y: 0, t: now }, false);
      reportStatus("led-not-found");
    };

    const findLed = async (video: HTMLVideoElement) => {
      const size = { width: video.videoWidth, height: video.videoHeight };
      const box = letterbox(size.width, size.height);
      ctx.fillStyle = "rgb(114, 114, 114)"; // ultralytics' letterbox grey
      ctx.fillRect(0, 0, INPUT, INPUT);
      ctx.drawImage(video, box.padX, box.padY, size.width * box.scale, size.height * box.scale);
      toTensor(ctx.getImageData(0, 0, INPUT, INPUT).data, input);
      const result = await session!.run({ images: new ort.Tensor("float32", input, [1, 3, INPUT, INPUT]) });
      return pickLed(result.output0.data as Float32Array, box, size);
    };

    const detect = async (video: HTMLVideoElement, transform: Homography | null) => {
      const led = await findLed(video);
      const side = sideVideoRef.current;
      const hasSide = !!side?.srcObject && side.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA;
      // Run even before z is calibrated, so the calibration buttons can read where the LED is.
      const sideLed = hasSide ? await findLed(side) : null;
      if (cancelled) return;
      const now = performance.now();
      setPoint(led && { x: led.x, y: led.y }); // shown on the camera preview, even outside the page
      setSidePoint(sideLed && { x: sideLed.x, y: sideLed.y });
      const cal = zCalibrationRef.current;
      const height = cal && sideLed ? zLevel(sideLed.y, cal) : null;
      setZ(height);
      if (!led) return lost(now);
      // No corners yet: the LED is only being located, for corner and height calibration.
      if (!transform) {
        callbackRef.current({ x: 0, y: 0, t: now }, false);
        return reportStatus("ready");
      }
      const mapped = project(led, transform);
      if (mapped.x < 0 || mapped.x > 1 || mapped.y < 0 || mapped.y > 1) return lost(now);
      smoothed = smoothed
        ? { x: smoothed.x * 0.3 + mapped.x * 0.7, y: smoothed.y * 0.3 + mapped.y * 0.7 }
        : mapped;
      setPagePoint(smoothed); // shown on the page even while lifted, so you can see where you'll write
      // Side camera on but not calibrated, or it lost the LED: stay up rather than draw stray lines.
      down = height !== null ? nextPenDown(height, down) : !hasSide;
      callbackRef.current({ ...smoothed, t: now }, down);
      reportStatus("ready");
    };

    const track = () => {
      const video = videoRef.current;
      const transform = homographyRef.current;
      // Inference is async and can take longer than a frame, so skip frames while one is running.
      if (!busy && session && video && video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA && video.currentTime !== lastTimestamp) {
        busy = true;
        lastTimestamp = video.currentTime;
        detect(video, transform)
          .catch((reason) => {
            if (cancelled) return;
            setError(reason instanceof Error ? reason.message : "LED detection failed.");
            setStatus("error");
            cancelled = true;
          })
          .finally(() => { busy = false; });
      }
      if (!cancelled) frame = requestAnimationFrame(track);
    };

    const start = async () => {
      reportStatus("loading");
      setError(null);
      try {
        // WebGPU runs a frame in ~30 ms off the main thread; the CPU fallback blocks the page ~200 ms per frame.
        const created = await ort.InferenceSession.create(MODEL_URL, { executionProviders: ["webgpu"] })
          .catch((reason) => {
            console.error("WebGPU session failed:", reason);
            setError(!("gpu" in navigator)
              ? "Chrome has WebGPU turned off here, so pen tracking runs on the CPU and will lag. Check chrome://gpu and that Settings → System → \"Use graphics acceleration\" is on."
              : `The GPU couldn't run the LED model (${reason instanceof Error ? reason.message : String(reason)}), so pen tracking runs on the CPU and will lag.`);
            return ort.InferenceSession.create(MODEL_URL, { executionProviders: ["wasm"] });
          });
        if (cancelled) {
          created.release();
          return;
        }
        session = created;
        track();
      } catch (reason) {
        if (!cancelled) {
          setError(reason instanceof Error ? reason.message : "The LED model could not be loaded.");
          setStatus("error");
        }
      }
    };
    start();
    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      session?.release();
      callbackRef.current({ x: 0, y: 0, t: performance.now() }, false);
    };
  }, [enabled, videoRef, sideVideoRef]);

  return { status, error, point, sidePoint, z, pagePoint };
}
