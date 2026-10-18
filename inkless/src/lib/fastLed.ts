export interface LedBlob {
  x: number; y: number;
  left: number; top: number; width: number; height: number;
}

export interface LedScratch { mask: Uint8Array; queue: Int32Array }
export function createLedScratch(size: number): LedScratch {
  return { mask: new Uint8Array(size), queue: new Int32Array(size) };
}

// Connected components keep separate bright objects from averaging into a fake point.
export function findBrightLed(
  rgba: Uint8ClampedArray, width: number, height: number,
  threshold = 150, mode: 'green' | 'bright' = 'green',
  previous: { x: number; y: number } | null = null,
  scratch?: LedScratch,
): LedBlob | null {
  const size = width * height;
  const buffers = scratch && scratch.mask.length === size ? scratch : createLedScratch(size);
  const { mask, queue } = buffers;
  for (let i = 0; i < size; i++) {
    const r = rgba[i * 4], g = rgba[i * 4 + 1], b = rgba[i * 4 + 2];
    mask[i] = Number(mode === 'green'
      ? g >= threshold && g - r >= 25 && g - b >= 15
      : Math.min(r, g, b) >= threshold);
  }
  let best: LedBlob | null = null;
  let bestScore = -Infinity;
  for (let i = 0; i < size; i++) {
    if (!mask[i]) continue;
    let head = 0, tail = 1, count = 0, sx = 0, sy = 0;
    let left = width, right = 0, top = height, bottom = 0;
    queue[0] = i; mask[i] = 0;
    while (head < tail) {
      const index = queue[head++];
      const x = index % width, y = Math.floor(index / width);
      count++; sx += x; sy += y;
      left = Math.min(left, x); right = Math.max(right, x);
      top = Math.min(top, y); bottom = Math.max(bottom, y);
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
          const n = ny * width + nx;
          if (mask[n]) { mask[n] = 0; queue[tail++] = n; }
        }
      }
    }
    const w = right - left + 1, h = bottom - top + 1;
    if (count < 2 || count > size * 0.02 || w / h > 5 || h / w > 5) continue;
    const x = (sx / count + 0.5) / width;
    const y = (sy / count + 0.5) / height;
    const distance = previous ? Math.hypot(x - previous.x, y - previous.y) : 0;
    const score = Math.sqrt(count) / (1 + distance * 12);
    if (score > bestScore) {
      bestScore = score;
      best = { x, y, left: left / width, top: top / height, width: w / width, height: h / height };
    }
  }
  return best;
}
