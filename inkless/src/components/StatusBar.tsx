import type { TrackingStatus } from "../types";

// Text + icon, so status never relies on color alone (PRD requirement).
const LABELS: Record<TrackingStatus, string> = {
  "camera-off": "Camera off",
  "camera-ready": "Camera ready",
  calibrating: "Calibrating",
  tracking: "Tracking pen",
  drawing: "Drawing",
  "led-not-found": "Pen LED not found",
  "manual-mode": "Manual mode",
};

// UI OWNER: style .status and .status[data-status="..."] in styles.css.
export default function StatusBar({ status }: { status: TrackingStatus }) {
  return (
    <div className="status" data-status={status} role="status">
      {LABELS[status]}
    </div>
  );
}