/// <reference types="node" />
import { test } from "node:test";
import assert from "node:assert/strict";
import { letterbox, nextPenDown, pickLed, zLevel } from "./ledDetect.ts";

// Model output for n candidate boxes, laid out as [cx..., cy..., w..., h..., score...].
const output = (boxes: [number, number, number][], n = 4) => {
  const o = new Float32Array(5 * n);
  boxes.forEach(([cx, cy, score], i) => { o[i] = cx; o[n + i] = cy; o[4 * n + i] = score; });
  return o;
};

test("a 640x480 frame is padded top and bottom", () => {
  assert.deepEqual(letterbox(640, 480), { scale: 1, padX: 0, padY: 80 });
});

test("picks the most confident box and maps it back to the frame", () => {
  const frame = { width: 640, height: 480 };
  const led = pickLed(output([[100, 300, 0.4], [320, 320, 0.9]]), letterbox(640, 480), frame);
  assert.deepEqual(led, { x: 0.5, y: 0.5, score: output([[320, 320, 0.9]])[16] });
});

test("nothing confident enough means no LED", () => {
  assert.equal(pickLed(output([[320, 320, 0.1]]), letterbox(640, 480), { width: 640, height: 480 }), null);
});

test("z is 0 on the paper and 1 at the lifted reference, whichever way the camera is mounted", () => {
  assert.equal(zLevel(0.8, { touchY: 0.8, hoverY: 0.6 }) + 0, 0); // +0 turns -0 into 0
  assert.equal(zLevel(0.6, { touchY: 0.8, hoverY: 0.6 }), 1);
  assert.equal(zLevel(0.5, { touchY: 0.4, hoverY: 0.6 }), 0.5);
});

test("pen down and up use different thresholds", () => {
  assert.equal(nextPenDown(0.9, false), false); // not low enough to start a stroke
  assert.equal(nextPenDown(0.9, true), true);   // not high enough to end one
  assert.equal(nextPenDown(0.5, false), true);  // tip on paper reads 0.5-0.78
  assert.equal(nextPenDown(0.78, false), true);
  assert.equal(nextPenDown(1.0, true), false);  // lifted reads ~1.0
});
