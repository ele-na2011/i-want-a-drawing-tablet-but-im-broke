import { useEffect, useRef, useState, type RefObject } from "react";
import * as ort from "onnxruntime-web/webgpu";
import { project, type Homography } from "./homography";
import { INPUT, letterbox, pickLed, toTensor } from "./ledDetect";
import type { Point } from "../types";

export type LedTrackingStatus = "off" | "loading" | "ready" | "led-not-found" | "error";

// Same model as track_led.py (best.pt), exported with: YOLO("best.pt").export(format="onnx", imgsz=640, opset=17)
const MODEL_URL = "/models/green_led.onnx";
ort.env.wasm.wasmPaths = "https://cdn.jsdelivr.net/npm/onnxruntime-web@1.30.0/dist/"; // keep in step with package.json

interface Options {
  videoRef: RefObject<HTMLVideoElement | null>;
  homography: Homography | null;
  enabled: boolean;
  onSample: (point: Point, penDown: boolean) => void;
}

// shortcut: the pen counts as down whenever the LED is seen inside the page; switch to real contact
// sensing (pen_state.py / sensor fusion) once the hardware reports it.
export function useLedTracking({ videoRef, homography, enabled, onSample }: Options) {
  const [status, setStatus] = useState<LedTrackingStatus>("off");
  const [error, setError] = useState<string | null>(null);
  const [point, setPoint] = useState<{ x: number; y: number } | null>(null); // last LED seen, 0..1 in the raw video frame
  const callbackRef = useRef(onSample);
  const homographyRef = useRef(homography);
  callbackRef.current = onSample;
  homographyRef.current = homography;

  useEffect(() => {
    if (!enabled) {
      setStatus("off");
      setPoint(null);
      return;
    }
    let cancelled = false;
    let frame = 0;
    let busy = false;
    let lastTimestamp = -1;
    let session: ort.InferenceSession | null = null;
    let smoothed: { x: number; y: number } | null = null;
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
      callbackRef.current({ x: 0, y: 0, t: now }, false);
      reportStatus("led-not-found");
    };

    const detect = async (video: HTMLVideoElement, transform: Homography) => {
      const size = { width: video.videoWidth, height: video.videoHeight };
      const box = letterbox(size.width, size.height);
      ctx.fillStyle = "rgb(114, 114, 114)"; // ultralytics' letterbox grey
      ctx.fillRect(0, 0, INPUT, INPUT);
      ctx.drawImage(video, box.padX, box.padY, size.width * box.scale, size.height * box.scale);
      toTensor(ctx.getImageData(0, 0, INPUT, INPUT).data, input);
      const result = await session!.run({ images: new ort.Tensor("float32", input, [1, 3, INPUT, INPUT]) });
      if (cancelled) return;
      const now = performance.now();
      const led = pickLed(result.output0.data as Float32Array, box, size);
      setPoint(led && { x: led.x, y: led.y }); // shown on the camera preview, even outside the page
      if (!led) return lost(now);
      const mapped = project(led, transform);
      if (mapped.x < 0 || mapped.x > 1 || mapped.y < 0 || mapped.y > 1) return lost(now);
      smoothed = smoothed
        ? { x: smoothed.x * 0.3 + mapped.x * 0.7, y: smoothed.y * 0.3 + mapped.y * 0.7 }
        : mapped;
      callbackRef.current({ ...smoothed, t: now }, true);
      reportStatus("ready");
    };

    const track = () => {
      const video = videoRef.current;
      const transform = homographyRef.current;
      // Inference is async and can take longer than a frame, so skip frames while one is running.
      if (!busy && session && video && transform && video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA && video.currentTime !== lastTimestamp) {
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
        // WebGPU when the browser has it, otherwise the CPU (wasm) backend.
        const created = await ort.InferenceSession.create(MODEL_URL, { executionProviders: ["webgpu", "wasm"] });
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
  }, [enabled, videoRef]);

  return { status, error, point };
}
