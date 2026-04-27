"""
zone_logic.py — Zone Definition and Occupancy Tracking

Supports polygon-based zone definitions. Tracks who is inside
each zone per-frame and computes occupancy statistics.
"""
from __future__ import annotations
import numpy as np
from dataclasses import dataclass, field
from typing import List, Dict, Tuple, Optional


@dataclass
class Zone:
    zone_id: str
    zone_name: str
    polygon: List[Tuple[float, float]]   # list of (x, y) vertices


@dataclass
class ZoneStats:
    zone_id: str
    zone_name: str
    total_entries: int = 0
    total_duration_frames: int = 0
    current_occupancy: int = 0
    peak_occupancy: int = 0
    _prev_occupants: set = field(default_factory=set)

    def update(self, current_ids: set, fps: float):
        """Update stats given the set of person IDs currently inside."""
        # Entries = new IDs that just entered
        new_entrants = current_ids - self._prev_occupants
        self.total_entries += len(new_entrants)
        # Duration
        self.total_duration_frames += len(current_ids)
        # Occupancy
        self.current_occupancy = len(current_ids)
        self.peak_occupancy = max(self.peak_occupancy, self.current_occupancy)
        self._prev_occupants = current_ids.copy()

    @property
    def total_duration_seconds(self) -> float:
        return 0.0  # computed externally with fps

    def to_dict(self, fps: float) -> dict:
        return {
            "zone_id": self.zone_id,
            "zone_name": self.zone_name,
            "total_entries": self.total_entries,
            "total_duration_seconds": round(self.total_duration_frames / max(fps, 1), 2),
            "current_occupancy": self.current_occupancy,
            "peak_occupancy": self.peak_occupancy,
        }


class ZoneMonitor:
    """
    Manages multiple zones and tracks occupancy per frame.
    """

    def __init__(self, zones: Optional[List[Zone]] = None):
        self.zones: List[Zone] = zones or self._default_zones()
        self.stats: Dict[str, ZoneStats] = {
            z.zone_id: ZoneStats(zone_id=z.zone_id, zone_name=z.zone_name)
            for z in self.zones
        }
        # Per-person zone accumulation (person_id -> {zone_id -> frames})
        self.person_zone_frames: Dict[int, Dict[str, int]] = {}

    def _default_zones(self) -> List[Zone]:
        """Default zones assuming a 1920x1080 frame."""
        return [
            Zone("zone_a", "Zone A - Assembly", [(100, 100), (700, 100), (700, 500), (100, 500)]),
            Zone("zone_b", "Zone B - Storage", [(750, 100), (1300, 100), (1300, 500), (750, 500)]),
            Zone("zone_c", "Zone C - Exit", [(100, 550), (1300, 550), (1300, 980), (100, 980)]),
        ]

    def add_zone(self, zone: Zone):
        self.zones.append(zone)
        self.stats[zone.zone_id] = ZoneStats(zone_id=zone.zone_id, zone_name=zone.zone_name)

    @staticmethod
    def point_in_polygon(px: float, py: float, polygon: List[Tuple[float, float]]) -> bool:
        """Ray-casting algorithm for point-in-polygon test."""
        n = len(polygon)
        inside = False
        xp, yp = px, py
        x1, y1 = polygon[0]
        for i in range(1, n + 1):
            x2, y2 = polygon[i % n]
            if ((y1 > yp) != (y2 > yp)) and (xp < (x2 - x1) * (yp - y1) / (y2 - y1) + x1):
                inside = not inside
            x1, y1 = x2, y2
        return inside

    def scale_polygon(self, polygon: List[Tuple[float, float]], frame_w: int, frame_h: int,
                      ref_w: int = 1920, ref_h: int = 1080) -> List[Tuple[float, float]]:
        """Scale polygon coordinates from reference resolution to actual frame size."""
        sx, sy = frame_w / ref_w, frame_h / ref_h
        return [(x * sx, y * sy) for x, y in polygon]

    def update(self, tracked_persons, frame_idx: int, fps: float,
               frame_w: int = 1920, frame_h: int = 1080):
        """
        Update zone occupancy for one frame.
        tracked_persons: list of TrackedPerson objects.
        """
        for zone in self.zones:
            scaled_poly = self.scale_polygon(zone.polygon, frame_w, frame_h)
            occupants = set()
            for person in tracked_persons:
                cx, cy = person.center
                if self.point_in_polygon(cx, cy, scaled_poly):
                    occupants.add(person.track_id)
                    # Accumulate zone time per person
                    if person.track_id not in self.person_zone_frames:
                        self.person_zone_frames[person.track_id] = {}
                    pz = self.person_zone_frames[person.track_id]
                    pz[zone.zone_id] = pz.get(zone.zone_id, 0) + 1

            self.stats[zone.zone_id].update(occupants, fps)

    def get_zone_results(self, fps: float) -> List[dict]:
        return [s.to_dict(fps) for s in self.stats.values()]

    def get_person_zone_time(self, person_id: int, fps: float) -> float:
        """Total seconds a person spent in any zone."""
        frames = self.person_zone_frames.get(person_id, {})
        return round(sum(frames.values()) / max(fps, 1), 2)

    def get_person_zones_visited(self, person_id: int) -> List[str]:
        """Names of zones a person visited."""
        pz = self.person_zone_frames.get(person_id, {})
        result = []
        for zone in self.zones:
            if zone.zone_id in pz and pz[zone.zone_id] > 0:
                result.append(zone.zone_name)
        return result

    def draw_zones(self, frame: np.ndarray) -> np.ndarray:
        """Overlay zone polygons on a frame (requires OpenCV)."""
        try:
            import cv2
            colors = [(37, 99, 235), (34, 197, 94), (245, 158, 11)]  # BGR
            h, w = frame.shape[:2]
            for i, zone in enumerate(self.zones):
                poly = self.scale_polygon(zone.polygon, w, h)
                pts = np.array(poly, dtype=np.int32)
                color = colors[i % len(colors)]
                overlay = frame.copy()
                cv2.fillPoly(overlay, [pts], color)
                cv2.addWeighted(overlay, 0.15, frame, 0.85, 0, frame)
                cv2.polylines(frame, [pts], isClosed=True, color=color, thickness=2)
                cx = int(sum(p[0] for p in poly) / len(poly))
                cy = int(sum(p[1] for p in poly) / len(poly))
                cv2.putText(frame, zone.zone_name, (cx - 60, cy),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 1, cv2.LINE_AA)
        except ImportError:
            pass
        return frame
