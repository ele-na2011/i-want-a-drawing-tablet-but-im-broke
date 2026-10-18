// This is a contact estimate, not measured physical depth.
export function surfaceAllowsDrawing(
  automatic: boolean, held: boolean, height: number | null, wasDown: boolean,
): boolean {
  if (!automatic) return held;
  if (height === null || !Number.isFinite(height) || height < -0.5) return false;
  return height < (wasDown ? 0.55 : 0.35);
}
