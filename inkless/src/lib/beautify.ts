import { ERASER, type Point, type Stroke } from "../types";

// Original strokes stay untouched. Cached results avoid reprocessing old handwriting.
const cache = new WeakMap<Stroke, Map<number, Stroke>>();
const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);

function resample(points: Point[]): Point[] {
  let length = 0;
  for (let i = 1; i < points.length; i++) length += distance(points[i - 1], points[i]);
  if (length < 1e-8) return points;
  const spacing = Math.max(0.0015, length / 3000);
  const output: Point[] = [{ ...points[0] }];
  let travelled = 0, next = spacing;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1], b = points[i];
    const segment = distance(a, b);
    if (segment === 0) continue;
    while (next < travelled + segment) {
      const u = (next - travelled) / segment;
      output.push({ x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u, t: a.t + (b.t - a.t) * u });
      next += spacing;
    }
    travelled += segment;
  }
  output.push({ ...points[points.length - 1] });
  return output;
}

export function beautifyStroke(stroke: Stroke, strength = 0.5): Stroke {
  const level = Math.round(Math.max(0, Math.min(1, strength)) * 10);
  if (!level || stroke.points.length < 3 || stroke.color === ERASER) return stroke;
  const saved = cache.get(stroke)?.get(level);
  if (saved) return saved;
  const sampled = resample(stroke.points);
  let points = sampled;
  const radius = 1 + Math.round(level / 4);
  const blend = 0.25 + level * 0.04;
  for (let pass = 0; pass < 2; pass++) {
    points = points.map((p, i, input) => {
      if (i === 0 || i === input.length - 1) return { ...p };
      const a = sampled[Math.max(0, i - 4)], b = sampled[Math.min(sampled.length - 1, i + 4)];
      const ux = sampled[i].x - a.x, uy = sampled[i].y - a.y;
      const vx = b.x - sampled[i].x, vy = b.y - sampled[i].y;
      const lengths = Math.hypot(ux, uy) * Math.hypot(vx, vy);
      // Preserve deliberate sharp turns; don't straighten letters or diagrams globally.
      if (lengths > 0.00002 && (ux * vx + uy * vy) / lengths < 0.2) return { ...p };
      let x = 0, y = 0, weights = 0;
      for (let offset = -radius; offset <= radius; offset++) {
        const q = input[Math.max(0, Math.min(input.length - 1, i + offset))];
        const weight = radius + 1 - Math.abs(offset);
        x += q.x * weight; y += q.y * weight; weights += weight;
      }
      return { ...p, x: p.x * (1 - blend) + x / weights * blend, y: p.y * (1 - blend) + y / weights * blend };
    });
  }
  const result = { ...stroke, points };
  const levels = cache.get(stroke) ?? new Map<number, Stroke>();
  levels.set(level, result); cache.set(stroke, levels);
  return result;
}

export function beautifyStrokes(strokes: Stroke[], strength = 0.5): Stroke[] {
  return strokes.map(stroke => beautifyStroke(stroke, strength));
}
