
import cv2
from ultralytics import YOLO
from pathlib import Path

# Load the existing trained LED detector
model = YOLO(str(Path(__file__).parent / "best.pt"))

# Camera 1 is usually the laptop webcam.
# Try changing 1 to 0 or 2 if this opens the wrong camera.
cap = cv2.VideoCapture(1)

if not cap.isOpened():
    raise RuntimeError(
        "Could not open camera. Try camera index 0 or 2."
    )

touch_y = None
hover_y = None

while True:
    success, frame = cap.read()
    if not success:
        break

    results = model.predict(
        frame,
        conf=0.1,
        iou=0.3,
        verbose=False
    )

    led_y = None

    for result in results:
        if result.boxes is None or len(result.boxes) == 0:
            continue

        # Use the most confident detection
        best_index = int(result.boxes.conf.argmax())
        box = result.boxes[best_index]

        x1, y1, x2, y2 = map(
            int, box.xyxy[0].tolist()
        )

        led_x = (x1 + x2) // 2
        led_y = (y1 + y2) // 2

        cv2.rectangle(
            frame, (x1, y1), (x2, y2), (0, 255, 0), 2
        )
        cv2.circle(
            frame, (led_x, led_y), 5, (0, 0, 255), -1
        )

    state = "UNCALIBRATED"

    if led_y is not None and touch_y is not None:
        if hover_y is None:
            state = "TOUCH REFERENCE SET"
        else:
            # Compare the current LED position with both references
            touch_distance = abs(led_y - touch_y)
            hover_distance = abs(led_y - hover_y)

            if touch_distance < hover_distance:
                state = "TOUCHING"
            else:
                state = "HOVERING"

    cv2.putText(
        frame,
        f"State: {state}",
        (20, 35),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.9,
        (0, 255, 0) if state == "TOUCHING"
        else (0, 165, 255),
        2
    )

    cv2.imshow("Inkless - Contact Prototype", frame)

    key = cv2.waitKey(1) & 0xFF

    if key == ord("t") and led_y is not None:
        touch_y = led_y
        print("Touch reference:", touch_y)

    elif key == ord("h") and led_y is not None:
        hover_y = led_y
        print("Hover reference:", hover_y)

    elif key == ord("q"):
        break

cap.release()
cv2.destroyAllWindows()