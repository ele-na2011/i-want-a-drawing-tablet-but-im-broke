// Shared types. Everyone imports from here, so change with care.

// Coordinates are NORMALIZED: x and y run 0..1 across the canvas,
// so strokes look the same at any canvas size.
export interface Point {
  x: number;
  y: number;
  t: number; // timestamp in ms (performance.now())
}

export interface Stroke {
  id: string;
  points: Point[];
  thickness: number; // px at export size
}

// What the whole drawing looks like at any moment.
export interface DrawingState {
  strokes: Stroke[];      // finished strokes
  active: Stroke | null;  // stroke currently being drawn, if any
}

export type TrackingStatus =
  | "camera-off"
  | "camera-ready"
  | "calibrating"
  | "tracking"
  | "drawing"
  | "hand-not-found"
  | "manual-mode";