from pathlib import Path
from ultralytics import YOLO

BASE_DIR = Path(__file__).resolve().parent

candidates = [
    BASE_DIR / "runs" / "detect" / "runs" / "face_mask_v1" / "weights" / "best.pt",
    BASE_DIR / "runs" / "detect" / "runs" / "face_mask_v2" / "weights" / "best.pt",
    BASE_DIR / "best.pt",
    BASE_DIR / "models" / "best_nma.pt",
    BASE_DIR / "models" / "best.pt"
]

model_path = next((p for p in candidates if p.exists()), None)
if not model_path:
    raise FileNotFoundError("Trained face mask model weights not found.")

model = YOLO(str(model_path))
print(f"Loaded weights from: {model_path}")
print("Classes:", model.names)
