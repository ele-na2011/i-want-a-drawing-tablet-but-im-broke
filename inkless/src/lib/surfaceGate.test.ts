/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { surfaceAllowsDrawing } from './surfaceGate.ts';

test('visibility or near-surface position alone never starts manual drawing', () => {
  assert.equal(surfaceAllowsDrawing(false, false, 0, false), false);
  assert.equal(surfaceAllowsDrawing(false, false, null, false), false);
});
test('manual hold works without a second camera and release stops immediately', () => {
  assert.equal(surfaceAllowsDrawing(false, true, null, false), true);
  assert.equal(surfaceAllowsDrawing(false, false, null, true), false);
});
test('automatic mode fails closed on missing or invalid contact data', () => {
  for (const z of [null, NaN, Infinity, -1]) assert.equal(surfaceAllowsDrawing(true, true, z, true), false);
});
test('lifting ends automatic drawing even if manual key remains held', () => {
  assert.equal(surfaceAllowsDrawing(true, true, 1, true), false);
});
test('surface hysteresis avoids rapid on/off near threshold', () => {
  assert.equal(surfaceAllowsDrawing(true, false, 0.2, false), true);
  assert.equal(surfaceAllowsDrawing(true, false, 0.45, false), false);
  assert.equal(surfaceAllowsDrawing(true, false, 0.45, true), true);
  assert.equal(surfaceAllowsDrawing(true, false, 0.6, true), false);
});
