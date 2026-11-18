"""
Face Mask Detection - FastAPI Backend Server
Serves YOLOv8 inference for the React.js web interface.
Provides REST and WebSocket/Stream-ready endpoints for image analysis and live webcam detection.
"""

import io
import time
import base64
from pathlib import Path
from typing import Optional, List, Dict, Any

import cv2
import numpy as np
from fastapi import FastAPI, File, UploadFile, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from ultralytics import YOLO

# Resolve base directories safely
BASE_DIR = Path(__file__).resolve().parent
FRONTEND_DIST = BASE_DIR / "frontend" / "dist"

app = FastAPI(
    title="Face Mask Detection API",
    description="Real-time Face Mask Detection API powered by YOLOv8",
    version="1.0.0"
)

# Enable CORS for React dev server (e.g., http://localhost:5173)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Model loader with robust path fallback
def find_model_path() -> Path:
    candidates = [
        BASE_DIR / "best.pt",
        BASE_DIR / "runs" / "detect" / "runs" / "face_mask_v2" / "weights" / "best.pt",
        BASE_DIR / "runs" / "detect" / "runs" / "face_mask_v1" / "weights" / "best.pt",
        BASE_DIR / "models" / "best_nma.pt",
        BASE_DIR / "models" / "best.pt",
        BASE_DIR / "yolov8n.pt",
    ]
    for path in candidates:
        if path.exists() and path.is_file():
            return path
    raise FileNotFoundError("No YOLO model checkpoint found.")

MODEL_PATH = find_model_path()
print(f"[INFO] Loading YOLO model from: {MODEL_PATH}")
model = YOLO(str(MODEL_PATH))
print(f"[INFO] Model classes detected: {model.names}")


def normalize_class(class_id: int, raw_name: str):
    """
    Standardizes varied model class outputs into uniform 'mask' vs 'no_mask'.
    Handles:
      - {0: 'no_mask', 1: 'mask'}
      - {0: 'face', 1: 'face_masked'}
      - {0: 'Bermasker', 1: 'Tidak_Bermasker'}
      - custom user classes
    """
    raw_lower = str(raw_name).lower().strip()
    
    # Check masked patterns
    if raw_lower in ["mask", "face_masked", "bermasker", "with_mask", "masked"]:
        return "mask", "Mask On", "COMPLIANT"
    
    # Check unmasked patterns
    if raw_lower in ["no_mask", "face", "tidak_bermasker", "without_mask", "unmasked"]:
        return "no_mask", "No Mask", "VIOLATION"
    
    # Fallback by typical binary index (1 usually mask, 0 usually no_mask or face)
    if class_id == 1:
        return "mask", "Mask On", "COMPLIANT"
    else:
        return "no_mask", "No Mask", "VIOLATION"


def run_inference(img: np.ndarray, conf_threshold: float = 0.35, iou_threshold: float = 0.45):
    """
    Executes inference, extracts bounding boxes, generates metadata, and draws visual annotations.
    """
    start_time = time.time()
    results = model(img, conf=conf_threshold, iou=iou_threshold, verbose=False)
    inference_time_ms = round((time.time() - start_time) * 1000, 2)

    detections = []
    mask_count = 0
    no_mask_count = 0

    annotated = img.copy()
    h, w = annotated.shape[:2]

    if len(results) > 0 and results[0].boxes is not None:
        boxes = results[0].boxes
        for box in boxes:
            xyxy = box.xyxy[0].cpu().numpy().astype(int)
            x1, y1, x2, y2 = xyxy.tolist()
            conf = float(box.conf[0].cpu().numpy())
            cls_id = int(box.cls[0].cpu().numpy())
            raw_name = model.names.get(cls_id, f"class_{cls_id}")
            
            label, display_label, compliance_status = normalize_class(cls_id, raw_name)
            
            if compliance_status == "COMPLIANT":
                mask_count += 1
                color = (46, 204, 113)  # Bright Green (BGR)
                badge_bg = (39, 174, 96)
            else:
                no_mask_count += 1
                color = (60, 60, 235)   # Vivid Red (BGR)
                badge_bg = (40, 40, 200)

            detections.append({
                "box": [x1, y1, x2, y2],
                "confidence": round(conf, 4),
                "class_id": cls_id,
                "raw_name": raw_name,
                "label": label,
                "display_name": display_label,
                "status": compliance_status
            })

            # Draw visual bounding box
            cv2.rectangle(annotated, (x1, y1), (x2, y2), color, 3)

            # Draw badge label
            tag = f"{display_label} {int(conf * 100)}%"
            (tw, th), _ = cv2.getTextSize(tag, cv2.FONT_HERSHEY_DUPLEX, 0.6, 1)
            box_top = max(y1 - th - 12, 0)
            cv2.rectangle(annotated, (x1, box_top), (x1 + tw + 12, box_top + th + 10), badge_bg, -1)
            cv2.putText(
                annotated,
                tag,
                (x1 + 6, box_top + th + 4),
                cv2.FONT_HERSHEY_DUPLEX,
                0.6,
                (255, 255, 255),
                1,
                cv2.LINE_AA
            )

    total_faces = mask_count + no_mask_count
    compliance_rate = round((mask_count / total_faces * 100), 1) if total_faces > 0 else 100.0

    # Encode annotated image to Base64 JPEG
    success, buffer = cv2.imencode('.jpg', annotated, [int(cv2.IMWRITE_JPEG_QUALITY), 88])
    annotated_base64 = ""
    if success:
        annotated_base64 = f"data:image/jpeg;base64,{base64.b64encode(buffer).decode('utf-8')}"

    return {
        "detections": detections,
        "summary": {
            "total_faces": total_faces,
            "mask_count": mask_count,
            "no_mask_count": no_mask_count,
            "compliance_rate": compliance_rate,
            "all_compliant": (no_mask_count == 0)
        },
        "image_dimensions": {"width": w, "height": h},
        "inference_time_ms": inference_time_ms,
        "annotated_image": annotated_base64
    }


class FramePayload(BaseModel):
    image: str  # Data URL or raw base64 string
    confidence: Optional[float] = 0.35
    iou: Optional[float] = 0.45


@app.get("/api/status")
def get_status():
    """Returns model health, active weights path, and detected classes."""
    return {
        "status": "ready",
        "model_path": str(MODEL_PATH.name),
        "full_path": str(MODEL_PATH),
        "classes": model.names,
        "device": str(model.device),
        "task": "detect"
    }


@app.post("/api/detect")
async def detect_image(
    file: UploadFile = File(...),
    confidence: float = Form(0.35),
    iou: float = Form(0.45)
):
    """Endpoint for single image file upload."""
    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Uploaded file is not a valid image.")

    content = await file.read()
    nparr = np.frombuffer(content, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

    if img is None:
        raise HTTPException(status_code=400, detail="Could not decode image.")

    result = run_inference(img, conf_threshold=confidence, iou_threshold=iou)
    return JSONResponse(content=result)


@app.post("/api/detect-frame")
def detect_frame(payload: FramePayload):
    """Endpoint for live webcam frames sent via Base64."""
    data_str = payload.image
    if "," in data_str:
        data_str = data_str.split(",")[1]

    try:
        binary_data = base64.b64decode(data_str)
        nparr = np.frombuffer(binary_data, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid base64 frame: {str(e)}")

    if img is None:
        raise HTTPException(status_code=400, detail="Could not decode frame.")

    result = run_inference(
        img,
        conf_threshold=payload.confidence or 0.35,
        iou_threshold=payload.iou or 0.45
    )
    return JSONResponse(content=result)


# Generate sample test image for instant demo without webcam
@app.get("/api/sample-image")
def get_sample_image():
    """Generates a synthetic demo image with face placeholders to test detection."""
    canvas = np.full((480, 640, 3), 245, dtype=np.uint8)
    
    # Draw simple illustrated test faces
    # Person 1 (Masked)
    cv2.circle(canvas, (200, 220), 80, (215, 230, 245), -1)
    cv2.circle(canvas, (175, 200), 10, (50, 50, 50), -1)
    cv2.circle(canvas, (225, 200), 10, (50, 50, 50), -1)
    cv2.rectangle(canvas, (150, 220), (250, 280), (180, 140, 90), -1) # Blueish mask
    cv2.putText(canvas, "TEST SUBJECT A", (145, 120), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (90, 90, 90), 1)

    # Person 2 (Unmasked)
    cv2.circle(canvas, (440, 220), 80, (215, 230, 245), -1)
    cv2.circle(canvas, (415, 200), 10, (50, 50, 50), -1)
    cv2.circle(canvas, (465, 200), 10, (50, 50, 50), -1)
    cv2.ellipse(canvas, (440, 250), (25, 12), 0, 0, 180, (60, 60, 180), -1) # Mouth
    cv2.putText(canvas, "TEST SUBJECT B", (385, 120), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (90, 90, 90), 1)

    _, buffer = cv2.imencode('.jpg', canvas)
    return JSONResponse(content={
        "image": f"data:image/jpeg;base64,{base64.b64encode(buffer).decode('utf-8')}"
    })


# Static assets serving for compiled React frontend
if FRONTEND_DIST.exists():
    app.mount("/", StaticFiles(directory=str(FRONTEND_DIST), html=True), name="frontend")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("server:app", host="127.0.0.1", port=8000, reload=True)
