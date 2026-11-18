# Real-Time Face Mask Detection with YOLOv8 & React.js

![Python](https://img.shields.io/badge/Python-3.11%20%7C%203.14-3776AB?logo=python&logoColor=white)
![YOLOv8](https://img.shields.io/badge/Model-YOLOv8%20Nano-00FFFF?logo=ultralytics&logoColor=black)
![PyTorch](https://img.shields.io/badge/PyTorch-2.x-EE4C2C?logo=pytorch&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-0.163-009688?logo=fastapi&logoColor=white)
![React](https://img.shields.io/badge/React-19.x%20(Vite)-61DAFB?logo=react&logoColor=black)
![OpenCV](https://img.shields.io/badge/OpenCV-4.x-5C3EE8?logo=opencv&logoColor=white)

A high-performance, real-time **Face Mask Detection & Compliance Monitoring System** built with **Ultralytics YOLOv8 Nano**, a **FastAPI inference backend**, and a modern, minimalist **React.js web dashboard**.

The system detects and distinguishes between:
* `mask` (Compliant / Facial Covering Present)
* `no_mask` (Violation / Uncovered Face)

It processes static image uploads and live webcam streams with low-latency inference (~20–30ms on CPU, ~10ms on GPU), rendering bounding boxes, confidence scores, and safety compliance metrics.

---

## Table of Contents

1. [Project Overview & Workflow](#project-overview--workflow)
2. [Key Features](#key-features)
3. [React.js Web Interface (MaskVision)](#reactjs-web-interface-maskvision)
4. [Dataset & Annotation Format](#dataset--annotation-format)
5. [Model Training & Transfer Learning](#model-training--transfer-learning)
6. [Training Losses & Mathematical Concepts](#training-losses--mathematical-concepts)
7. [Validation & Evaluation Metrics](#validation--evaluation-metrics)
8. [Project Structure](#project-structure)
9. [REST API Reference](#rest-api-reference)
10. [Quickstart Guide](#quickstart-guide)
11. [Troubleshooting & FAQ](#troubleshooting--faq)

---

## Project Overview & Workflow

Pretrained COCO models categorize 80 common object classes (e.g., person, car, dog) but lack fine-grained facial mask classifications. This project implements an end-to-end custom computer vision pipeline:

```text
Custom Dataset (Mask / No-Mask)
      ↓
Object Annotation (YOLO Format)
      ↓
Dataset Structure & data.yaml
      ↓
Transfer Learning (yolov8n.pt fine-tuning)
      ↓
Validation & Evaluation (mAP, Precision, Recall)
      ↓
Model Weights (best.pt)
      ↓
Inference Engine (FastAPI Server + Desktop OpenCV)
      ↓
User Interface (React.js Minimalist Dashboard)
```

---

## Key Features

* **Real-Time Webcam Vision**: Direct browser webcam capture via HTML5 `getUserMedia` streaming frames to YOLOv8 with real-time bounding box annotations and FPS counter.
* **Dual Deployment Modes**:
  * **Web Application**: Full-stack modern web dashboard built with React.js (Vite) and FastAPI.
  * **Desktop Application**: Standalone OpenCV desktop window (`predict.py`) for low-overhead edge devices.
* **Instant Safety Telemetry**:
  * Dynamic compliance score: `(Masked Faces / Total Faces) * 100%`.
  * Visual safety state: `🟢 100% Compliant` vs `🔴 Violation Detected`.
  * Web Audio API synthesized warning chime on safety violation.
* **Face Inspector Breakdown**: Face-by-face list detailing bounding box coordinates `[x1, y1, x2, y2]`, detection confidence, and compliance tags.
* **Interactive Threshold Sliders**: Live adjustments for Confidence Threshold (10%–90%) and Non-Maximum Suppression (NMS) IoU (20%–80%).
* **Synthetic Test Generator**: Built-in test sample generator to test and verify the detector pipeline offline without a physical webcam.

---

## React.js Web Interface (MaskVision)

The web dashboard is located in `frontend/` and compiled to static assets served directly by the FastAPI backend at `http://127.0.0.1:8000`.

### UI/UX Highlights
* **Clean, Minimalist Black & White Theme**: High-contrast, distraction-free aesthetic with crisp 1px borders, zero drop-shadows, and zero ambient glow.
* **Viewport-First Architecture**: Fits laptop and 1080p desktop monitors without vertical scrolling past bulky headers.
* **Floating Vision HUD**: Latency (ms), FPS, and compliance badges float discreetly over the active camera/canvas viewport.
* **Segmented Mode Switcher**:
  * `📷 Webcam`: Live continuous video feed monitoring.
  * `📁 Upload`: Drag & drop or select local JPG, PNG, or WEBP photos for instant inspection and export.
  * `⚡ Demo`: Synthetic demo generator for quick verification.

---

## Dataset & Annotation Format

The dataset link is available here:
🔗 [Dataset Google Drive Folder](https://drive.google.com/drive/folders/1HMxrWNJ2fHJm85WF2a6a1n4jVqQbEcHs?usp=sharing)

### Directory Organization
```text
dataset/
├── train/
│   ├── images/
│   └── labels/
├── valid/
│   ├── images/
│   └── labels/
└── test/
    ├── images/
    └── labels/
```

### YOLO Annotation Structure
Each image has a corresponding `.txt` file sharing the exact same basename. Every row represents one bounding box:

```text
<class_id> <x_center> <y_center> <width> <height>
```

All spatial coordinates are **normalized** between `0.0` and `1.0`:
* `x_center = box_x_center / image_width`
* `y_center = box_y_center / image_height`
* `width = box_width / image_width`
* `height = box_height / image_height`

### Class Mapping (`data.yaml`)
```yaml
train: dataset/train/images
val: dataset/valid/images
test: dataset/test/images

nc: 2
names:
  0: no_mask
  1: mask
```

---

## Model Training & Transfer Learning

Training transfers features learned by the base `yolov8n.pt` backbone on COCO and fine-tunes the detection heads on our custom mask classes.

```python
from ultralytics import YOLO

# Load base YOLOv8 nano model
model = YOLO("yolov8n.pt")

# Fine-tune on custom dataset
model.train(
    data="data.yaml",
    epochs=50,
    imgsz=640,
    batch=16,
    project="runs",
    name="face_mask_v1",
    device="cpu"  # Change to 0 for CUDA GPU
)
```

Trained weights are automatically preserved in:
```text
runs/
└── detect/
    └── face_mask_v1/
        └── weights/
            ├── best.pt    # Optimal validation checkpoint
            └── last.pt    # Final epoch checkpoint
```

---

## Training Losses & Mathematical Concepts

During training, YOLO optimizes a compound loss function:

$$\text{Total Loss} = \lambda_{\text{box}} \mathcal{L}_{\text{box}} + \lambda_{\text{cls}} \mathcal{L}_{\text{cls}} + \lambda_{\text{dfl}} \mathcal{L}_{\text{dfl}}$$

### 1. Box Loss ($\mathcal{L}_{\text{box}}$)
Measures the error in bounding box localization using **Complete IoU (CIoU)** loss. CIoU accounts for overlap area, central point distance, and aspect ratio:

$$\mathcal{L}_{\text{CIoU}} = 1 - \text{IoU} + \frac{\rho^2(b, b^{gt})}{c^2} + \alpha v$$

* Decreasing Box Loss indicates that predicted boxes align tightly with ground truth annotations.

### 2. Classification Loss ($\mathcal{L}_{\text{cls}}$)
Measures category prediction error using **Binary Cross-Entropy (BCE)** loss:

$$\mathcal{L}_{\text{cls}} = -\sum [y \log(\hat{y}) + (1 - y) \log(1 - \hat{y})]$$

* Decreasing Classification Loss indicates increasing accuracy distinguishing `mask` from `no_mask`.

### 3. Distribution Focal Loss ($\mathcal{L}_{\text{dfl}}$)
DFL models box boundaries as continuous probability distributions rather than single discrete coordinates, addressing blurry or ambiguous edges.

---

## Validation & Evaluation Metrics

A reliable detector is evaluated using precision, recall, and intersection-over-union thresholds:

### Precision ($P$)
Of all faces predicted as masked, how many were truly masked?
$$P = \frac{\text{TP}}{\text{TP} + \text{FP}}$$

### Recall ($R$)
Of all actual masked faces in the scene, how many did the model detect?
$$R = \frac{\text{TP}}{\text{TP} + \text{FN}}$$

### Mean Average Precision (mAP)
* **mAP50**: Mean Average Precision calculated at an IoU threshold of 0.50 (standard detection benchmark).
* **mAP50-95**: Average mAP across 10 IoU thresholds from 0.50 to 0.95 in steps of 0.05 (strict localization benchmark).

### Evaluation Curves
Training produces evaluation artifacts saved in `runs/`:
* **P Curve**: Precision plotted against confidence thresholds.
* **R Curve**: Recall plotted against confidence thresholds.
* **PR Curve**: Precision vs. Recall trade-off curve across all operating points.
* **F1 Curve**: Optimal harmonic mean between precision and recall to guide threshold selection.

---

## Project Structure

```text
Face_Mask_Detection/
├── data.yaml              # Dataset path and class definitions
├── train.py               # Transfer learning script (YOLOv8 Nano)
├── test.py                # Model weight verification script
├── predict.py             # Standalone desktop OpenCV webcam inference
├── server.py              # FastAPI REST & live frame detection server
├── requirements.txt       # Python package dependencies
├── yolov8n.pt             # Pretrained base YOLOv8 model
├── best.pt                # Trained face mask model weights
│
├── models/                # Local checkpoint directory
│   ├── best.pt            # Primary fine-tuned weights
│   └── best_nma.pt        # Alternate fine-tuned weights
│
├── runs/                  # YOLO training & evaluation logs
│   └── detect/
│       └── runs/
│           ├── face_mask_v1/weights/best.pt
│           └── face_mask_v2/weights/best.pt
│
└── frontend/              # Modern React.js (Vite) interface
    ├── src/
    │   ├── App.jsx        # Dashboard, camera feed, HUD, telemetry & face inspector
    │   ├── App.css        # Minimalist Black & White responsive styling
    │   └── main.jsx       # React application entry point
    ├── vite.config.js     # Dev server proxy configuration
    ├── package.json       # Node.js dependencies
    └── dist/              # Production web bundle served by FastAPI
```

---

## REST API Reference

The FastAPI backend exposes endpoints for external applications and mobile integrations:

| Method | Endpoint | Description | Payload / Parameters |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/status` | Returns model health, loaded checkpoint path, and detected classes. | *None* |
| `POST` | `/api/detect` | Single image file detection. | `file`: Multipart image (`image/*`), `confidence` (float), `iou` (float) |
| `POST` | `/api/detect-frame` | Real-time base64 frame inference for webcams. | JSON: `{"image": "data:image/jpeg;base64,...", "confidence": 0.35, "iou": 0.45}` |
| `GET` | `/api/sample-image` | Returns a synthetic test sample in base64. | *None* |
| `GET` | `/` | Serves the compiled React.js production application. | *None* |

### Sample Response (`POST /api/detect-frame`):
```json
{
  "detections": [
    {
      "box": [152, 118, 310, 325],
      "confidence": 0.942,
      "class_id": 1,
      "label": "mask",
      "display_name": "Mask On",
      "status": "COMPLIANT"
    }
  ],
  "summary": {
    "total_faces": 1,
    "mask_count": 1,
    "no_mask_count": 0,
    "compliance_rate": 100.0,
    "all_compliant": true
  },
  "inference_time_ms": 24.5,
  "annotated_image": "data:image/jpeg;base64,..."
}
```

---

## Quickstart Guide

### 1. Prerequisites
* **Python**: 3.10+ (Tested on Python 3.11 & 3.14)
* **Node.js**: 18+ (For frontend customization; compiled bundle is already provided)

### 2. Install Dependencies
```powershell
cd "d:\2. Skill Development\Deep Learning Projects\Face_Mask_Detection"
pip install -r requirements.txt
```

### 3. Launching the System

#### Method A: Launch the React Web Dashboard (Recommended)
Run the unified FastAPI server:
```powershell
python server.py
```
Open your browser and navigate to:
> **http://127.0.0.1:8000**

#### Method B: Run Frontend with Hot-Reloading (Vite Dev Server)
```powershell
# Terminal 1 - Backend:
python server.py

# Terminal 2 - Frontend:
cd frontend
npm install
npm run dev
```
Navigate to:
> **http://localhost:5173**

#### Method C: Standalone Desktop OpenCV Webcam
```powershell
python predict.py
```
* Press **`q`** to quit the webcam window.

#### Method D: Test & Verify Loaded Model Weights
```powershell
python test.py
```

---

## Troubleshooting & FAQ

**Q: `Unable to open webcam` error in browser?**
* Ensure your browser has granted camera permissions to `http://127.0.0.1:8000`. In Chrome: click the tune/lock icon next to the URL address bar and set **Camera** to **Allow**.

**Q: Why does the first inference take longer?**
* The first inference initializes PyTorch CPU kernels and compiles the computational graph (warm-up run). Subsequent frames run at steady-state speed (~20–30ms).

**Q: Can I use a GPU for acceleration?**
* Yes. If you have an NVIDIA GPU with CUDA installed, PyTorch will automatically utilize CUDA. You can force GPU inference in `predict.py` or `server.py` by specifying `device=0`.

---

## License

This project is open-source and intended for academic, research, and skill development purposes.
