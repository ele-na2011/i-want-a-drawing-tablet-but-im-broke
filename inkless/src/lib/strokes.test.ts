/// <reference types="node" />
// Run with: npm test (Node's built-in runner, no extra packages)
import { test } from "node:test";
import assert from "node:assert/strict";
import { beginStroke, emptyDrawing, extendStroke, finishStroke, redo, undo } from "./strokes.ts";

const pt = (x: number, y: number) => ({ x, y, t: 0 });
const line = (d: typeof emptyDrawing, color = "#000000") =>
  finishStroke(extendStroke(beginStroke(d, pt(0, 0), 4, color), pt(1, 1)));

test("a pen stroke keeps every point and its colour", () => {
  let d = beginStroke(emptyDrawing, pt(0, 0), 4, "#ff0000");
  d = extendStroke(d, pt(0.1, 0.1));
  d = extendStroke(d, pt(0.2, 0.3));
  d = finishStroke(d);
  assert.equal(d.active, null);
  assert.equal(d.strokes.length, 1);
  assert.equal(d.strokes[0].color, "#ff0000");
  assert.deepEqual(d.strokes[0].points.map((p) => p.x), [0, 0.1, 0.2]);
});

test("a click without movement is dropped", () => {
  const d = finishStroke(beginStroke(emptyDrawing, pt(0.4, 0.4), 4, "#000000"));
  assert.equal(d.strokes.length, 0);
});

test("undo then redo restores strokes in order", () => {
  let d = line(line(emptyDrawing, "#ff0000"), "#305cde");
  d = undo(undo(d));
  assert.equal(d.strokes.length, 0);
  d = redo(d);
  assert.deepEqual(d.strokes.map((s) => s.color), ["#ff0000"]);
  d = redo(d);
  assert.deepEqual(d.strokes.map((s) => s.color), ["#ff0000", "#305cde"]);
  assert.equal(redo(d), d); // nothing left to redo
});

test("drawing after an undo clears the redo history", () => {
  let d = undo(line(emptyDrawing));
  d = line(d);
  assert.equal(d.undone.length, 0);
  assert.equal(redo(d).strokes.length, 1);
});
