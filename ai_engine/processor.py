"""
processor.py — Main AI Pipeline Orchestrator

Ties together Detector → SafetyDetector → Tracker → ZoneMonitor → Annotator
and produces: annotated_video.mp4 + result.json
"""
from __future__ import annotations

import cv2
import json
import os
import subprocess
import time
import asyncio
import numpy as np
from datetime import datetime
from pathlib import Path
from typing import Callable, List, Optional, Tuple

from .detector import HumanDetector, HelmetDetection, SafetyDetector
from .tracker import PersonTracker, TrackedPerson
from .zone_logic import ZoneMonitor


# Color palette for bounding boxes (BGR)
PERSON_COLORS = [
    (37, 99, 235), (34, 197, 94), (245, 158, 11),
    (239, 68, 68), (139, 92, 246), (6, 182, 212),
    (236, 72, 153), (16, 185, 129),
]

_HELMET_OK_COLOR = (34, 197, 94)    # green
_HELMET_MISS_COLOR = (0, 60, 220)   # red (BGR)


# ── Helpers ───────────────────────────────────────────────────────────────────

def _iou(a: Tuple, b: Tuple) -> float:
    """Compute IoU between two (x1,y1,x2,y2) boxes."""
    ax1, ay1, ax2, ay2 = a
    bx1, by1, bx2, by2 = b
    ix1, iy1 = max(ax1, bx1), max(ay1, by1)
    ix2, iy2 = min(ax2, bx2), min(ay2, by2)
    inter = max(0.0, ix2 - ix1) * max(0.0, iy2 - iy1)
    if inter == 0:
        return 0.0
    area_a = (ax2 - ax1) * (ay2 - ay1)
    area_b = (bx2 - bx1) * (by2 - by1)
    return inter / (area_a + area_b - inter)


def _assign_helmets(
    persons: List[TrackedPerson],
    helmet_dets: List[HelmetDetection],
) -> None:
    """
    Match helmet detections to tracked persons via head-region IoU.
    Sets person.has_helmet = True/False in-place (None = not attempted).
    Head region = top 35 % of the person bounding box.
    """
    for person in persons:
        x1, y1, x2, y2 = person.bbox
        head_bbox = (x1, y1, x2, y1 + (y2 - y1) * 0.35)
        person.has_helmet = False
        for hdet in helmet_dets:
            if _iou(head_bbox, hdet.bbox) > 0.25:
                person.has_helmet = True
                break


def _draw_dashed_rect(
    frame: np.ndarray,
    pt1: Tuple[int, int],
    pt2: Tuple[int, int],
    color: Tuple[int, int, int],
    thickness: int = 1,
    dash: int = 8,
) -> None:
    """Draw a dashed rectangle (used for occluded / ghost tracks)."""
    x1, y1 = pt1
    x2, y2 = pt2
    # Top & bottom edges
    for edge_y in (y1, y2):
        x = x1
        draw = True
        while x < x2:
            xn = min(x + dash, x2)
            if draw:
                cv2.line(frame, (x, edge_y), (xn, edge_y), color, thickness)
            x = xn
            draw = not draw
    # Left & right edges
    for edge_x in (x1, x2):
        y = y1
        draw = True
        while y < y2:
            yn = min(y + dash, y2)
            if draw:
                cv2.line(frame, (edge_x, y), (edge_x, yn), color, thickness)
            y = yn
            draw = not draw


def _draw_person(
    frame: np.ndarray,
    bbox: tuple,
    track_id: int,
    confidence: float,
    has_helmet: Optional[bool] = None,
    is_occluded: bool = False,
) -> np.ndarray:
    """Draw bounding box + label for a single person."""
    x1, y1, x2, y2 = [int(v) for v in bbox]
    color = PERSON_COLORS[track_id % len(PERSON_COLORS)]

    if is_occluded:
        # Ghost box: dashed outline, blended onto frame
        overlay = frame.copy()
        _draw_dashed_rect(overlay, (x1, y1), (x2, y2), color, thickness=2)
        cv2.addWeighted(overlay, 0.5, frame, 0.5, 0, frame)
        label = f"#{track_id} [occluded]"
        cv2.putText(
            frame, label, (x1 + 3, y1 - 5),
            cv2.FONT_HERSHEY_SIMPLEX, 0.4, color, 1, cv2.LINE_AA,
        )
        return frame

    # Solid box
    cv2.rectangle(frame, (x1, y1), (x2, y2), color, 2)

    # Helmet status badge (small coloured square top-right of box)
    if has_helmet is not None:
        badge_color = _HELMET_OK_COLOR if has_helmet else _HELMET_MISS_COLOR
        cv2.rectangle(frame, (x2 - 14, y1 + 2), (x2 - 2, y1 + 14), badge_color, -1)
        badge_char = "H" if has_helmet else "!"
        cv2.putText(
            frame, badge_char,
            (x2 - 12, y1 + 13),
            cv2.FONT_HERSHEY_SIMPLEX, 0.35, (255, 255, 255), 1, cv2.LINE_AA,
        )

    # Label
    helmet_tag = ""
    if has_helmet is True:
        helmet_tag = " |Helmet"
    elif has_helmet is False:
        helmet_tag = " |NoHelmet"
    label = f"Worker #{track_id}  {confidence:.0%}{helmet_tag}"
    (lw, lh), baseline = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.5, 1)
    cv2.rectangle(frame, (x1, y1 - lh - baseline - 4), (x1 + lw + 6, y1), color, -1)
    cv2.putText(
        frame, label,
        (x1 + 3, y1 - baseline - 2),
        cv2.FONT_HERSHEY_SIMPLEX, 0.5,
        (255, 255, 255), 1, cv2.LINE_AA,
    )
    return frame


def _draw_hud(
    frame: np.ndarray,
    frame_idx: int,
    total_frames: int,
    fps: float,
    n_workers: int,
    helmet_pct: Optional[float] = None,
) -> np.ndarray:
    """Draw HUD overlay (frame counter, worker count, helmet compliance)."""
    h, w = frame.shape[:2]
    overlay = frame.copy()
    cv2.rectangle(overlay, (0, 0), (w, 40), (15, 23, 42), -1)
    cv2.addWeighted(overlay, 0.85, frame, 0.15, 0, frame)

    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    cv2.putText(frame, f"Smart Worker Monitor | {timestamp}", (10, 26),
                cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 1, cv2.LINE_AA)

    helmet_str = f" | Helmet: {helmet_pct:.0f}%" if helmet_pct is not None else ""
    info = f"Frame {frame_idx}/{total_frames} @ {fps:.0f}fps | Workers: {n_workers}{helmet_str}"
    (tw, _), _ = cv2.getTextSize(info, cv2.FONT_HERSHEY_SIMPLEX, 0.5, 1)
    cv2.putText(frame, info, (w - tw - 10, 26),
                cv2.FONT_HERSHEY_SIMPLEX, 0.5, (148, 163, 184), 1, cv2.LINE_AA)
    return frame


def _reencode_h264(src_path: str, on_log: Callable[[str], None]) -> str:
    """Re-encode src_path to H.264 in-place using ffmpeg. Returns final path."""
    tmp_path = src_path + ".tmp.mp4"
    try:
        result = subprocess.run(
            ["ffmpeg", "-y", "-i", src_path,
             "-c:v", "libx264", "-preset", "fast", "-crf", "23",
             "-movflags", "+faststart",
             "-an", tmp_path],
            capture_output=True, text=True, timeout=300,
        )
        if result.returncode == 0:
            os.replace(tmp_path, src_path)
            on_log("[INFO] Re-encoded video to H.264 for browser playback")
        else:
            on_log(f"[WARNING] ffmpeg re-encode failed (exit {result.returncode}); video may not play in browser")
            if os.path.exists(tmp_path):
                os.remove(tmp_path)
    except FileNotFoundError:
        on_log("[WARNING] ffmpeg not found; video saved as mp4v — install ffmpeg for browser playback")
    except Exception as e:
        on_log(f"[WARNING] Re-encode error: {e}")
        if os.path.exists(tmp_path):
            os.remove(tmp_path)
    return src_path


class VideoProcessor:
    """
    Full AI processing pipeline for a single video file.

    Usage:
        processor = VideoProcessor(job_id, video_path, output_dir)
        await processor.run(on_progress, on_log, on_stats)
    """

    BATCH_SIZE = 4  # frames to batch-infer at once

    def __init__(
        self,
        job_id: str,
        video_path: str,
        output_dir: str,
        model_name: str = "yolov8s.pt",
        helmet_model_name: str = "helmet_yolov8n.pt",
        device: str = "cpu",
    ):
        self.job_id = job_id
        self.video_path = video_path
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)

        self.detector = HumanDetector(model_name=model_name, device=device)
        self.safety_detector = SafetyDetector(model_name=helmet_model_name, device=device)
        self.tracker = PersonTracker()
        self.zone_monitor = ZoneMonitor()

    async def run(
        self,
        on_progress: Callable[[int, str, int], None],
        on_log: Callable[[str], None],
        on_stats: Callable[[int, int, int], None],
    ):
        start_time = time.time()

        # ── Stage 0: Upload Received ─────────────────────────────────────────
        on_progress(2, "Upload Received", 0)
        on_log("[INFO] Video file received and validated")
        await asyncio.sleep(0.1)

        # ── Stage 1: Load Models ──────────────────────────────────────────────
        on_progress(5, "Extracting Frames", 1)
        on_log("[INFO] Loading YOLOv8 detection model…")
        self.detector.load()
        on_log(f"[INFO] Loaded {self.detector.model_name}")
        self.tracker.load()
        on_log("[INFO] ByteTracker initialized")

        helmet_enabled = self.safety_detector.load()
        if helmet_enabled:
            on_log(f"[INFO] Helmet detection enabled ({self.safety_detector.model_name})")
        else:
            on_log("[INFO] Helmet detection skipped — no custom model found")

        # ── Stage 2: Open video ───────────────────────────────────────────────
        cap = cv2.VideoCapture(self.video_path)
        if not cap.isOpened():
            raise RuntimeError(f"Cannot open video: {self.video_path}")

        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
        frame_w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        frame_h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))

        on_log(f"[INFO] Video: {total_frames} frames @ {fps:.1f}fps  {frame_w}x{frame_h}")
        on_stats(0, total_frames, 0)

        # ── Stage 3: Output writer ────────────────────────────────────────────
        out_path = str(self.output_dir / "annotated_video.mp4")
        fourcc = cv2.VideoWriter_fourcc(*"avc1")
        writer = cv2.VideoWriter(out_path, fourcc, fps, (frame_w, frame_h))
        if not writer.isOpened():
            on_log("[WARNING] avc1 codec unavailable, falling back to mp4v (ffmpeg re-encode will run after)")
            fourcc = cv2.VideoWriter_fourcc(*"mp4v")
            writer = cv2.VideoWriter(out_path, fourcc, fps, (frame_w, frame_h))

        # ── Stage 4: Frame loop ───────────────────────────────────────────────
        time_series: list[dict] = []
        frame_idx = 0
        batch: list[np.ndarray] = []
        batch_indices: list[int] = []

        # Helmet compliance accumulators
        helmet_frames_checked = 0
        helmet_frames_compliant = 0

        on_progress(15, "Detecting Humans", 2)
        on_log("[INFO] Starting detection and tracking loop…")

        while True:
            ret, frame = cap.read()
            if not ret:
                break

            batch.append(frame)
            batch_indices.append(frame_idx)
            frame_idx += 1

            if len(batch) >= self.BATCH_SIZE or frame_idx == total_frames:
                detections_batch = self.detector.detect_batch(batch)
                helmet_batch = self.safety_detector.detect_batch(batch)

                for b_idx, (b_frame, b_dets, b_helmets, b_fidx) in enumerate(
                    zip(batch, detections_batch, helmet_batch, batch_indices)
                ):
                    on_progress(
                        min(15 + int(55 * b_fidx / max(total_frames, 1)), 70),
                        "Tracking Individuals" if b_fidx > total_frames * 0.3 else "Detecting Humans",
                        3 if b_fidx > total_frames * 0.3 else 2,
                    )

                    active, occluded = self.tracker.update(b_dets, b_fidx)
                    self.zone_monitor.update(active, b_fidx, fps, frame_w, frame_h)

                    # Assign helmet status to active persons
                    if helmet_enabled and b_helmets is not None:
                        _assign_helmets(active, b_helmets)
                        if active:
                            helmet_frames_checked += 1
                            if all(p.has_helmet for p in active):
                                helmet_frames_compliant += 1

                    n_workers = len(active)
                    on_stats(b_fidx, total_frames, n_workers)

                    # Time series (every 30 frames)
                    if b_fidx % 30 == 0:
                        t_sec = b_fidx / fps
                        mm = int(t_sec // 60)
                        ss = int(t_sec % 60)
                        n_helmets = sum(1 for p in active if p.has_helmet)
                        time_series.append({
                            "time": f"{mm:02d}:{ss:02d}",
                            "persons": n_workers,
                            "helmets": n_helmets,
                            "frame": b_fidx,
                        })

                    on_log(f"[INFO] Frame {b_fidx}/{total_frames} — {n_workers} worker(s), {len(occluded)} occluded")

                    # Annotate frame
                    annotated = b_frame.copy()
                    annotated = self.zone_monitor.draw_zones(annotated)

                    # Draw ghost boxes first (behind active tracks)
                    for ghost in occluded:
                        annotated = _draw_person(
                            annotated, ghost.bbox, ghost.track_id, ghost.confidence,
                            has_helmet=None, is_occluded=True,
                        )

                    # Draw active persons
                    for person in active:
                        annotated = _draw_person(
                            annotated, person.bbox, person.track_id, person.confidence,
                            has_helmet=person.has_helmet, is_occluded=False,
                        )

                    # HUD: show live helmet compliance %
                    hpct: Optional[float] = None
                    if helmet_enabled and helmet_frames_checked > 0:
                        hpct = 100.0 * helmet_frames_compliant / helmet_frames_checked
                    annotated = _draw_hud(annotated, b_fidx, total_frames, fps, n_workers, hpct)
                    writer.write(annotated)

                batch.clear()
                batch_indices.clear()
                await asyncio.sleep(0)  # yield to event loop

        cap.release()
        writer.release()
        on_log("[INFO] Frame processing complete")

        out_path = _reencode_h264(out_path, on_log)
        on_log(f"[INFO] Annotated video saved → {out_path}")

        # ── Stage 5: Analytics ────────────────────────────────────────────────
        on_progress(80, "Calculating Analytics", 4)
        on_log("[INFO] Aggregating per-person analytics…")
        await asyncio.sleep(0.1)

        person_summaries = self.tracker.get_person_summary(fps)
        zone_results = self.zone_monitor.get_zone_results(fps)

        for ps in person_summaries:
            pid = ps["person_id"]
            ps["zone_time_seconds"] = self.zone_monitor.get_person_zone_time(pid, fps)
            ps["zones_visited"] = self.zone_monitor.get_person_zones_visited(pid)
            ps["first_seen_time"] = _frame_to_timecode(ps["first_seen_frame"], fps)
            ps["last_seen_time"] = _frame_to_timecode(ps["last_seen_frame"], fps)

        total_unique = len(person_summaries)
        avg_presence = (
            sum(p["total_time_seconds"] for p in person_summaries) / total_unique
            if total_unique else 0
        )
        zone_occ_total = sum(z["total_duration_seconds"] for z in zone_results)
        processing_duration = round(time.time() - start_time, 2)

        on_log(f"[INFO] {total_unique} unique persons detected")
        on_log(f"[INFO] Average presence time: {avg_presence:.1f}s")

        # Helmet compliance summary
        helmet_compliance_pct = (
            round(100.0 * helmet_frames_compliant / helmet_frames_checked, 1)
            if helmet_frames_checked > 0 else None
        )
        if helmet_enabled and helmet_compliance_pct is not None:
            on_log(f"[INFO] Helmet compliance: {helmet_compliance_pct}%")

        # ── Stage 6: Render complete ──────────────────────────────────────────
        on_progress(90, "Rendering Output Video", 5)
        await asyncio.sleep(0.2)

        # ── Stage 7: Save result ──────────────────────────────────────────────
        on_progress(97, "Preparing Dashboard", 6)
        on_log("[INFO] Saving analytics JSON…")

        result = {
            "job_id": self.job_id,
            "video_filename": Path(self.video_path).name,
            "total_frames": total_frames,
            "fps": round(fps, 2),
            "duration_seconds": round(total_frames / fps, 2),
            "processing_duration_seconds": processing_duration,
            "total_unique_persons": total_unique,
            "avg_presence_time_seconds": round(avg_presence, 2),
            "zone_occupancy_time_seconds": round(zone_occ_total, 2),
            "helmet_detection_enabled": helmet_enabled,
            "helmet_compliance_pct": helmet_compliance_pct,
            "persons": person_summaries,
            "zones": zone_results,
            "time_series": time_series,
            "completed_at": datetime.utcnow().isoformat(),
        }

        result_path = self.output_dir / "result.json"
        with open(result_path, "w") as f:
            json.dump(result, f, indent=2)

        on_log(f"[SUCCESS] result.json saved → {result_path}")
        on_progress(100, "Preparing Dashboard", 6)


def _frame_to_timecode(frame: int, fps: float) -> str:
    total_sec = frame / max(fps, 1)
    mm = int(total_sec // 60)
    ss = int(total_sec % 60)
    return f"{mm:02d}:{ss:02d}"
