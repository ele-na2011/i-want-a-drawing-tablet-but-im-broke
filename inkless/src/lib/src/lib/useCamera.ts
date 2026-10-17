import { useCallback, useEffect, useRef, useState } from "react";

export type CameraStatus = "idle" | "requesting" | "ready" | "error";

export function useCamera() {
const videoRef = useRef<HTMLVideoElement>(null);
const streamRef = useRef<MediaStream | null>(null);
const [status, setStatus] = useState<CameraStatus>("idle");
const [error, setError] = useState<string | null>(null);

const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setStatus("idle");
}, []);

const start = useCallback(async () => {
    setStatus("requesting");
    setError(null);
    try {
const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, frameRate: 30 },
});
streamRef.current = stream;
    const video = videoRef.current;
if (video) {
        video.srcObject = stream;
        await video.play();
}
setStatus("ready");
    } catch (e) {
const denied = e instanceof DOMException && e.name === "NotAllowedError";
setError(
        denied
? "Camera permission was denied. Allow it in your browser's site settings and try again."
: "Could not open the camera. Check that it's connected and not in use by another app."
);
setStatus("error");
    }
}, []);

  // turn the camera off when the component unmounts
useEffect(() => stop, [stop]);

 return { videoRef, status, error, start, stop };
}