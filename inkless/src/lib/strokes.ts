import type { DrawingState, Point, Stroke } from "../types";

export const emptyDrawing: DrawingState = { strokes: [], active: null };

let counter = 0;
const newId = () => `s${Date.now()}-${counter++}`;

// Start a new stroke. If one is already active, finish it first.
export function beginStroke(
  state: DrawingState,
  p: Point,
  thickness: number
): DrawingState {
  const done = finishStroke(state);
  return {
    strokes: done.strokes,
    active: { id: newId(), points: [p], thickness },
  };
}

// Add a point to the active stroke.
export function extendStroke(state: DrawingState, p: Point): DrawingState {
  if (!state.active) return state;
  return {
    ...state,
    active: { ...state.active, points: [...state.active.points, p] },
  };
}

// Pen up: move the active stroke into the finished list.
// Single-point strokes are dropped (usually accidental).
export function finishStroke(state: DrawingState): DrawingState {
  if (!state.active) return state;
  const keep = state.active.points.length > 1;
  return {
    strokes: keep ? [...state.strokes, state.active] : state.strokes,
    active: null,
  };
}

// Remove the most recent finished stroke (or cancel the active one).
export function undo(state: DrawingState): DrawingState {
  if (state.active) return { ...state, active: null };
  return { ...state, strokes: state.strokes.slice(0, -1) };
}

export function clear(): DrawingState {
  return emptyDrawing;
}

export function allStrokes(state: DrawingState): Stroke[] {
  return state.active ? [...state.strokes, state.active] : state.strokes;
}