import { useEffect, useRef, useState, type RefObject } from "react";
import { FilesetResolver, HandLandmarker } from "@mediapipe/tasks-vision";
import { project, type Homography } from "./homography";
import type { Point } from "../types";

export type HandTrackingStatus = "off" | "loading" | "ready" | "hand-not-found" | "error";

const WASM_ROOT = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.1.1/wasm";
const MODEL_URL = "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";

interface Options {
  videoRef: RefObject<HTMLVideoElement | null>;
  homography: Homography | null;
  enabled: boolean;
  onSample: (point: Point, penDown: boolean) => void;
}

export function useHandTracking({ videoRef, homography, enabled, onSample }: Options) {
  const [status, setStatus] = useState<HandTrackingStatus>("off");
  const [error, setError] = useState<string | null>(null);
  const callbackRef = useRef(onSample);
  const homographyRef = useRef(homography);
  callbackRef.current = onSample;
  homographyRef.current = homography;

  useEffect(() => {
    if (!enabled) {
      setStatus("off");
      return;
    }
    let cancelled = false;
    let frame = 0;
    let lastTimestamp = -1;
    let lastDetectionTime = 0;
    let landmarker: HandLandmarker | null = null;
    let smoothed: { x: number; y: number } | null = null;
    let lastReportedStatus: HandTrackingStatus = "loading";
    const reportStatus = (next: HandTrackingStatus) => {
      if (lastReportedStatus !== next) {
        lastReportedStatus = next;
        setStatus(next);
      }
    };

    const track = () => {
      const video = videoRef.current;
      const transform = homographyRef.current;
      const now = performance.now();
      if (!cancelled && now - lastDetectionTime >= 33 && video && transform && video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA && video.currentTime !== lastTimestamp) {
        lastDetectionTime = now;
        lastTimestamp = video.currentTime;
        const result = landmarker?.detectForVideo(video, now);
        const landmark = result?.landmarks[0]?.[8];
        if (landmark) {
          const mapped = project({ x: landmark.x, y: landmark.y }, transform);
          if (mapped.x >= 0 && mapped.x <= 1 && mapped.y >= 0 && mapped.y <= 1) {
            smoothed = smoothed
              ? { x: smoothed.x * 0.3 + mapped.x * 0.7, y: smoothed.y * 0.3 + mapped.y * 0.7 }
              : mapped;
            callbackRef.current({ ...smoothed, t: now }, true);
            reportStatus("ready");
          } else {
            smoothed = null;
            callbackRef.current({ x: 0, y: 0, t: now }, false);
            reportStatus("hand-not-found");
          }
        } else {
          smoothed = null;
          callbackRef.current({ x: 0, y: 0, t: now }, false);
          reportStatus("hand-not-found");
        }
      }
      if (!cancelled) frame = requestAnimationFrame(track);
    };

    const start = async () => {
      reportStatus("loading");
      setError(null);
      try {
        const vision = await FilesetResolver.forVisionTasks(WASM_ROOT);
        landmarker = await HandLandmarker.createFromOptions(vision, {
          baseOptions: { modelAssetPath: MODEL_URL, delegate: "GPU" },
          runningMode: "VIDEO",
          numHands: 1,
          minHandDetectionConfidence: 0.6,
          minHandPresenceConfidence: 0.6,
          minTrackingConfidence: 0.6,
        });
        if (cancelled) {
          landmarker.close();
          return;
        }
        track();
      } catch (reason) {
        if (!cancelled) {
          setError(reason instanceof Error ? reason.message : "The hand-tracking model could not be loaded.");
          setStatus("error");
        }
      }
    };
    start();
    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      landmarker?.close();
      callbackRef.current({ x: 0, y: 0, t: performance.now() }, false);
    };
  }, [enabled, videoRef]);

  return { status, error };
}
