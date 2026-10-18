/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findBrightLed } from './fastLed.ts';
const w = 100, h = 80;
function image() { return new Uint8ClampedArray(w * h * 4); }
function spot(data: Uint8ClampedArray, x: number, y: number, rgb: number[]) {
  for (let dy = 0; dy < 3; dy++) for (let dx = 0; dx < 3; dx++) data.set([...rgb, 255], ((y + dy) * w + x + dx) * 4);
}
test('dark frame yields no fake top-left detection', () => {
  assert.equal(findBrightLed(image(), w, h), null);
});
test('green blob returns its center and bounds', () => {
  const data = image(); spot(data, 60, 20, [30, 230, 40]);
  const found = findBrightLed(data, w, h)!;
  assert.equal(found.x, 0.615); assert.equal(found.y, 21.5 / h);
  assert.equal(found.left, 0.6); assert.equal(found.width, 0.03);
});
test('separate lights are not averaged into a phantom center', () => {
  const data = image(); spot(data, 10, 10, [20, 240, 20]); spot(data, 80, 50, [20, 240, 20]);
  const found = findBrightLed(data, w, h, 150, 'green', { x: 0.8, y: 0.6 })!;
  assert.ok(found.x > 0.8);
});
test('bright mode detects a white core, green mode rejects it', () => {
  const data = image(); spot(data, 40, 40, [240, 240, 240]);
  assert.equal(findBrightLed(data, w, h, 200, 'green'), null);
  assert.ok(findBrightLed(data, w, h, 200, 'bright'));
});
test('large bright background is rejected', () => {
  const data = image(); for (let i=0;i<data.length;i+=4) data.set([255,255,255,255],i);
  assert.equal(findBrightLed(data,w,h,200,'bright'),null);
});

test('reused scratch buffers do not keep detections from older frames', async () => {
  const { createLedScratch } = await import('./fastLed.ts');
  const scratch = createLedScratch(w * h), data = image();
  spot(data, 60, 20, [30, 230, 40]);
  assert.ok(findBrightLed(data, w, h, 150, 'green', null, scratch));
  assert.equal(findBrightLed(image(), w, h, 150, 'green', null, scratch), null);
});
