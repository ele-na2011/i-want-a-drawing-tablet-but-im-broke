import { useCallback, useEffect, useRef, useState } from "react";

export type CameraStatus = "idle" | "requesting" | "ready" | "error";
export interface CameraDevice {
  deviceId: string;
  label: string;
}

export function useCamera() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const secondaryVideoRef = useRef<HTMLVideoElement>(null);
  const streamRefs = useRef<(MediaStream | null)[]>([null, null]);
  const [status, setStatus] = useState<CameraStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [activeCameraCount, setActiveCameraCount] = useState(0);
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
    streamRefs.current.forEach((stream) => stream?.getTracks().forEach((track) => track.stop()));
    streamRefs.current = [null, null];
    if (videoRef.current) videoRef.current.srcObject = null;
    if (secondaryVideoRef.current) secondaryVideoRef.current.srcObject = null;
    setActiveCameraCount(0);
    setStatus("idle");
  }, []);

  const start = useCallback(async (deviceId?: string) => {
    setStatus("requesting");
    setError(null);
    try {
      const available = devices.length > 0 ? devices.map((device) => device.deviceId) : await navigator.mediaDevices.enumerateDevices()
        .then((all) => all.filter((item) => item.kind === "videoinput").map((item) => item.deviceId));
      const primaryId = deviceId || available[0];
      const secondaryId = available.find((id) => id && id !== primaryId);
      if (!primaryId) throw new DOMException("No webcam was found.", "NotFoundError");

      const ids = [primaryId, secondaryId].filter((id): id is string => Boolean(id));
      const streams = await Promise.all(ids.map((id) => navigator.mediaDevices.getUserMedia({
        video: {
          deviceId: { exact: id },
          width: { ideal: 640 },
          height: { ideal: 480 },
          frameRate: { ideal: 30, max: 60 },
        },
        audio: false,
      })));
      streamRefs.current.forEach((stream) => stream?.getTracks().forEach((track) => track.stop()));
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
      setActiveCameraCount(streams.length);
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

  return { videoRef, secondaryVideoRef, status, error, devices, activeCameraCount, selectedDeviceId, setSelectedDeviceId, start, stop };
}