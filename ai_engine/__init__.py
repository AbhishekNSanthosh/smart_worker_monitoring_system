"""
ai_engine — Smart Worker Monitoring AI Package

Components:
  - detector:   YOLOv8-based human detection
  - tracker:    ByteTrack-based multi-person tracking
  - zone_logic: Polygon zone occupancy monitoring
  - processor:  Full pipeline orchestrator
"""
from .detector import HumanDetector, Detection, SafetyDetector, HelmetDetection
from .tracker import PersonTracker, TrackedPerson
from .zone_logic import ZoneMonitor, Zone, ZoneStats
from .processor import VideoProcessor

__all__ = [
    "HumanDetector", "Detection",
    "SafetyDetector", "HelmetDetection",
    "PersonTracker", "TrackedPerson",
    "ZoneMonitor", "Zone", "ZoneStats",
    "VideoProcessor",
]
