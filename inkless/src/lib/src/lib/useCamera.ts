import { useCallback, useEffect, useRef, useState } from "react";

export type CameraStatus = "idle" | "requesting" | "ready" | "error";
export interface CameraDevice {
  deviceId: string;
  label: string;
}

export function useCamera() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [status, setStatus] = useState<CameraStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [devices, setDevices] = useState<CameraDevice[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState("");

  const refreshDevices = useCallback(async () => {
    if (!navigator.mediaDevices?.enumerateDevices) return;
    const all = await navigator.mediaDevices.enumerateDevices();
    const cameras = all
      .filter((device) => device.kind === "videoinput")
      .map((device, index) => ({ deviceId: device.deviceId, label: device.label || `Camera ${index + 1}` }));
    setDevices(cameras);
    setSelectedDeviceId((current) => cameras.some((device) => device.deviceId === current) ? current : cameras[0]?.deviceId ?? "");
  }, []);

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setStatus("idle");
  }, []);

  const start = useCallback(async (deviceId?: string) => {
    setStatus("requesting");
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          deviceId: deviceId ? { exact: deviceId } : undefined,
          width: { ideal: 640 },
          height: { ideal: 480 },
          frameRate: { ideal: 30, max: 60 },
        },
        audio: false,
      });
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = stream;
      const activeDeviceId = stream.getVideoTracks()[0]?.getSettings().deviceId;
      if (activeDeviceId) setSelectedDeviceId(activeDeviceId);
      const video = videoRef.current;
      if (video) {
        video.srcObject = stream;
        await video.play();
      }
      await refreshDevices();
      setStatus("ready");
    } catch (e) {
      const name = e instanceof DOMException ? e.name : "";
      setError(name === "NotAllowedError"
        ? "Camera permission was denied. Allow it in the browser's site settings."
        : name === "NotFoundError"
          ? "No webcam was found. Connect the Logitech camera and try again."
          : "Could not open this camera. Check that it is connected and not in use.");
      setStatus("error");
    }
  }, [refreshDevices]);

  useEffect(() => {
    refreshDevices().catch(() => setError("Could not list connected cameras."));
    const onDeviceChange = () => { refreshDevices().catch(() => setError("Could not list connected cameras.")); };
    navigator.mediaDevices?.addEventListener("devicechange", onDeviceChange);
    return () => {
      navigator.mediaDevices?.removeEventListener("devicechange", onDeviceChange);
      stop();
    };
  }, [refreshDevices, stop]);

  return { videoRef, status, error, devices, selectedDeviceId, setSelectedDeviceId, start, stop };
}