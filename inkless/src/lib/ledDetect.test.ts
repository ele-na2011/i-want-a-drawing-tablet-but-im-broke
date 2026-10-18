/// <reference types="node" />
import { test } from "node:test";
import assert from "node:assert/strict";
import { letterbox, pickLed } from "./ledDetect.ts";

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
