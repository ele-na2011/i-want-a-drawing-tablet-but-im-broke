import cv2
from ultralytics import YOLO

# Load your trained model
model = YOLO(r"C:\Users\rosee\.vscode\placeholder\inkless\best.pt")

# Start webcam (0 is usually the default camera)
cap = cv2.VideoCapture(0)

if not cap.isOpened():
    raise RuntimeError("Could not open webcam. Check the camera index.")

while True:
    success, frame = cap.read()

    if not success:
        break

    # Detect the green LED
    results = model.predict(
        frame,
        conf=0.1,
        iou=0.3,
        verbose=False
    )

    # Draw detections and get LED coordinates
    for result in results:
        for box in result.boxes:
            x1, y1, x2, y2 = map(
                int, box.xyxy[0].tolist()
            )

            center_x = (x1 + x2) // 2
            center_y = (y1 + y2) // 2

            confidence = float(box.conf[0])

            cv2.rectangle(
                frame, (x1, y1), (x2, y2),
                (0, 255, 0), 2
            )

            cv2.circle(
                frame, (center_x, center_y),
                5, (0, 0, 255), -1
            )

            cv2.putText(
                frame,
                f"LED ({center_x}, {center_y}) {confidence:.2f}",
                (x1, max(25, y1 - 10)),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.6, (0, 255, 0), 2
            )

            print(
                f"LED position: x={center_x}, y={center_y}",
                end="\r"
            )

    cv2.imshow("Inkless - LED Tracking", frame)

    # Press Q to quit
    if cv2.waitKey(1) & 0xFF == ord("q"):
        break

cap.release()
cv2.destroyAllWindows()
