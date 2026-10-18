/// <reference types="node" />
import { test } from "node:test";
import assert from "node:assert/strict";
import { previewToVideoPoint, videoToPreviewPoint } from "./preview.ts";

const close = (a: { x: number; y: number }, b: { x: number; y: number }) =>
  assert.ok(Math.abs(a.x - b.x) < 1e-9 && Math.abs(a.y - b.y) < 1e-9, `${JSON.stringify(a)} != ${JSON.stringify(b)}`);

test("video -> preview undoes preview -> video, for wide, tall and matching frames", () => {
  const preview = { width: 400, height: 300 };
  for (const video of [{ videoWidth: 1280, videoHeight: 720 }, { videoWidth: 480, videoHeight: 640 }, { videoWidth: 640, videoHeight: 480 }]) {
    const p = { x: 0.3, y: 0.8 };
    close(videoToPreviewPoint(previewToVideoPoint(p, preview, video), preview, video), p);
  }
});

test("the preview is mirrored", () => {
  close(videoToPreviewPoint({ x: 0.25, y: 0.5 }, { width: 4, height: 3 }, { videoWidth: 640, videoHeight: 480 }), { x: 0.75, y: 0.5 });
});
