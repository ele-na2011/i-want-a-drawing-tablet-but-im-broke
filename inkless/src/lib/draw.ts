import { ERASER, type Stroke } from "../types";

// Draw strokes onto a canvas of w×h device pixels. `scale` turns stroke thickness (css px) into device px.
// Erasers cut through earlier strokes only, so call this on a transparent layer.
export function drawStrokes(ctx: CanvasRenderingContext2D, strokes: Stroke[], w: number, h: number, scale: number) {
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  for (const s of strokes) {
    if (s.points.length < 2) continue;
    ctx.lineWidth = s.thickness * scale;
    ctx.globalCompositeOperation = s.color === ERASER ? "destination-out" : "source-over";
    ctx.strokeStyle = s.color === ERASER ? "#000" : s.color;
    ctx.beginPath();
    s.points.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x * w, p.y * h) : ctx.lineTo(p.x * w, p.y * h)));
    ctx.stroke();
  }
  ctx.globalCompositeOperation = "source-over";
}

const loadImage = (src: string) =>
  new Promise<HTMLImageElement>((ok, fail) => {
    const img = new Image();
    img.onload = () => ok(img);
    img.onerror = fail;
    img.src = src;
  });

// Fit an image inside a box without cropping, centred (same as CSS object-fit: contain).
export function contain(iw: number, ih: number, w: number, h: number) {
  const k = Math.min(w / iw, h / ih);
  return { x: (w - iw * k) / 2, y: (h - ih * k) / 2, w: iw * k, h: ih * k };
}

// Render a document at `width` px wide: white page, imported image, then strokes. Used for previews and PDF.
export async function renderPage(
  doc: { strokes: Stroke[]; background: string | null; size: { w: number; h: number } },
  width: number,
): Promise<HTMLCanvasElement> {
  const height = Math.max(1, Math.round((width * doc.size.h) / doc.size.w));
  const page = document.createElement("canvas");
  page.width = width;
  page.height = height;
  const ctx = page.getContext("2d")!;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
  if (doc.background) {
    const img = await loadImage(doc.background);
    const r = contain(img.naturalWidth, img.naturalHeight, width, height);
    ctx.drawImage(img, r.x, r.y, r.w, r.h);
  }
  const ink = document.createElement("canvas"); // separate layer so the eraser can't cut the image
  ink.width = width;
  ink.height = height;
  drawStrokes(ink.getContext("2d")!, doc.strokes, width, height, width / doc.size.w);
  ctx.drawImage(ink, 0, 0);
  return page;
}
