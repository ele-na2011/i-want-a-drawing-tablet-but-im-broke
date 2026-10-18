import type { LedBlob } from './fastLed';

// Matches the exported one-class model: [1, 5, N] = cx, cy, w, h, confidence.
export function decodeTrainedLed(
  data: ArrayLike<number>, dims: readonly number[],
  frame: { width: number; height: number }, minScore = 0.3,
): LedBlob | null {
  if (dims.length !== 3 || dims[0] !== 1 || dims[1] !== 5 || data.length !== 5 * dims[2]) {
    throw new Error('Unexpected LED model output. Use the provided green_led.onnx export ([1,5,N]).');
  }
  if (frame.width <= 0 || frame.height <= 0) return null;
  const n = dims[2], scale = Math.min(640 / frame.width, 640 / frame.height);
  const rw = Math.round(frame.width * scale), rh = Math.round(frame.height * scale);
  const padX = Math.floor((640 - rw) / 2), padY = Math.floor((640 - rh) / 2);
  let result: LedBlob | null = null, score = minScore;
  for (let i = 0; i < n; i++) {
    const confidence = Number(data[4 * n + i]);
    if (!Number.isFinite(confidence) || confidence < score) continue;
    const cx = Number(data[i]), cy = Number(data[n + i]);
    const bw = Number(data[2 * n + i]), bh = Number(data[3 * n + i]);
    if (![cx, cy, bw, bh].every(Number.isFinite) || bw <= 0 || bh <= 0) continue;
    const x = (cx - padX) / rw, y = (cy - padY) / rh;
    if (x < 0 || x > 1 || y < 0 || y > 1) continue;
    const left = Math.max(0, (cx - bw / 2 - padX) / rw);
    const top = Math.max(0, (cy - bh / 2 - padY) / rh);
    const right = Math.min(1, (cx + bw / 2 - padX) / rw);
    const bottom = Math.min(1, (cy + bh / 2 - padY) / rh);
    if (right <= left || bottom <= top) continue;
    score = confidence;
    result = { x, y, left, top, width: right - left, height: bottom - top };
  }
  return result;
}

export interface VerificationSnapshot { epoch: number; candidate: LedBlob | null; at: number }
export class VerifiedLedTrack {
  previous: LedBlob | null = null;
  private epoch = 0;
  private until = -Infinity;
  private modelBox: LedBlob | null = null;
  private modelAt = -Infinity;
  reset() {
    this.previous = null; this.until = -Infinity;
    this.modelBox = null; this.modelAt = -Infinity; this.epoch++;
  }
  snapshot(at: number): VerificationSnapshot { return { epoch: this.epoch, candidate: this.previous, at }; }
  update(candidate: LedBlob | null, now: number): LedBlob | null {
    // A disappeared or discontinuous light must be identified by the model again.
    if (this.previous && (!candidate || Math.hypot(candidate.x - this.previous.x, candidate.y - this.previous.y) > 0.1)) this.reset();
    this.previous = candidate;
    if (candidate && now <= this.until) return candidate;
    // Brief model-only fallback for a white/overexposed core missed by thresholding.
    if (!candidate && now - this.modelAt <= 180) return this.modelBox;
    return null;
  }
  approve(snapshot: VerificationSnapshot, box: LedBlob | null, now: number) {
    if (snapshot.epoch !== this.epoch || now - snapshot.at > 1000) return;
    if (!box) { this.until = -Infinity; this.modelBox = null; return; }
    this.modelBox = box; this.modelAt = snapshot.at;
    const candidate = snapshot.candidate ?? this.previous;
    const radius = Math.min(0.1, Math.max(0.025, Math.hypot(box.width, box.height) * 0.75));
    this.until = candidate && Math.hypot(candidate.x - box.x, candidate.y - box.y) <= radius
      ? snapshot.at + 1200 : -Infinity;
  }
}
