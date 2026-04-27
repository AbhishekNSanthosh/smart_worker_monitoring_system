"""
tracker.py — ByteTrack-based Multi-Person Tracker with Occlusion Handling

Uses the `supervision` library's ByteTrack implementation to assign
consistent IDs to detected persons across frames.

Occlusion handling:
  - Extended lost_track_buffer (90 frames) keeps tracks alive through longer
    occlusions before permanently discarding them.
  - Lowered track_activation_threshold (0.25) makes it easier to re-activate
    a track when a person re-emerges from behind an obstacle.
  - The registry stores the last known bbox so the caller can render a
    semi-transparent "ghost" box while a track is temporarily lost.
"""
from __future__ import annotations
import numpy as np
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Tuple
from .detector import Detection


@dataclass
class TrackedPerson:
    track_id: int
    bbox: Tuple[float, float, float, float]  # x1, y1, x2, y2
    confidence: float
    age: int = 1                               # frames since first seen
    last_seen_frame: int = 0
    trajectory: List[Tuple[float, float]] = field(default_factory=list)
    # None = helmet detection not run; True/False = result
    has_helmet: Optional[bool] = None
    # True when the box is a Kalman-predicted ghost (track is temporarily lost)
    is_occluded: bool = False

    @property
    def center(self) -> Tuple[float, float]:
        x1, y1, x2, y2 = self.bbox
        return ((x1 + x2) / 2, (y1 + y2) / 2)

    @property
    def width(self) -> float:
        return self.bbox[2] - self.bbox[0]

    @property
    def height(self) -> float:
        return self.bbox[3] - self.bbox[1]


class PersonTracker:
    """
    Wraps supervision ByteTracker for consistent person-ID assignment.

    Returns two lists per frame:
      active   — persons confirmed visible this frame
      occluded — persons whose track is still alive but whose bbox is the
                 last known position (rendered as ghost boxes)
    """

    def __init__(
        self,
        # Lowered from 0.35 → easier re-activation after occlusion
        track_thresh: float = 0.25,
        match_thresh: float = 0.7,
        frame_rate: int = 30,
        # Increased from 60 → tracks stay alive 3 s at 30 fps during occlusions
        track_buffer: int = 90,
        min_frames_to_count: int = 5,
    ):
        self.track_thresh = track_thresh
        self.match_thresh = match_thresh
        self.frame_rate = frame_rate
        self.track_buffer = track_buffer
        self.min_frames_to_count = min_frames_to_count
        self._tracker = None
        self._person_registry: Dict[int, dict] = {}

    def load(self):
        """Initialize the ByteTracker."""
        try:
            import supervision as sv
            self._tracker = sv.ByteTrack(
                track_activation_threshold=self.track_thresh,
                minimum_matching_threshold=self.match_thresh,
                frame_rate=self.frame_rate,
                lost_track_buffer=self.track_buffer,
            )
            print("[Tracker] ByteTracker initialized")
        except ImportError:
            raise ImportError(
                "supervision is not installed. Run: pip install supervision"
            )

    def update(
        self, detections: List[Detection], frame_idx: int
    ) -> Tuple[List[TrackedPerson], List[TrackedPerson]]:
        """
        Feed new detections into the tracker.

        Returns:
          active   — persons confirmed visible this frame (solid boxes)
          occluded — persons likely behind an obstacle (ghost boxes at last
                     known position, rendered semi-transparently)
        """
        if self._tracker is None:
            raise RuntimeError("Tracker not loaded. Call .load() first.")

        import supervision as sv

        if not detections:
            sv_dets = sv.Detections.empty()
        else:
            bboxes = np.array([d.bbox for d in detections], dtype=np.float32)
            confs = np.array([d.confidence for d in detections], dtype=np.float32)
            class_ids = np.array([d.class_id for d in detections], dtype=int)
            sv_dets = sv.Detections(
                xyxy=bboxes,
                confidence=confs,
                class_id=class_ids,
            )

        tracked = self._tracker.update_with_detections(sv_dets)

        active_ids: set = set()
        active: List[TrackedPerson] = []

        for i in range(len(tracked)):
            tid = int(tracked.tracker_id[i])
            bbox = tuple(tracked.xyxy[i].tolist())
            conf = float(tracked.confidence[i]) if tracked.confidence is not None else 1.0

            if tid not in self._person_registry:
                self._person_registry[tid] = {
                    "first_frame": frame_idx,
                    "total_frames": 0,
                }
            reg = self._person_registry[tid]
            reg["total_frames"] += 1
            reg["last_frame"] = frame_idx
            reg["last_bbox"] = bbox
            reg["last_confidence"] = conf

            cx = (bbox[0] + bbox[2]) / 2
            cy = (bbox[1] + bbox[3]) / 2

            p = TrackedPerson(
                track_id=tid,
                bbox=bbox,
                confidence=conf,
                age=reg["total_frames"],
                last_seen_frame=frame_idx,
                is_occluded=False,
            )
            p.trajectory.append((cx, cy))
            active.append(p)
            active_ids.add(tid)

        # Build ghost list: registered tracks NOT seen this frame but still
        # within half the buffer window (likely temporarily occluded).
        ghost_window = max(self.track_buffer // 2, 15)
        occluded: List[TrackedPerson] = []
        for tid, reg in self._person_registry.items():
            if tid in active_ids:
                continue
            frames_since_seen = frame_idx - reg.get("last_frame", 0)
            if frames_since_seen < 1 or frames_since_seen > ghost_window:
                continue
            last_bbox = reg.get("last_bbox")
            if last_bbox is None:
                continue
            ghost = TrackedPerson(
                track_id=tid,
                bbox=last_bbox,
                # Fade confidence proportionally to time out-of-sight
                confidence=reg.get("last_confidence", 0.5) * (
                    1.0 - frames_since_seen / ghost_window
                ),
                age=reg["total_frames"],
                last_seen_frame=reg.get("last_frame", 0),
                is_occluded=True,
            )
            occluded.append(ghost)

        return active, occluded

    def get_person_summary(self, fps: float) -> List[dict]:
        """Return per-person timing summary, excluding short-lived ghost tracks."""
        summary = []
        for tid, info in self._person_registry.items():
            frames = info["total_frames"]
            if frames < self.min_frames_to_count:
                continue
            summary.append({
                "person_id": tid,
                "first_seen_frame": info["first_frame"],
                "last_seen_frame": info.get("last_frame", info["first_frame"]),
                "total_frames": frames,
                "total_time_seconds": round(frames / fps, 2),
            })
        return sorted(summary, key=lambda x: x["person_id"])
