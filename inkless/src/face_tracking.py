import cv2
import argparse
from pathlib import Path

# Training snapshots go to led_images/ at the repo root.
IMAGE_DIR = Path(__file__).resolve().parents[2] / "led_images"

WINDOW_NAME = "Green LED Tracking"
DEFAULT_CAMERA_INDICES = (0, 1)

# Lower values make the preview darker.
PREVIEW_BRIGHTNESS = 0.15

# Green color range in OpenCV's HSV format.
# Adjust these if your LED isn't detected.
LOWER_GREEN = (35, 80, 110)
UPPER_GREEN = (85, 255, 255)

MIN_LED_AREA = 2


def detect_green_led(frame):
    """Return the largest green LED bounding box, or None when it is absent."""
    hsv = cv2.cvtColor(frame, cv2.COLOR_BGR2HSV)
    mask = cv2.inRange(hsv, LOWER_GREEN, UPPER_GREEN)

    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3))
    mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel)
    contours, _ = cv2.findContours(
        mask,
        cv2.RETR_EXTERNAL,
        cv2.CHAIN_APPROX_SIMPLE,
    )
    candidates = [
        contour
        for contour in contours
        if cv2.contourArea(contour) >= MIN_LED_AREA
    ]
    if not candidates:
        return None, mask

    x, y, width, height = cv2.boundingRect(
        max(candidates, key=cv2.contourArea)
    )
    return (x, y, width, height), mask


def annotate_frame(frame, detection):
    """Darken a camera frame and draw the green-LED detection overlay."""
    preview = cv2.convertScaleAbs(frame, alpha=PREVIEW_BRIGHTNESS, beta=0)
    if detection is None:
        return preview, "LED not found"

    x, y, width, height = detection
    center_x = x + width // 2
    center_y = y + height // 2
    side = max(width, height) + 20
    half = (side + 1) // 2
    cv2.rectangle(
        preview,
        (center_x - half, center_y - half),
        (center_x + half, center_y + half),
        (255, 0, 0),
        2,
    )
    return preview, f"Green LED: x={center_x}, y={center_y}"


def parse_args():
    parser = argparse.ArgumentParser(
        description="Track one green LED with two cameras."
    )
    parser.add_argument(
        "--cameras",
        nargs=2,
        type=int,
        default=DEFAULT_CAMERA_INDICES,
        metavar=("CAMERA_A", "CAMERA_B"),
        help="Two camera device indices (default: 0 1)",
    )
    return parser.parse_args()


def main():
    camera_indices = parse_args().cameras
    cameras = [cv2.VideoCapture(index) for index in camera_indices]

    try:
        unavailable = [
            index
            for index, camera in zip(camera_indices, cameras)
            if not camera.isOpened()
        ]
        if unavailable:
            print(f"Could not open camera(s): {', '.join(map(str, unavailable))}.")
            return 1

        cv2.namedWindow(WINDOW_NAME, cv2.WINDOW_NORMAL)

        while True:
            previews = []
            detections = []
            frames = []
            masks = []
            for camera in cameras:
                success, frame = camera.read()
                if not success:
                    print("Could not read one of the cameras.")
                    return 1
                frame = cv2.flip(frame, 1)
                detection, mask = detect_green_led(frame)
                frames.append(frame)
                masks.append(mask)
                preview, status = annotate_frame(frame, detection)
                cv2.putText(
                    preview,
                    status,
                    (20, 35),
                    cv2.FONT_HERSHEY_SIMPLEX,
                    0.65,
                    (255, 255, 255),
                    2,
                )
                previews.append(preview)
                detections.append(detection)

            target_height = min(preview.shape[0] for preview in previews)
            previews = [
                cv2.resize(
                    preview,
                    (
                        round(preview.shape[1] * target_height / preview.shape[0]),
                        target_height,
                    ),
                )
                for preview in previews
            ]
            if all(detection is not None for detection in detections):
                status = "Both cameras agree: LED available for analysis"
            else:
                status = "Waiting for both cameras to see the green LED"
            cv2.putText(
                previews[0],
                status,
                (20, previews[0].shape[0] - 20),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.55,
                (255, 255, 255),
                1,
            )
            preview = cv2.hconcat(previews)
            cv2.putText(
                preview,
                "Q: quit",
                (20, preview.shape[0] - 20),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.55,
                (255, 255, 255),
                1,
            )

            cv2.imshow(WINDOW_NAME, preview)

            key = cv2.waitKey(1) & 0xFF

            if key == ord("q"):
                break
            elif key == ord("m"):
                for index, mask in zip(camera_indices, masks):
                    cv2.imshow(f"Detection Mask (camera {index})", mask)
            elif key == ord("s"):
                IMAGE_DIR.mkdir(exist_ok=True)
                for frame in frames:
                    count = len(list(IMAGE_DIR.glob("*.jpg")))
                    path = IMAGE_DIR / f"led_{count:04d}.jpg"
                    cv2.imwrite(str(path), frame)
                    print(f"Saved {path}")

            if cv2.getWindowProperty(
                WINDOW_NAME, cv2.WND_PROP_VISIBLE
            ) < 1:
                break

        return 0

    finally:
        for camera in cameras:
            camera.release()
        cv2.destroyAllWindows()


if __name__ == "__main__":
    raise SystemExit(main())