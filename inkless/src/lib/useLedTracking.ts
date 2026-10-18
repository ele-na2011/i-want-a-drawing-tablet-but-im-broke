import { useEffect, useRef, useState, type RefObject } from 'react';
import { project, type Homography } from './homography';
import { zLevel, type ZCalibration } from './ledDetect';
import { findBrightLed, createLedScratch, type LedBlob } from './fastLed';
import type { Point } from '../types';
import { surfaceAllowsDrawing } from './surfaceGate';
import { decodeTrainedLed, VerifiedLedTrack } from './trainedLed';
import type { InferenceSession } from 'onnxruntime-web';

export type LedTrackingStatus = 'off' | 'loading' | 'ready' | 'led-not-found' | 'error';
interface Options {
  videoRef: RefObject<HTMLVideoElement | null>;
  sideVideoRef: RefObject<HTMLVideoElement | null>;
  homography: Homography | null;
  zCalibration: ZCalibration | null;
  drawHeld: RefObject<boolean>;
  automatic: boolean;
  enabled: boolean;
  onSample: (point: Point, down: boolean) => void;
}

export function useLedTracking(options: Options) {
  const latest = useRef(options);
  latest.current = options;
  const [threshold, setThreshold] = useState(150);
  const [mode, setMode] = useState<'green' | 'bright'>('green');
  const settings = useRef({ threshold, mode });
  settings.current = { threshold, mode };
  const [state, setState] = useState<{
    status: LedTrackingStatus; error: string | null;
    point: LedBlob | null; sidePoint: LedBlob | null;
    pagePoint: { x: number; y: number } | null; z: number | null; fps: number;
  }>({ status: 'off', error: null, point: null, sidePoint: null, pagePoint: null, z: null, fps: 0 });

  useEffect(() => {
    if (!options.enabled) {
      setState({ status: 'off', error: null, point: null, sidePoint: null, pagePoint: null, z: null, fps: 0 });
      return;
    }
    let cancelled = false;
    let session: InferenceSession | null = null;
    let pending: Promise<void> | null = null;
    let ort: typeof import('onnxruntime-web/webgpu') | null = null;
    let modelBusy = false, lastModel = -Infinity, nextView = 0;
    let warning: string | null = null;
    const modelCanvas = document.createElement('canvas');
    modelCanvas.width = modelCanvas.height = 640;
    const modelContext = modelCanvas.getContext('2d', { willReadFrequently: true })!;
    const modelInput = new Float32Array(3 * 640 * 640);
    const topIdentity = new VerifiedLedTrack(), sideIdentity = new VerifiedLedTrack();
    const makeDetector = (identity: VerifiedLedTrack) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
      let source: MediaProvider | null = null;
      let lastSettings = '';
      let scratch = createLedScratch(0);
      return (video: HTMLVideoElement, now: number) => {
        const height = Math.max(1, Math.round(320 * video.videoHeight / video.videoWidth));
        if (canvas.width !== 320 || canvas.height !== height) {
          canvas.width = 320; canvas.height = height;
          scratch = createLedScratch(320 * height);
        }
        const { threshold, mode } = settings.current;
        const key = `${threshold}/${mode}`;
        if (source !== video.srcObject || lastSettings !== key) {
          identity.reset(); source = video.srcObject; lastSettings = key;
        }
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const candidate = findBrightLed(ctx.getImageData(0, 0, canvas.width, canvas.height).data,
          canvas.width, canvas.height, threshold, mode, identity.previous, scratch);
        return identity.update(candidate, now);
      };
    };
    const detectTop = makeDetector(topIdentity), detectSide = makeDetector(sideIdentity);
    const verify = (video: HTMLVideoElement, identity: VerifiedLedTrack) => {
      const width = video.videoWidth, height = video.videoHeight;
      const snapshot = identity.snapshot(performance.now());
      const scale = Math.min(640 / width, 640 / height);
      const rw = Math.round(width * scale), rh = Math.round(height * scale);
      modelContext.fillStyle = 'rgb(114,114,114)';
      modelContext.fillRect(0, 0, 640, 640);
      modelContext.drawImage(video, Math.floor((640 - rw) / 2), Math.floor((640 - rh) / 2), rw, rh);
      const pixels = modelContext.getImageData(0, 0, 640, 640).data;
      const area = 640 * 640;
      for (let i = 0; i < area; i++) {
        modelInput[i] = pixels[i * 4] / 255;
        modelInput[area + i] = pixels[i * 4 + 1] / 255;
        modelInput[2 * area + i] = pixels[i * 4 + 2] / 255;
      }
      modelBusy = true;
      const input = new ort!.Tensor('float32', modelInput, [1, 3, 640, 640]);
      pending = session!.run({ images: input }).then(result => {
        try {
          if (!cancelled) {
            const output = result.output0;
            if (!output) throw new Error('LED model output0 was not found.');
            identity.approve(snapshot, decodeTrainedLed(output.data as Float32Array, output.dims, { width, height }), performance.now());
          }
        } finally { Object.values(result).forEach(tensor => tensor.dispose()); }
      }).catch(e => {
        if (!cancelled) {
          end(performance.now());
          warning = `AI LED detection failed: ${e instanceof Error ? e.message : String(e)}`;
          topIdentity.reset(); sideIdentity.reset();
          setState(s => ({ ...s, status: 'error', error: warning, point: null, sidePoint: null, pagePoint: null, z: null }));
          cancelled = true; cancelAnimationFrame(frame);
        }
      }).finally(() => { input.dispose(); modelBusy = false; });
    };
    let frame = 0, lastFrame = -1, lastSideFrame = -1;
    let lastProcessed = -Infinity, lastPublish = -Infinity;
    let sideSeen = -Infinity, topSeen = -Infinity;
    let sidePoint: LedBlob | null = null;
    let smooth: { x: number; y: number } | null = null;
    let down = false, confirmations = 0;
    let lastTransform: Homography | null = null;
    let count = 0, fps = 0, fpsStart = performance.now();
    let lastPoint: Point = { x: 0.5, y: 0.5, t: 0 };
    const end = (now: number) => {
      latest.current.onSample({ ...lastPoint, t: now }, false);
      down = false; confirmations = 0; smooth = null;
    };
    function tick(now: number) {
      if (cancelled) return;
      try {
        const { videoRef, sideVideoRef, homography, zCalibration, onSample } = latest.current;
        const video = videoRef.current;
        if (now - lastProcessed >= 30 && video && video.readyState >= 2 && video.videoWidth > 0 && video.currentTime !== lastFrame) {
          lastProcessed = now; lastFrame = video.currentTime; topSeen = now;
          const point = detectTop(video, now);
          const side = sideVideoRef.current;
          const hasSide = !!side?.srcObject;
          if (side && side.readyState >= 2 && side.videoWidth > 0 && side.currentTime !== lastSideFrame) {
            lastSideFrame = side.currentTime;
            sidePoint = detectSide(side, now); sideSeen = now;
          }
          if (!hasSide || now - sideSeen > 180) sidePoint = null;
          const height = sidePoint && zCalibration && Math.abs(zCalibration.hoverY - zCalibration.touchY) >= 0.02
            ? zLevel(sidePoint.y, zCalibration) : null;
          const z = height !== null && Number.isFinite(height) ? height : null;
          let pagePoint: { x: number; y: number } | null = null;
          let error: string | null = warning;
          if (homography !== lastTransform) { end(now); lastTransform = homography; }
          if (point && homography) {
            const mapped = project(point, homography);
            if (Number.isFinite(mapped.x) && Number.isFinite(mapped.y) && mapped.x >= 0 && mapped.x <= 1 && mapped.y >= 0 && mapped.y <= 1) {
              if (smooth && Math.hypot(mapped.x - smooth.x, mapped.y - smooth.y) > 0.25) end(now);
              smooth = smooth ? { x: smooth.x * 0.25 + mapped.x * 0.75, y: smooth.y * 0.25 + mapped.y * 0.75 } : mapped;
              pagePoint = smooth;
              const o = latest.current;
              const contact = surfaceAllowsDrawing(o.automatic, o.drawHeld.current, z, down);
              if (!contact) { down = false; confirmations = 0; }
              else if (!down) down = ++confirmations >= 2;
              lastPoint = { ...pagePoint, t: now };
              onSample(lastPoint, down);
            } else {
              end(now);
              error = 'LED is outside the calibrated page, or calibration is invalid. Recalibrate all four corners.';
            }
          } else end(now);
          // One shared AI session, alternating cameras; no overlapping inference or input-buffer writes.
          if (session && !modelBusy && now - lastModel >= 100) {
            const useSide = nextView === 1 && side && side.readyState >= 2 && side.videoWidth > 0;
            verify(useSide ? side : video, useSide ? sideIdentity : topIdentity);
            nextView = useSide ? 0 : 1; lastModel = now;
          }
          count++;
          if (now - fpsStart >= 1000) { fps = Math.round(count * 1000 / (now - fpsStart)); count = 0; fpsStart = now; }
          // Detection/drawing run every processed frame; React diagnostics update at most 10 Hz.
          if (now - lastPublish >= 100) {
            lastPublish = now;
            setState({ status: point ? 'ready' : 'led-not-found', error, point, sidePoint, pagePoint, z, fps });
          }
        } else if (now - topSeen > 180) {
          end(now);
          if (now - lastPublish >= 100) {
            lastPublish = now;
            setState(s => ({ ...s, status: 'led-not-found', point: null, sidePoint: null, pagePoint: null, z: null }));
          }
        }
        frame = requestAnimationFrame(tick);
      } catch (e) {
        end(now);
        setState({ status: 'error', error: e instanceof Error ? e.message : String(e), point: null, sidePoint: null, pagePoint: null, z: null, fps: 0 });
      }
    }
    const start = async () => {
      setState(s => ({ ...s, status: 'loading', error: null }));
      try {
        ort = await import('onnxruntime-web/webgpu');
        if (cancelled) return;
        ort.env.wasm.wasmPaths = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.30.0/dist/';
        const url = `${import.meta.env.BASE_URL}models/green_led.onnx`;
        let created: InferenceSession;
        try {
          created = await ort.InferenceSession.create(url, { executionProviders: ['webgpu'] });
        } catch {
          if (cancelled) return;
          warning = 'AI LED model is running on the CPU; tracking may be slower. Both camera feeds are retained.';
          created = await ort.InferenceSession.create(url, { executionProviders: ['wasm'] });
        }
        if (cancelled) { await created.release(); return; }
        session = created;
        frame = requestAnimationFrame(tick);
      } catch (e) {
        if (!cancelled) setState(s => ({ ...s, status: 'error', error: e instanceof Error ? e.message : String(e) }));
      }
    };
    void start();
    return () => {
      cancelled = true; cancelAnimationFrame(frame); end(performance.now());
      const release = () => { void session?.release(); };
      if (pending) void pending.then(release, release); else release();
    };
  }, [options.enabled]);

  return { ...state, threshold, setThreshold, mode, setMode };
}
