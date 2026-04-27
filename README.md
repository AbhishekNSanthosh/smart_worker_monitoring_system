# Smart Worker Monitoring System

> AI-powered video surveillance dashboard for smart factories, construction sites, and workplace safety monitoring. Powered by **YOLOv8** detection and **ByteTrack** multi-person tracking.

![Python](https://img.shields.io/badge/python-3.10+-blue) ![Next.js](https://img.shields.io/badge/next.js-16-black) ![FastAPI](https://img.shields.io/badge/FastAPI-0.111-green) ![License](https://img.shields.io/badge/license-MIT-lightgrey)

---

## What is it?

Smart Worker Monitoring System lets you upload a video (or connect a live RTSP/CCTV stream) and get back a full analytics dashboard — per-worker presence time, zone occupancy, entry counts, a frame-by-frame timeline, and an annotated video with bounding boxes and tracked IDs.

It works in two modes:

- **AI mode** — uses YOLOv8 + ByteTrack for real detection and tracking (requires the AI libraries, GPU optional)
- **Simulation mode** — runs a realistic fake pipeline so you can develop and demo the full UI without any AI dependencies or GPU

---

## Features

- Upload MP4 / AVI / MOV / MKV for offline analysis
- Connect RTSP / HTTP / RTMP streams for live monitoring
- YOLOv8 person detection with configurable confidence threshold
- ByteTrack multi-person tracking with consistent IDs across frames
- Polygon zone analytics — occupancy duration, entry counts, peak counts
- Annotated video output with bounding boxes, IDs, and zone overlays
- Live processing progress page with stage logs and ETA
- Analytics dashboard — charts (Recharts), per-worker table, JSON export
- Automatic fallback to simulation if AI libraries are not installed

---

## Project Structure

```
new-proj/
├── ai_engine/
│   ├── detector.py         # YOLOv8 human detection
│   ├── tracker.py          # ByteTrack multi-person tracking
│   ├── zone_logic.py       # Polygon zone occupancy logic
│   ├── processor.py        # Full pipeline orchestrator
│   └── requirements.txt    # AI-specific dependencies
│
├── backend/
│   ├── main.py             # FastAPI app — all routes and job management
│   ├── requirements.txt    # Backend-only dependencies
│   └── yolov8n.pt          # YOLOv8 nano model weights
│
├── frontend/
│   ├── app/
│   │   ├── page.tsx                        # Home — upload + RTSP input
│   │   ├── processing/[jobId]/page.tsx     # Live progress view
│   │   └── dashboard/[jobId]/page.tsx      # Analytics dashboard
│   ├── lib/api.ts           # Typed API client
│   └── package.json
│
├── outputs/                 # Generated per-job outputs (auto-created)
├── uploads/                 # Uploaded video files (auto-created)
└── README.md
```

---

## Prerequisites

Make sure the following are installed before you begin:

| Requirement | Version | Notes |
|---|---|---|
| Python | 3.10 or higher | [python.org](https://www.python.org/downloads/) |
| Node.js | 18 or higher | [nodejs.org](https://nodejs.org/) |
| npm | comes with Node.js | |
| ffmpeg | any recent version | Optional — needed for H.264 video re-encoding |
| CUDA toolkit | 11.8 or higher | Optional — only for GPU acceleration |

---

## Installation

### 1. Clone the repository

```bash
git clone <your-repo-url>
cd new-proj
```

### 2. Set up the Python virtual environment

```bash
python -m venv .venv
```

Activate it:

- **Windows:**
  ```bash
  .venv\Scripts\activate
  ```
- **macOS / Linux:**
  ```bash
  source .venv/bin/activate
  ```

### 3. Install backend dependencies

```bash
pip install -r backend/requirements.txt
```

This installs FastAPI, Uvicorn, and the supporting libraries. The backend starts in **simulation mode** with just these dependencies.

### 4. (Optional) Install AI engine dependencies

To enable real YOLOv8 detection and ByteTrack tracking, install the AI dependencies:

```bash
pip install -r ai_engine/requirements.txt
```

**GPU acceleration (recommended for real-time streams):** Install PyTorch with CUDA before the above step:

```bash
# CUDA 11.8
pip install torch torchvision --index-url https://download.pytorch.org/whl/cu118

# CUDA 12.1
pip install torch torchvision --index-url https://download.pytorch.org/whl/cu121
```

### 5. Install frontend dependencies

```bash
cd frontend
npm install
cd ..
```

### 6. Configure environment variables

The frontend needs to know where the backend is running. Create the file `frontend/.env.local`:

```bash
NEXT_PUBLIC_API_URL=http://localhost:8000
```

This file already exists in the repo with the default value, so this step is only needed if you change the backend port or host.

---

## Running the App

You need two terminals running simultaneously — one for the backend and one for the frontend.

### Terminal 1 — Backend

```bash
# From the project root, with the virtual environment activated
cd backend
uvicorn main:app --reload --port 8000
```

The API will be available at `http://localhost:8000`.  
Interactive API docs: `http://localhost:8000/docs`

### Terminal 2 — Frontend

```bash
cd frontend
npm run dev
```

Open `http://localhost:3000` in your browser.

---

## How to Use

1. Open `http://localhost:3000`
2. Drag and drop a video file (MP4, AVI, MOV, MKV) onto the upload area, or paste an RTSP/stream URL
3. Click **Analyze** — you'll be taken to a live progress page showing stages, logs, and ETA
4. Once processing completes, the dashboard opens automatically with:
   - Worker count and presence time breakdown
   - Zone occupancy charts and entry counts
   - Frame-by-frame timeline graph
   - Annotated video playback
   - JSON export of all analytics

---

## API Reference

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/` | Health check |
| `POST` | `/analyze` | Upload a video file, returns `{ job_id }` |
| `POST` | `/analyze/rtsp` | Start RTSP stream monitoring, returns `{ job_id }` |
| `GET` | `/status/{job_id}` | Poll progress, stage, logs, and ETA |
| `GET` | `/result/{job_id}` | Get full analytics JSON for a completed job |
| `GET` | `/video/{job_id}` | Download annotated output video |
| `GET` | `/sessions` | List all past sessions |
| `DELETE` | `/job/{job_id}` | Delete a job and its outputs |

---

## Configuration

| Variable | Default | Where | Description |
|---|---|---|---|
| `NEXT_PUBLIC_API_URL` | `http://localhost:8000` | `frontend/.env.local` | Backend base URL |
| `model_name` | `yolov8n.pt` | `ai_engine/processor.py` | YOLO model variant (`n` / `s` / `m` / `l` / `x`) |
| `device` | `cpu` | `ai_engine/processor.py` | `cpu` or `cuda` |
| `confidence` | `0.35` | `ai_engine/detector.py` | Detection confidence threshold (0–1) |

---

## Simulation Mode

If the AI libraries (`ultralytics`, `opencv-python`, `supervision`) are **not installed**, the backend automatically runs a **realistic simulation** that:

- Runs through all 7 processing stages with realistic timing and logs
- Generates plausible per-worker and zone analytics
- Produces a complete `result.json` for the dashboard
- Shows live progress and ETA updates

This lets you develop and demo the full UI stack without any GPU or AI setup.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 16, React 19, TypeScript, Tailwind CSS v4 |
| UI Components | Radix UI, Lucide React |
| Charts | Recharts |
| Animations | Framer Motion |
| Backend | FastAPI 0.111, Uvicorn, Pydantic v2 |
| AI Detection | YOLOv8 (Ultralytics ≥ 8.2) |
| AI Tracking | ByteTrack (supervision ≥ 0.20) |
| Video I/O | OpenCV ≥ 4.9 |
| Video Re-encoding | ffmpeg (subprocess) |

---
