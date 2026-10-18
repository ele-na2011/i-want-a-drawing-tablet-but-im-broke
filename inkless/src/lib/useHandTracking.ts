import { useEffect, useRef, useState, type RefObject } from 'react';
import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';
import { project, type CalibrationPoint, type Homography } from './homography';
import { zLevel, type ZCalibration } from './ledDetect';
import { surfaceAllowsDrawing } from './surfaceGate';
import type { Point } from '../types';

export type HandTrackingStatus = 'off' | 'loading' | 'ready' | 'hand-not-found' | 'error';
const WASM_ROOT = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.1.1/wasm';
const MODEL_URL = 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';
interface Options {
  videoRef: RefObject<HTMLVideoElement | null>;
  sideVideoRef: RefObject<HTMLVideoElement | null>;
  homography: Homography | null;
  zCalibration: ZCalibration | null;
  drawHeld: RefObject<boolean>;
  automatic: boolean;
  enabled: boolean;
  onSample: (point: Point, penDown: boolean) => void;
}
interface State {
  status: HandTrackingStatus; error: string | null;
  point: CalibrationPoint | null; sidePoint: CalibrationPoint | null;
  pagePoint: CalibrationPoint | null; z: number | null; fps: number;
}
const initial: State = { status: 'off', error: null, point: null, sidePoint: null, pagePoint: null, z: null, fps: 0 };

export function useHandTracking(options: Options) {
  const latest = useRef(options); latest.current = options;
  const [state, setState] = useState<State>(initial);
  useEffect(() => {
    if (!options.enabled) { setState(initial); return; }
    let cancelled = false, frame = 0;
    let topModel: HandLandmarker | null = null, sideModel: HandLandmarker | null = null;
    let topTime = -1, sideTime = -1, lastTick = -Infinity, lastPublish = -Infinity;
    let topSeen = -Infinity, sideSeen = -Infinity;
    let sidePoint: CalibrationPoint | null = null, smooth: CalibrationPoint | null = null;
    let down = false, confirmed = 0;
    let transform: Homography | null = null;
    let lastPoint: Point = { x: 0.5, y: 0.5, t: 0 };
    let count = 0, fps = 0, fpsStart = performance.now();
    const canvases = [document.createElement('canvas'), document.createElement('canvas')];
    const contexts = canvases.map(c => c.getContext('2d')!);
    const sample = (video: HTMLVideoElement, model: HandLandmarker, index: number, now: number) => {
      const c = canvases[index];
      const height = Math.max(1, Math.round(320 * video.videoHeight / video.videoWidth));
      if (c.width !== 320 || c.height !== height) { c.width = 320; c.height = height; }
      contexts[index].drawImage(video, 0, 0, c.width, c.height);
      const tip = model.detectForVideo(c, now).landmarks[0]?.[8];
      return tip && Number.isFinite(tip.x) && Number.isFinite(tip.y) ? { x: tip.x, y: tip.y } : null;
    };
    const end = (now: number) => {
      down = false; confirmed = 0; smooth = null;
      latest.current.onSample({ ...lastPoint, t: now }, false);
    };
    const fail = (e: unknown) => {
      if (cancelled) return;
      end(performance.now());
      setState({ ...initial, status: 'error', error: e instanceof Error ? e.message : String(e) });
      cancelled = true;
      topModel?.close(); sideModel?.close(); topModel = sideModel = null;
    };
    function tick(now: number) {
      if (cancelled) return;
      try {
        const o = latest.current, video = o.videoRef.current, side = o.sideVideoRef.current;
        // Up to 20 processed frames/sec; no inference on duplicate video frames.
        if (now - lastTick >= 50 && video && video.readyState >= 2 && video.videoWidth && video.currentTime !== topTime) {
          lastTick = now; topTime = video.currentTime; topSeen = now;
          const point = sample(video, topModel!, 0, now);
          if (sideModel && side?.srcObject && side.readyState >= 2 && side.videoWidth && side.currentTime !== sideTime) {
            sideTime = side.currentTime; sideSeen = now;
            sidePoint = sample(side, sideModel, 1, now);
          }
          if (!side?.srcObject || now - sideSeen > 180) sidePoint = null;
          const z = sidePoint && o.zCalibration && Math.abs(o.zCalibration.hoverY - o.zCalibration.touchY) >= 0.02
            ? zLevel(sidePoint.y, o.zCalibration) : null;
          if (o.homography !== transform) { end(now); transform = o.homography; }
          let pagePoint: CalibrationPoint | null = null;
          let error: string | null = null;
          if (point && transform) {
            const mapped = project(point, transform);
            if ([mapped.x, mapped.y].every(Number.isFinite) && mapped.x >= 0 && mapped.x <= 1 && mapped.y >= 0 && mapped.y <= 1) {
              if (smooth && Math.hypot(mapped.x - smooth.x, mapped.y - smooth.y) > 0.2) end(now);
              smooth = smooth ? { x: smooth.x * 0.25 + mapped.x * 0.75, y: smooth.y * 0.25 + mapped.y * 0.75 } : mapped;
              pagePoint = smooth;
              const allowed = surfaceAllowsDrawing(o.automatic, o.drawHeld.current, z, down);
              if (!allowed) { down = false; confirmed = 0; }
              else if (!down) down = ++confirmed >= 2;
              lastPoint = { ...smooth, t: now };
              o.onSample(lastPoint, down);
            } else { end(now); error = 'Fingertip is outside the calibrated surface.'; }
          } else end(now); // Detection still runs before calibration, but cannot draw.
          count++;
          if (now - fpsStart >= 1000) { fps = Math.round(count * 1000 / (now - fpsStart)); count = 0; fpsStart = now; }
          if (now - lastPublish >= 100) {
            lastPublish = now;
            setState({ status: point ? 'ready' : 'hand-not-found', error, point, sidePoint, pagePoint, z, fps });
          }
        } else if (now - topSeen > 180) {
          end(now);
          if (now - lastPublish >= 100) {
            lastPublish = now;
            setState(s => ({ ...s, status: 'hand-not-found', point: null, sidePoint: null, pagePoint: null, z: null }));
          }
        }
        frame = requestAnimationFrame(tick);
      } catch (e) { fail(e); }
    }
    async function start() {
      setState({ ...initial, status: 'loading' });
      try {
        const vision = await FilesetResolver.forVisionTasks(WASM_ROOT);
        if (cancelled) return;
        const create = () => HandLandmarker.createFromOptions(vision, {
          baseOptions: { modelAssetPath: MODEL_URL, delegate: 'GPU' },
          runningMode: 'VIDEO', numHands: 1,
          minHandDetectionConfidence: 0.65, minHandPresenceConfidence: 0.65, minTrackingConfidence: 0.65,
        }).catch(() => HandLandmarker.createFromOptions(vision, {
          baseOptions: { modelAssetPath: MODEL_URL, delegate: 'CPU' },
          runningMode: 'VIDEO', numHands: 1,
          minHandDetectionConfidence: 0.65, minHandPresenceConfidence: 0.65, minTrackingConfidence: 0.65,
        }));
        const top = await create();
        if (cancelled) { top.close(); return; }
        topModel = top;
        if (latest.current.sideVideoRef.current?.srcObject) {
          const side = await create();
          if (cancelled) { side.close(); return; }
          sideModel = side;
        }
        frame = requestAnimationFrame(tick);
      } catch (e) { fail(e); }
    }
    void start();
    return () => {
      cancelled = true; cancelAnimationFrame(frame); end(performance.now());
      topModel?.close(); sideModel?.close();
    };
  }, [options.enabled]);
  return state;
}
