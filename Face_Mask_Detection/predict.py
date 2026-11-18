from pathlib import Path
import cv2
from ultralytics import YOLO

BASE_DIR = Path(__file__).resolve().parent

def find_weights() -> Path:
    candidates = [
        BASE_DIR / "runs" / "detect" / "runs" / "face_mask_v2" / "weights" / "best.pt",
        BASE_DIR / "runs" / "detect" / "runs" / "face_mask_v1" / "weights" / "best.pt",
        BASE_DIR / "best.pt",
        BASE_DIR / "models" / "best_nma.pt",
        BASE_DIR / "models" / "best.pt",
        BASE_DIR / "yolov8n.pt"
    ]
    for p in candidates:
        if p.exists() and p.is_file():
            return p
    raise FileNotFoundError("No YOLO weights found.")

def main():
    weight_path = find_weights()
    print(f"[INFO] Loading YOLO model from: {weight_path}")
    model = YOLO(str(weight_path))

    # Open webcam
    cap = cv2.VideoCapture(0)

    if not cap.isOpened():
        print("Error: Unable to open webcam at index 0. Try another index or ensure webcam is connected.")
        return

    print("[INFO] Starting real-time detection. Press 'q' to quit.")

    while True:
        # Read frame
        ret, frame = cap.read()

        if not ret:
            print("Error: Failed to read frame.")
            break

        # Perform inference
        results = model(frame, conf=0.35, iou=0.45, verbose=False)

        # Draw detections automatically
        annotated_frame = results[0].plot()

        # Display result
        cv2.imshow("Face Mask Detection - OpenCV Stream", annotated_frame)

        # Press 'q' to quit
        if cv2.waitKey(1) & 0xFF == ord("q"):
            break

    # Release resources
    cap.release()
    cv2.destroyAllWindows()


if __name__ == "__main__":
    main()
