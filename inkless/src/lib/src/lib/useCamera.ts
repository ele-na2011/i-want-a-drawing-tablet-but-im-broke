import { useCallback, useEffect, useRef, useState } from "react";

export type CameraStatus = "idle" | "requesting" | "ready" | "error";
export interface CameraDevice {
  deviceId: string;
  label: string;
}

function cameraErrorMessage(e: unknown) {
  const name = e instanceof DOMException ? e.name : "";
  return name === "NotAllowedError"
    ? "Camera permission was denied. Allow it in the browser's site settings."
    : name === "NotFoundError"
      ? "No webcam was found. Connect the Logitech camera and try again."
      : name === "NotReadableError"
        ? "Another app is using this camera (a Python script, Zoom, Teams, the Windows Camera app, OBS), or both cameras share one USB port/hub. Close the app or move a camera to another port, then try again."
        : `Could not open this camera (${e instanceof Error ? `${e.name}: ${e.message}` : String(e)}).`;
}

export function useCamera() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const secondaryVideoRef = useRef<HTMLVideoElement>(null);
  const streamRefs = useRef<(MediaStream | null)[]>([null, null]);
  const [status, setStatus] = useState<CameraStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [activeCameraCount, setActiveCameraCount] = useState(0);
  const [devices, setDevices] = useState<CameraDevice[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState(""); // camera 1: X/Y
  const [selectedSecondaryId, setSelectedSecondaryId] = useState(""); // webcam: Z only; "" picks any other camera

  const refreshDevices = useCallback(async () => {
    if (!navigator.mediaDevices?.enumerateDevices) return [];
    const all = await navigator.mediaDevices.enumerateDevices();
    const cameras = all
      .filter((device) => device.kind === "videoinput")
      .map((device, index) => ({ deviceId: device.deviceId, label: device.label || `Camera ${index + 1}` }));
    setDevices(cameras);
    setSelectedDeviceId((current) => cameras.some((device) => device.deviceId === current) ? current : cameras[0]?.deviceId ?? "");
    return cameras;
  }, []);

  const stop = useCallback(() => {
    streamRefs.current.forEach((stream) => stream?.getTracks().forEach((track) => track.stop()));
    streamRefs.current = [null, null];
    if (videoRef.current) videoRef.current.srcObject = null;
    if (secondaryVideoRef.current) secondaryVideoRef.current.srcObject = null;
    setActiveCameraCount(0);
    setStatus("idle");
  }, []);

  const start = useCallback(async (deviceId?: string, secondaryDeviceId?: string) => {
    setStatus("requesting");
    setError(null);
    try {
      const constraints = (id?: string): MediaStreamConstraints => ({
        video: {
          ...(id ? { deviceId: { exact: id } } : {}),
          width: { ideal: 640 },
          height: { ideal: 480 },
          frameRate: { ideal: 30, max: 60 },
        },
        audio: false,
      });
      // Release the running cameras first: Windows usually won't open a webcam that's still in use, even by this page.
      streamRefs.current.forEach((stream) => stream?.getTracks().forEach((track) => track.stop()));
      streamRefs.current = [null, null];
      const availableBeforePermission = await refreshDevices();
      const requestedPrimaryId = deviceId || availableBeforePermission[0]?.deviceId;
      const primaryStream = await navigator.mediaDevices.getUserMedia(constraints(requestedPrimaryId));
      const available = await refreshDevices();
      const primaryId = primaryStream.getVideoTracks()[0]?.getSettings().deviceId || requestedPrimaryId;
      // A chosen webcam is tried alone; "any other camera" tries each one, since virtual cameras often fail to open.
      const secondaryIds = secondaryDeviceId && secondaryDeviceId !== primaryId
        ? [secondaryDeviceId]
        : available.map((camera) => camera.deviceId).filter((id) => id && id !== primaryId);
      const streams = [primaryStream];
      let secondaryError: string | null = secondaryIds.length ? null : "Only one camera is connected.";
      for (const id of secondaryIds) {
        try {
          streams.push(await navigator.mediaDevices.getUserMedia(constraints(id)));
          secondaryError = null;
          break;
        } catch (e) {
          // One usable camera keeps the preview working; say why the webcam didn't open so Z can be fixed.
          console.error("Webcam (Z) failed to open:", e);
          secondaryError = cameraErrorMessage(e);
        }
      }
      const secondaryId = streams[1]?.getVideoTracks()[0]?.getSettings().deviceId || "";
      streamRefs.current = [streams[0] ?? null, streams[1] ?? null];
      const videos = [videoRef.current, secondaryVideoRef.current];
      for (const [index, stream] of streams.entries()) {
        const video = videos[index];
        if (video) {
          video.srcObject = stream;
          await video.play();
        }
      }
      setSelectedDeviceId(primaryId);
      setSelectedSecondaryId(secondaryId || secondaryDeviceId || "");
      if (secondaryError) setError(`The webcam (Z) didn't open, so pen up/down can't be calibrated. ${secondaryError}`);
      setActiveCameraCount(streams.length);
      await refreshDevices();
      setStatus("ready");
    } catch (e) {
      console.error("Camera failed to open:", e);
      setError(cameraErrorMessage(e));
      setStatus("error");
    }
  }, [refreshDevices]);

  // A <video> that mounts after start() (Home -> editor, or a reopened panel) starts out empty: hand it the running stream.
  const attach = useCallback(() => {
    [videoRef.current, secondaryVideoRef.current].forEach((video, index) => {
      const stream = streamRefs.current[index];
      if (video && stream && video.srcObject !== stream) {
        video.srcObject = stream;
        video.play().catch(() => {});
      }
    });
  }, []);

  useEffect(() => {
    refreshDevices().catch(() => setError("Could not list connected cameras."));
    const onDeviceChange = () => { refreshDevices().catch(() => setError("Could not list connected cameras.")); };
    navigator.mediaDevices?.addEventListener("devicechange", onDeviceChange);
    return () => {
      navigator.mediaDevices?.removeEventListener("devicechange", onDeviceChange);
      stop();
    };
  }, [refreshDevices, stop]);

  return { videoRef, secondaryVideoRef, status, error, devices, activeCameraCount, selectedDeviceId, setSelectedDeviceId, selectedSecondaryId, setSelectedSecondaryId, start, stop, attach };
}