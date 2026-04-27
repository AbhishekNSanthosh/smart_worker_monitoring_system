import uuid
import asyncio
import os
import json
import subprocess
import time
from datetime import datetime
from pathlib import Path
from typing import Optional
import sys

# Add parent directory to path so ai_engine can be imported
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from fastapi import FastAPI, UploadFile, File, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

# ── App setup ──────────────────────────────────────────────────────────────────
app = FastAPI(
    title="Smart Worker Monitoring API",
    description="AI-powered worker monitoring backend using YOLOv8 + ByteTrack",
    version="1.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

_PROJECT_ROOT = Path(__file__).parent.parent
OUTPUTS_DIR = _PROJECT_ROOT / "outputs"
UPLOADS_DIR = _PROJECT_ROOT / "uploads"
OUTPUTS_DIR.mkdir(parents=True, exist_ok=True)
UPLOADS_DIR.mkdir(parents=True, exist_ok=True)

# In-memory job store
JOBS: dict[str, dict] = {}

# ── Models ────────────────────────────────────────────────────────────────────
class RtspRequest(BaseModel):
    rtsp_url: str

# ── Helpers ───────────────────────────────────────────────────────────────────
def job_dir(job_id: str) -> Path:
    d = OUTPUTS_DIR / job_id
    d.mkdir(parents=True, exist_ok=True)
    return d

def update_job(job_id: str, **kwargs):
    if job_id in JOBS:
        JOBS[job_id].update(kwargs)

def add_log(job_id: str, message: str):
    if job_id in JOBS:
        JOBS[job_id]["logs"].append(f"[{datetime.now().strftime('%H:%M:%S')}] {message}")

def save_sessions():
    """Persist sessions to disk for the /sessions endpoint."""
    sessions = []
    for jid, j in JOBS.items():
        sessions.append({
            "job_id": jid,
            "filename": j.get("filename", "unknown"),
            "created_at": j.get("created_at", ""),
            "status": j.get("status", "queued"),
        })
    with open(OUTPUTS_DIR / "sessions.json", "w") as f:
        json.dump(sessions, f)

# ── Background processor ──────────────────────────────────────────────────────
async def process_video(job_id: str, video_path: str):
    """
    Runs the AI pipeline. If ultralytics/cv2 is available, uses the real
    processor. Falls back to a realistic simulation for demo/testing.
    """
    add_log(job_id, "[INFO] Starting AI processing pipeline")
    update_job(job_id, status="processing")

    try:
        from ai_engine.processor import VideoProcessor
        processor = VideoProcessor(job_id, video_path, str(job_dir(job_id)))
        await processor.run(
            on_progress=lambda p, s, si: update_job(job_id, progress=p, stage=s, stage_index=si),
            on_log=lambda msg: add_log(job_id, msg),
            on_stats=lambda fp, tf, wd: update_job(job_id, frames_processed=fp, total_frames=tf, workers_detected=wd),
        )
        result_path = job_dir(job_id) / "result.json"
        if result_path.exists():
            with open(result_path) as f:
                result = json.load(f)
            update_job(job_id, status="completed", progress=100, result=result)
            add_log(job_id, "[SUCCESS] Processing complete. Dashboard ready.")
        else:
            raise RuntimeError("result.json not found after processing")

    except ImportError:
        add_log(job_id, "[WARNING] AI engine not installed — running simulation mode")
        await _simulate_processing(job_id, video_path)

    except Exception as e:
        add_log(job_id, f"[ERROR] {str(e)}")
        update_job(job_id, status="failed")

    save_sessions()

async def _simulate_processing(job_id: str, video_path: str):
    """Realistic simulation of AI processing stages for demo purposes."""
    stages = [
        ("Upload Received", 5),
        ("Extracting Frames", 15),
        ("Detecting Humans", 35),
        ("Tracking Individuals", 55),
        ("Calculating Analytics", 75),
        ("Rendering Output Video", 90),
        ("Preparing Dashboard", 100),
    ]
    total_frames = 900
    fps = 30

    for i, (stage_name, target_pct) in enumerate(stages):
        update_job(job_id, stage=stage_name, stage_index=i)
        add_log(job_id, f"[INFO] Stage {i+1}/7: {stage_name}")
        start_pct = stages[i - 1][1] if i > 0 else 0

        # Simulate sub-steps within each stage
        steps = 8
        for step in range(steps):
            pct = start_pct + int((target_pct - start_pct) * (step + 1) / steps)
            frames_done = int(total_frames * pct / 100)
            workers = max(0, min(6, int(3 + (step % 3) - 1)))

            update_job(job_id,
                progress=pct,
                frames_processed=frames_done,
                total_frames=total_frames,
                workers_detected=workers,
                eta_seconds=max(0, int((100 - pct) * 0.8)),
            )

            # Stage-specific logs
            if stage_name == "Extracting Frames" and step % 3 == 0:
                add_log(job_id, f"[INFO] Extracted {frames_done} frames at {fps}fps")
            elif stage_name == "Detecting Humans" and step % 2 == 0:
                add_log(job_id, f"[INFO] Processing frame {frames_done}/{total_frames} — {workers} detections")
            elif stage_name == "Tracking Individuals":
                add_log(job_id, f"[INFO] Tracking {workers} persons in frame {frames_done}")
            elif stage_name == "Calculating Analytics" and step == 4:
                add_log(job_id, "[INFO] Computing zone occupancy statistics")
            elif stage_name == "Rendering Output Video" and step == 3:
                add_log(job_id, "[INFO] Encoding annotated video with bounding boxes")

            await asyncio.sleep(0.35)

    # Build simulated result
    import random
    random.seed(42)
    persons = []
    for pid in range(1, 7):
        persons.append({
            "person_id": pid,
            "total_time_seconds": random.randint(40, 180),
            "zone_time_seconds": random.randint(20, 100),
            "first_seen_frame": random.randint(0, 50),
            "last_seen_frame": random.randint(700, 900),
            "first_seen_time": f"00:00:0{random.randint(1,9)}",
            "last_seen_time": f"00:0{random.randint(2,4)}:{random.randint(10,59):02d}",
            "zones_visited": random.sample(["Zone A", "Zone B", "Zone C"], k=random.randint(1, 3)),
        })

    zones = [
        {"zone_id": "zone_a", "zone_name": "Zone A – Assembly", "total_entries": 14,
         "total_duration_seconds": 320, "current_occupancy": 2, "peak_occupancy": 4},
        {"zone_id": "zone_b", "zone_name": "Zone B – Storage", "total_entries": 9,
         "total_duration_seconds": 180, "current_occupancy": 1, "peak_occupancy": 3},
        {"zone_id": "zone_c", "zone_name": "Zone C – Exit", "total_entries": 22,
         "total_duration_seconds": 95, "current_occupancy": 0, "peak_occupancy": 2},
    ]

    time_series = []
    for i in range(20):
        mins = (i * 15) // 60
        secs = (i * 15) % 60
        time_series.append({
            "time": f"{mins:02d}:{secs:02d}",
            "persons": random.randint(1, 6),
            "frame": i * 45,
        })

    result = {
        "job_id": job_id,
        "video_filename": os.path.basename(video_path),
        "total_frames": total_frames,
        "fps": fps,
        "duration_seconds": total_frames / fps,
        "processing_duration_seconds": 42,
        "total_unique_persons": 6,
        "avg_presence_time_seconds": sum(p["total_time_seconds"] for p in persons) / len(persons),
        "zone_occupancy_time_seconds": sum(z["total_duration_seconds"] for z in zones),
        "persons": persons,
        "zones": zones,
        "time_series": time_series,
        "completed_at": datetime.utcnow().isoformat(),
    }

    out_dir = job_dir(job_id)
    with open(out_dir / "result.json", "w") as f:
        json.dump(result, f, indent=2)

    update_job(job_id, status="completed", progress=100, stage="Preparing Dashboard", stage_index=6, result=result)
    add_log(job_id, "[SUCCESS] All stages complete — analytics ready!")

# ── Routes ────────────────────────────────────────────────────────────────────
@app.get("/", tags=["Health"])
async def root():
    return {"status": "ok", "service": "Smart Worker Monitoring API", "version": "1.1.0"}

@app.post("/analyze", tags=["Analysis"])
async def analyze_video(background_tasks: BackgroundTasks, file: UploadFile = File(...)):
    """Upload a video file and start AI analysis."""
    job_id = str(uuid.uuid4())
    filename = file.filename or "video.mp4"

    # Save upload
    upload_path = UPLOADS_DIR / f"{job_id}_{filename}"
    with open(upload_path, "wb") as f:
        content = await file.read()
        f.write(content)

    # Initialize job
    JOBS[job_id] = {
        "status": "queued",
        "progress": 0,
        "stage": "Upload Received",
        "stage_index": 0,
        "logs": [f"[{datetime.now().strftime('%H:%M:%S')}] [INFO] Job created: {job_id}"],
        "filename": filename,
        "frames_processed": 0,
        "total_frames": 0,
        "workers_detected": 0,
        "eta_seconds": 0,
        "created_at": datetime.utcnow().isoformat(),
        "result": None,
    }
    save_sessions()

    background_tasks.add_task(process_video, job_id, str(upload_path))
    return {"job_id": job_id, "status": "queued"}

@app.post("/analyze/rtsp", tags=["Analysis"])
async def analyze_rtsp(req: RtspRequest, background_tasks: BackgroundTasks):
    """Start live RTSP/stream monitoring."""
    job_id = str(uuid.uuid4())
    JOBS[job_id] = {
        "status": "queued",
        "progress": 0,
        "stage": "Connecting to Stream",
        "stage_index": 0,
        "logs": [f"[{datetime.now().strftime('%H:%M:%S')}] [INFO] RTSP job created: {req.rtsp_url}"],
        "filename": req.rtsp_url,
        "frames_processed": 0,
        "total_frames": 0,
        "workers_detected": 0,
        "eta_seconds": 0,
        "created_at": datetime.utcnow().isoformat(),
        "result": None,
    }
    save_sessions()
    background_tasks.add_task(process_video, job_id, req.rtsp_url)
    return {"job_id": job_id, "status": "queued"}

@app.get("/status/{job_id}", tags=["Status"])
async def get_status(job_id: str):
    """Poll processing status and logs."""
    if job_id not in JOBS:
        raise HTTPException(status_code=404, detail="Job not found")
    j = JOBS[job_id]
    return {
        "job_id": job_id,
        "status": j["status"],
        "progress": j["progress"],
        "stage": j["stage"],
        "stage_index": j["stage_index"],
        "logs": j["logs"],
        "frames_processed": j["frames_processed"],
        "total_frames": j["total_frames"],
        "workers_detected": j["workers_detected"],
        "eta_seconds": j["eta_seconds"],
    }

@app.get("/result/{job_id}", tags=["Results"])
async def get_result(job_id: str):
    """Return analytics JSON for completed job."""
    if job_id not in JOBS:
        raise HTTPException(status_code=404, detail="Job not found")
    j = JOBS[job_id]
    if j["status"] != "completed":
        raise HTTPException(status_code=202, detail="Processing not yet complete")
    if j.get("result"):
        return j["result"]
    result_file = job_dir(job_id) / "result.json"
    if result_file.exists():
        with open(result_file) as f:
            return json.load(f)
    raise HTTPException(status_code=404, detail="Result not found")

def _reencode_h264(src: Path, dest: Path) -> bool:
    """Try to re-encode src to H.264 at dest using ffmpeg. Returns True on success."""
    try:
        result = subprocess.run(
            ["ffmpeg", "-y", "-i", str(src),
             "-c:v", "libx264", "-preset", "fast", "-crf", "23",
             "-movflags", "+faststart", "-an", str(dest)],
            capture_output=True, timeout=300,
        )
        return result.returncode == 0 and dest.exists()
    except (FileNotFoundError, subprocess.TimeoutExpired):
        return False


@app.get("/video/{job_id}", tags=["Results"])
async def get_video(job_id: str):
    """Return annotated output video (H.264), falling back to the original upload in simulation mode."""
    annotated = job_dir(job_id) / "annotated_video.mp4"
    h264 = job_dir(job_id) / "annotated_video_h264.mp4"

    if annotated.exists():
        # Serve pre-converted H.264 copy if available; otherwise try to create it
        if not h264.exists():
            _reencode_h264(annotated, h264)
        serve = h264 if h264.exists() else annotated
        return FileResponse(str(serve), media_type="video/mp4",
                            headers={"Cache-Control": "no-store", "Accept-Ranges": "bytes"})

    # Fall back to the original uploaded file when running in simulation mode
    for upload_file in UPLOADS_DIR.glob(f"{job_id}_*"):
        if upload_file.is_file():
            return FileResponse(str(upload_file), media_type="video/mp4",
                                headers={"Cache-Control": "no-store", "Accept-Ranges": "bytes"})

    raise HTTPException(status_code=404, detail="Video not found. Run real AI engine to generate annotated output.")

@app.get("/sessions", tags=["Sessions"])
async def get_sessions():
    """Return list of all analysis sessions."""
    sessions_file = OUTPUTS_DIR / "sessions.json"
    if sessions_file.exists():
        with open(sessions_file) as f:
            return json.load(f)
    return []

@app.delete("/job/{job_id}", tags=["Sessions"])
async def delete_job(job_id: str):
    """Delete a job and its outputs."""
    if job_id in JOBS:
        del JOBS[job_id]
    out = job_dir(job_id)
    if out.exists():
        import shutil
        shutil.rmtree(out)
    save_sessions()
    return {"deleted": job_id}
