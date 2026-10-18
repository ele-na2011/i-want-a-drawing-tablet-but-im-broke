export interface SensorSample {
  zLevel: number;
  acoustic: number;
  velocity: number;
}

export interface SensorDecision {
  penDown: boolean;
  confidence: number;
  label: "Pen down" | "Pen up";
}

const clamp = (value: number) => Math.max(0, Math.min(1, value));

/** Weighted fusion for the side camera, acoustic trigger and kinematic filter. */
export function fuseSensors(sample: SensorSample): SensorDecision {
  const zScore = clamp(1 - Math.abs(sample.zLevel - 0.5) * 2);
  const acousticScore = clamp(sample.acoustic);
  const velocityScore = clamp(1 - sample.velocity);
  const confidence = zScore * 0.45 + acousticScore * 0.35 + velocityScore * 0.2;
  const penDown = confidence >= 0.58 && acousticScore >= 0.25;
  return { penDown, confidence, label: penDown ? "Pen down" : "Pen up" };
}
