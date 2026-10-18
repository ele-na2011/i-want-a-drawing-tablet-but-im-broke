/// <reference types="node" />
import { test } from "node:test";
import assert from "node:assert/strict";
import { fuseSensors } from "./sensorFusion.ts";

test("requires acoustic contact before declaring pen down", () => {
  assert.equal(fuseSensors({ zLevel: 0.5, acoustic: 0, velocity: 0.1 }).penDown, false);
  assert.equal(fuseSensors({ zLevel: 0.5, acoustic: 0.9, velocity: 0.1 }).penDown, true);
});
