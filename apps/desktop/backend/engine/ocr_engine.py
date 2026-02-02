from typing import Any, Dict, List, Optional, Tuple, Union
import logging

try:
    from paddleocr import PaddleOCR
except ImportError:
    PaddleOCR = None

import numpy as np
from numpy.typing import NDArray

logger = logging.getLogger(__name__)


class OCREngine:
    """Engine for extracting text from images using PaddleOCR."""

    def __init__(self, use_gpu: bool = False, lang: str = 'en'):
        """
        Initialize PaddleOCR with specified settings.

        Args:
            use_gpu: Whether to use GPU acceleration (may not be supported in newer versions).
            lang: Language code ('ko' for Korean, 'en' for English).
        """
        self.ocr: Optional[Any] = None
        if PaddleOCR:
            try:
                # Try with use_gpu for older versions
                self.ocr = PaddleOCR(use_angle_cls=True, lang=lang, use_gpu=use_gpu)
            except (TypeError, ValueError):
                # Newer versions don't support use_gpu parameter
                try:
                    self.ocr = PaddleOCR(use_angle_cls=True, lang=lang)
                except Exception as e:
                    logger.warning(f"Failed to initialize PaddleOCR: {e}")
        else:
            logger.warning("PaddleOCR not installed. OCR functionality will be limited.")

    def extract_text(self, image: NDArray[np.uint8]) -> List[Dict[str, Any]]:
        """
        Extract all text from an image.

        Args:
            image: Input image as numpy array (BGR format).

        Returns:
            List of dictionaries containing 'text', 'confidence', and 'bbox' keys.
        """
        if not self.ocr:
            return []

        try:
            result = self.ocr.ocr(image)
        except Exception as e:
            logger.error(f"OCR Error: {e}")
            return []

        if not result or not result[0]:
            return []

        parsed_results: List[Dict[str, Any]] = []

        # Handle new dictionary-style structure (e.g. from newer PaddleX versions)
        if isinstance(result[0], dict):
            res_dict = result[0]
            texts = res_dict.get('rec_texts', [])
            scores = res_dict.get('rec_scores', [])
            # Prefer rec_boxes, fallback to rec_polys
            boxes = res_dict.get('rec_boxes', res_dict.get('rec_polys', []))

            for i in range(len(texts)):
                try:
                    box = boxes[i]
                    if hasattr(box, 'tolist'):
                        box = box.tolist()

                    parsed_results.append({
                        "text": str(texts[i]),
                        "confidence": float(scores[i]) if i < len(scores) else 0.0,
                        "bbox": box if i < len(boxes) else None
                    })
                except Exception:
                    continue
        else:
            # Handle classic list-of-lists structure
            for line in result[0]:
                try:
                    # line is typically [ [bbox], (text, confidence) ]
                    if len(line) >= 2 and isinstance(line[1], (list, tuple)):
                        text = line[1][0]
                        conf = float(line[1][1])
                    else:
                        # Fallback if structure is different
                        text = str(line[1]) if len(line) > 1 else ""
                        conf = 0.0

                    bbox = line[0]
                    if hasattr(bbox, 'tolist'):
                        bbox = bbox.tolist()

                    parsed_results.append({
                        "text": str(text),
                        "confidence": float(conf),
                        "bbox": bbox
                    })
                except (IndexError, TypeError, ValueError) as e:
                    logger.debug(f"Skipping malformed OCR line: {line}. Error: {e}")
                    continue

        return parsed_results

    def extract_from_region(
        self, image: NDArray[np.uint8], bbox: Tuple[int, int, int, int]
    ) -> List[Dict[str, Any]]:
        """
        Extract text from a specific region.

        Args:
            image: Input image as numpy array.
            bbox: Region of interest as (x, y, width, height).

        Returns:
            List of text extraction results from the region.
        """
        x, y, w, h = bbox
        roi = image[y:y+h, x:x+w]
        return self.extract_text(roi)

    def identify_structural_elements(
        self, image: NDArray[np.uint8]
    ) -> Dict[str, Any]:
        """
        Identify anchors like 'Name', 'Student ID', or 'Score' to help alignment.

        Args:
            image: Input image as numpy array.

        Returns:
            Dictionary mapping element keys to their bounding boxes.
        """
        full_text = self.extract_text(image)
        elements: Dict[str, Any] = {}

        keywords = {
            "이름": "name_box",
            "학번": "id_box",
            "점수": "score_box"
        }

        for item in full_text:
            for kw, key in keywords.items():
                if kw in item["text"]:
                    elements[key] = item["bbox"]

        return elements
