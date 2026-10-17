import type { Doc } from "./projects";
import { renderPage } from "./draw";
import { jpegToPdf } from "./pdf";

type Page = Pick<Doc, "strokes" | "background" | "size">;

// Preview for the dashboard cards: 640 px wide stays sharp on 2× screens at card size.
export async function thumbnail(doc: Page): Promise<string> {
  return (await renderPage(doc, 640)).toDataURL("image/jpeg", 0.85);
}

// US Letter page (612 x 792 pt) rendered at 300 dpi (2550 px wide), so print and zoom stay crisp.
export async function downloadPdf(doc: Page, name: string) {
  const page = await renderPage(doc, 2550);
  const blob = await new Promise<Blob | null>((ok) => page.toBlob(ok, "image/jpeg", 0.92));
  if (!blob) throw new Error("Could not render the page");
  const jpeg = new Uint8Array(await blob.arrayBuffer());
  const pdf = jpegToPdf(jpeg, page.width, page.height, 612, (612 * page.height) / page.width);
  const url = URL.createObjectURL(new Blob([pdf as BlobPart], { type: "application/pdf" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `${name.replace(/[\\/:*?"<>|]/g, "-") || "drawing"}.pdf`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Imported images are shrunk to at most 2000 px so they fit in browser storage.
export async function readImage(file: File): Promise<string> {
  const src = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((ok, fail) => {
      const i = new Image();
      i.onload = () => ok(i);
      i.onerror = () => fail(new Error("That file isn't an image this browser can open"));
      i.src = src;
    });
    const k = Math.min(1, 2000 / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement("canvas");
    c.width = Math.round(img.naturalWidth * k);
    c.height = Math.round(img.naturalHeight * k);
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = "#ffffff"; // JPEG has no transparency; without this, see-through PNGs turn black
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL("image/jpeg", 0.9);
  } finally {
    URL.revokeObjectURL(src);
  }
}
