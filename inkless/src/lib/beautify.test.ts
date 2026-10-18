/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { beautifyStroke, beautifyStrokes } from './beautify.ts';
import { ERASER, type Stroke } from '../types.ts';
function rough(): Stroke {
  return { id: 'a', thickness: 4, color: '#000', points: Array.from({ length: 101 }, (_, i) => ({ x: i / 100, y: i === 0 || i === 100 ? 0.5 : 0.5 + (i % 2 ? 0.003 : -0.003), t: i * 10 })) };
}
test('zero strength returns the original unchanged', () => {
  const stroke = rough(); assert.equal(beautifyStroke(stroke, 0), stroke);
});
test('cleanup reduces jitter and preserves exact endpoints without mutating original', () => {
  const stroke = rough(), before = JSON.stringify(stroke), clean = beautifyStroke(stroke, 1);
  const energy = (s: Stroke) => s.points.reduce((n, p) => n + (p.y - 0.5) ** 2, 0) / s.points.length;
  assert.ok(energy(clean) < energy(stroke));
  assert.deepEqual(clean.points[0], stroke.points[0]);
  assert.deepEqual(clean.points.at(-1), stroke.points.at(-1));
  assert.equal(JSON.stringify(stroke), before);
  assert.equal(clean.thickness, stroke.thickness); assert.equal(clean.color, stroke.color);
});
test('separate strokes stay separate and erasers remain untouched', () => {
  const first = rough(), second = { ...rough(), id: 'b' }, eraser = { ...rough(), id: 'e', color: ERASER };
  const result = beautifyStrokes([first, second, eraser]);
  assert.equal(result.length, 3); assert.deepEqual(result.map(s => s.id), ['a', 'b', 'e']); assert.equal(result[2], eraser);
});
test('cached completed strokes reuse their cleaned result', () => {
  const stroke = rough(); assert.equal(beautifyStroke(stroke, 0.5), beautifyStroke(stroke, 0.5));
});
test('stationary points stay finite, and resampling is bounded', () => {
  const stroke = rough(); stroke.points = [{ x: 0.2, y: 0.3, t: 0 }, { x: 0.2, y: 0.3, t: 1 }, { x: 0.2, y: 0.3, t: 2 }];
  const result = beautifyStroke(stroke);
  assert.ok(result.points.every(p => Number.isFinite(p.x) && Number.isFinite(p.y)));
  assert.ok(beautifyStroke(rough()).points.length <= 3002);
});
