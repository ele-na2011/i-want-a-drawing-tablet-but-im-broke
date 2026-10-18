from pathlib import Path
import importlib
from typing import Any

IMAGE_DIR = Path("led_images")
IMAGE_DIR.mkdir(exist_ok=True)

try:
    cv2: Any = importlib.import_module("cv2")
except ImportError:
    cv2 = None

WINDOW_NAME = "Green LED Tracking"

# Lower values make the preview darker.
PREVIEW_BRIGHTNESS = 0.15

# Green color range in OpenCV's HSV format.
# Adjust these if your LED isn't detected.
LOWER_GREEN = (35, 80, 110)
UPPER_GREEN = (85, 255, 255)

MIN_LED_AREA = 2

def main():
    if cv2 is None:
        print(
            "OpenCV is not installed. Install it with: "
            "python -m pip install opencv-python"
        )
        return 1

    camera = cv2.VideoCapture(0)

    try:
        if not camera.isOpened():
            print("Could not open the webcam.")
            return 1

        cv2.namedWindow(WINDOW_NAME, cv2.WINDOW_NORMAL)

        while True:
            success, frame = camera.read()
            if not success:
                print("Could not read the webcam.")
                return 1

            frame = cv2.flip(frame, 1)

            # Detect bright green pixels in the original image.
            hsv = cv2.cvtColor(frame, cv2.COLOR_BGR2HSV)
            mask = cv2.inRange(hsv, LOWER_GREEN, UPPER_GREEN)

            # Join small gaps in the detected light.
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

            # Darken the video, then draw the overlay at full brightness.
            preview = cv2.convertScaleAbs(
                frame,
                alpha=PREVIEW_BRIGHTNESS,
                beta=0,
            )

            status = "Looking for a green LED..."

            if candidates:
                # Track the largest matching green region.
                target = max(candidates, key=cv2.contourArea)
                x, y, width, height = cv2.boundingRect(target)

                center_x = x + width // 2
                center_y = y + height // 2

                # Make a square with padding around the detected light.
                side = max(width, height) + 20
                half = (side + 1) // 2

                # OpenCV uses BGR: (255, 0, 0) means blue.
                cv2.rectangle(
                    preview,
                    (center_x - half, center_y - half),
                    (center_x + half, center_y + half),
                    (255, 0, 0),
                    2,
                )

                status = f"Green detected: x={center_x}, y={center_y}"

            cv2.putText(
                preview,
                status,
                (20, 35),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.65,
                (255, 255, 255),
                2,
            )
            cv2.putText(
                preview,
                "Q: quit | M: show detection mask",
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
                cv2.imshow("Detection Mask", mask)
            elif key == ord("s"):
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
        camera.release()
        cv2.destroyAllWindows()


if __name__ == "__main__":
    raise SystemExit(main())