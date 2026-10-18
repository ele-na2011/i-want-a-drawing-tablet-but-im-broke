/// <reference types="node" />
import { test } from "node:test";
import assert from "node:assert/strict";
import { findHomography, project } from "./homography.ts";

test("maps the four camera corners to the canvas corners", () => {
  const source = [{ x: 0.2, y: 0.1 }, { x: 0.8, y: 0.08 }, { x: 0.92, y: 0.9 }, { x: 0.1, y: 0.85 }];
  const destination = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }];
  const transform = findHomography(source, destination);
  destination.forEach((expected, i) => assert.ok(Math.hypot(project(source[i], transform).x - expected.x, project(source[i], transform).y - expected.y) < 1e-8));
});
