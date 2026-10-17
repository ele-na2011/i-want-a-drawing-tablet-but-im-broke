/// <reference types="node" />
import { test } from "node:test";
import assert from "node:assert/strict";
import { jpegToPdf } from "./pdf.ts";

test("the PDF's cross-reference table points at each object", () => {
  const fakeJpeg = new Uint8Array([0xff, 0xd8, 0x00, 0x0a, 0xff, 0xd9]); // bytes are copied as-is
  const pdf = jpegToPdf(fakeJpeg, 2, 1, 842, 421);
  const text = new TextDecoder("latin1").decode(pdf);
  assert.ok(text.startsWith("%PDF-1.4"));
  assert.ok(text.trimEnd().endsWith("%%EOF"));

  const startxref = Number(text.match(/startxref\n(\d+)/)![1]);
  assert.ok(text.slice(startxref).startsWith("xref"));
  const offsets = [...text.slice(startxref).matchAll(/(\d{10}) 00000 n /g)].map((m) => Number(m[1]));
  assert.equal(offsets.length, 5);
  offsets.forEach((o, i) => assert.ok(text.slice(o).startsWith(`${i + 1} 0 obj`), `object ${i + 1}`));
  assert.match(text, /\/MediaBox \[0 0 842\.00 421\.00\]/);
});
