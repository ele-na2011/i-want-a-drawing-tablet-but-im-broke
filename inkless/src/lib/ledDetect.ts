// Pure parts of the green-LED detector (YOLO26n trained on one class, "green_led", exported from best.pt).
// The model sees a 640x640 letterboxed RGB frame and returns [1, 5, 8400]: cx, cy, w, h, score per candidate box.
export const INPUT = 640;

// Below this the model mostly fires on reflections; track_led.py used 0.1, which draws stray lines.
export const MIN_SCORE = 0.3;

export interface Letterbox { scale: number; padX: number; padY: number }

// Fit a frame inside the square input without stretching it, centred, like ultralytics' letterbox.
export function letterbox(width: number, height: number): Letterbox {
  const scale = Math.min(INPUT / width, INPUT / height);
  return { scale, padX: (INPUT - width * scale) / 2, padY: (INPUT - height * scale) / 2 };
}

// Fills a CHW float tensor (0..1) from RGBA pixels.
export function toTensor(rgba: Uint8ClampedArray, out: Float32Array) {
  const area = INPUT * INPUT;
  for (let i = 0; i < area; i++) {
    out[i] = rgba[i * 4] / 255;
    out[area + i] = rgba[i * 4 + 1] / 255;
    out[2 * area + i] = rgba[i * 4 + 2] / 255;
  }
}

// The single most confident LED, as a 0..1 point in the original (unmirrored) video frame, or null.
// One pen means one LED, so taking the best box replaces NMS.
export function pickLed(
  output: Float32Array, box: Letterbox, frame: { width: number; height: number }, minScore = MIN_SCORE,
): { x: number; y: number; score: number } | null {
  const n = output.length / 5;
  let best = -1;
  let score = minScore;
  for (let i = 0; i < n; i++) {
    if (output[4 * n + i] > score) { score = output[4 * n + i]; best = i; }
  }
  if (best < 0) return null;
  return {
    x: (output[best] - box.padX) / box.scale / frame.width,
    y: (output[n + best] - box.padY) / box.scale / frame.height,
    score,
  };
}

// Side (bottom) camera: where the LED sits in the frame with the tip on the paper, and lifted just off it.
export interface ZCalibration { touchY: number; hoverY: number }

// Pen height from the side camera: 0 with the tip on the paper, 1 at the lifted reference.
export function zLevel(y: number, cal: ZCalibration): number {
  return (y - cal.touchY) / (cal.hoverY - cal.touchY);
}

// Two thresholds so detector jitter near the paper doesn't break a stroke into dashes.
export const DOWN_BELOW = 0.35;
export const UP_ABOVE = 0.55;
export function nextPenDown(z: number, wasDown: boolean): boolean {
  return wasDown ? z < UP_ABOVE : z < DOWN_BELOW;
}
