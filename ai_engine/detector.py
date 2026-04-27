"""
detector.py — YOLOv8 Human & Safety Equipment Detector

Uses Ultralytics YOLOv8 to detect persons and safety helmets in video frames.
"""
from __future__ import annotations
import numpy as np
from dataclasses import dataclass
from typing import List, Optional, Tuple


@dataclass
class Detection:
    bbox: Tuple[float, float, float, float]  # x1, y1, x2, y2
    confidence: float
    class_id: int = 0  # 0 = person in COCO


@dataclass
class HelmetDetection:
    bbox: Tuple[float, float, float, float]  # x1, y1, x2, y2
    confidence: float
    class_id: int = 0


class HumanDetector:
    """
    Wraps YOLOv8 for person-only detection.
    Model is loaded once and reused across frames.
    """

    PERSON_CLASS_ID = 0
    DEFAULT_CONF = 0.45
    DEFAULT_IOU = 0.50

    def __init__(
        self,
        model_name: str = "yolov8n.pt",
        confidence: float = DEFAULT_CONF,
        iou: float = DEFAULT_IOU,
        device: str = "cpu",
    ):
        self.model_name = model_name
        self.confidence = confidence
        self.iou = iou
        self.device = device
        self._model = None

    def load(self):
        """Load the YOLO model (call once before processing)."""
        try:
            from ultralytics import YOLO
            self._model = YOLO(self.model_name)
            self._model.to(self.device)
            print(f"[Detector] Loaded {self.model_name} on {self.device}")
        except ImportError:
            raise ImportError(
                "ultralytics is not installed. Run: pip install ultralytics"
            )

    def detect(self, frame: np.ndarray) -> List[Detection]:
        """
        Run inference on a single BGR frame (H, W, 3).
        Returns a list of Detection objects (persons only).
        """
        if self._model is None:
            raise RuntimeError("Model not loaded. Call .load() first.")

        results = self._model.predict(
            source=frame,
            conf=self.confidence,
            iou=self.iou,
            classes=[self.PERSON_CLASS_ID],
            verbose=False,
            device=self.device,
        )

        detections: List[Detection] = []
        for result in results:
            if result.boxes is None:
                continue
            for box in result.boxes:
                x1, y1, x2, y2 = box.xyxy[0].tolist()
                conf = float(box.conf[0])
                detections.append(
                    Detection(
                        bbox=(x1, y1, x2, y2),
                        confidence=conf,
                        class_id=int(box.cls[0]),
                    )
                )

        return detections

    def detect_batch(self, frames: List[np.ndarray]) -> List[List[Detection]]:
        """Batch inference for efficiency on GPU."""
        if self._model is None:
            raise RuntimeError("Model not loaded.")
        results_all = self._model.predict(
            source=frames,
            conf=self.confidence,
            iou=self.iou,
            classes=[self.PERSON_CLASS_ID],
            verbose=False,
            device=self.device,
        )
        batch_detections = []
        for result in results_all:
            dets = []
            if result.boxes:
                for box in result.boxes:
                    x1, y1, x2, y2 = box.xyxy[0].tolist()
                    conf = float(box.conf[0])
                    dets.append(Detection(bbox=(x1, y1, x2, y2), confidence=conf))
            batch_detections.append(dets)
        return batch_detections


class SafetyDetector:
    """
    Detects safety helmets / hard hats using a YOLO model.

    For best results supply a model trained on a PPE dataset (e.g. a custom
    YOLOv8 model where helmet is class 0).  When using the default COCO model
    there is no native helmet class, so detection will return no results —
    replace model_name with your custom checkpoint to activate.

    helmet_class_ids maps class indices in YOUR model to helmets.
    """

    DEFAULT_CONF = 0.40
    DEFAULT_IOU = 0.45

    def __init__(
        self,
        model_name: str = "helmet_yolov8n.pt",
        helmet_class_ids: Optional[List[int]] = None,
        confidence: float = DEFAULT_CONF,
        iou: float = DEFAULT_IOU,
        device: str = "cpu",
    ):
        self.model_name = model_name
        # Default: class 0 is "helmet" in most PPE datasets
        self.helmet_class_ids = helmet_class_ids if helmet_class_ids is not None else [0]
        self.confidence = confidence
        self.iou = iou
        self.device = device
        self._model = None
        self.available = False

    def load(self) -> bool:
        """
        Try to load the helmet model.  Returns True on success, False if the
        model file is missing — the pipeline continues without helmet detection.
        """
        try:
            from ultralytics import YOLO
            self._model = YOLO(self.model_name)
            self._model.to(self.device)
            self.available = True
            print(f"[SafetyDetector] Loaded {self.model_name} on {self.device}")
            return True
        except Exception as e:
            print(f"[SafetyDetector] Skipping helmet detection — model not found: {e}")
            return False

    def detect(self, frame: np.ndarray) -> List[HelmetDetection]:
        if not self.available or self._model is None:
            return []
        results = self._model.predict(
            source=frame,
            conf=self.confidence,
            iou=self.iou,
            classes=self.helmet_class_ids,
            verbose=False,
            device=self.device,
        )
        detections: List[HelmetDetection] = []
        for result in results:
            if result.boxes is None:
                continue
            for box in result.boxes:
                x1, y1, x2, y2 = box.xyxy[0].tolist()
                detections.append(
                    HelmetDetection(
                        bbox=(x1, y1, x2, y2),
                        confidence=float(box.conf[0]),
                        class_id=int(box.cls[0]),
                    )
                )
        return detections

    def detect_batch(self, frames: List[np.ndarray]) -> List[List[HelmetDetection]]:
        if not self.available or self._model is None:
            return [[] for _ in frames]
        results_all = self._model.predict(
            source=frames,
            conf=self.confidence,
            iou=self.iou,
            classes=self.helmet_class_ids,
            verbose=False,
            device=self.device,
        )
        batch: List[List[HelmetDetection]] = []
        for result in results_all:
            dets: List[HelmetDetection] = []
            if result.boxes:
                for box in result.boxes:
                    x1, y1, x2, y2 = box.xyxy[0].tolist()
                    dets.append(
                        HelmetDetection(
                            bbox=(x1, y1, x2, y2),
                            confidence=float(box.conf[0]),
                            class_id=int(box.cls[0]),
                        )
                    )
            batch.append(dets)
        return batch
