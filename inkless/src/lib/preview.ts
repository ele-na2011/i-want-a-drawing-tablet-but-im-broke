import type { CalibrationPoint } from "./homography";

// The camera preview is mirrored and cropped to fill its box (object-fit: cover).
// These convert between a 0..1 point on the preview and a 0..1 point in the raw video frame.
export function previewToVideoPoint(
  point: CalibrationPoint,
  preview: { width: number; height: number },
  video: { videoWidth: number; videoHeight: number },
): CalibrationPoint {
  const previewAspect = preview.width / preview.height;
  const videoAspect = video.videoWidth / video.videoHeight;
  if (!Number.isFinite(videoAspect) || videoAspect <= 0) {
    return { x: 1 - point.x, y: point.y };
  }

  if (videoAspect > previewAspect) {
    const visibleWidth = previewAspect / videoAspect;
    return {
      x: 1 - (point.x * visibleWidth + (1 - visibleWidth) / 2),
      y: point.y,
    };
  }

  const visibleHeight = videoAspect / previewAspect;
  return {
    x: 1 - point.x,
    y: point.y * visibleHeight + (1 - visibleHeight) / 2,
  };
}

export function videoToPreviewPoint(
  point: CalibrationPoint,
  preview: { width: number; height: number },
  video: { videoWidth: number; videoHeight: number },
): CalibrationPoint {
  const previewAspect = preview.width / preview.height;
  const videoAspect = video.videoWidth / video.videoHeight;
  if (!Number.isFinite(videoAspect) || videoAspect <= 0) {
    return { x: 1 - point.x, y: point.y };
  }

  if (videoAspect > previewAspect) {
    const visibleWidth = previewAspect / videoAspect;
    return { x: (1 - point.x - (1 - visibleWidth) / 2) / visibleWidth, y: point.y };
  }

  const visibleHeight = videoAspect / previewAspect;
  return { x: 1 - point.x, y: (point.y - (1 - visibleHeight) / 2) / visibleHeight };
}
