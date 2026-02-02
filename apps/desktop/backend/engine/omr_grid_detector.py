"""
OMR Grid Detector Module

Detects and separates multiple OMR cards from a single scanned image
with grid layout (multiple cards arranged in rows and columns).
"""

import logging
from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Tuple

import cv2
import numpy as np
from numpy.typing import NDArray

from .document_processor import DocumentProcessor
from .bubble_detector import BubbleDetector
from .ocr_engine import OCREngine

logger = logging.getLogger(__name__)


@dataclass
class GridDetectorConfig:
    """Configuration for grid-based OMR detection."""

    # Minimum area ratio for a valid OMR card (relative to image)
    min_card_area_ratio: float = 0.02

    # Maximum area ratio for a valid OMR card
    max_card_area_ratio: float = 0.5

    # Aspect ratio range for OMR cards (width/height)
    min_aspect_ratio: float = 0.4
    max_aspect_ratio: float = 2.5

    # Padding around detected cards (pixels)
    card_padding: int = 10

    # Minimum contour area to consider
    min_contour_area: int = 10000

    # Canny edge detection thresholds
    canny_low: int = 30
    canny_high: int = 150

    # Morphological kernel size
    morph_kernel_size: Tuple[int, int] = (5, 5)

    # Grid sorting tolerance (percentage of card height)
    row_tolerance: float = 0.3


@dataclass
class OMRCardResult:
    """Result for a single OMR card."""

    card_index: int
    image: NDArray[np.uint8]
    bbox: Tuple[int, int, int, int]  # x, y, w, h
    student_name: str
    answers: Dict[int, List[int]]  # question -> selected answers
    confidence_scores: Dict[int, List[float]]


class OMRGridDetector:
    """Detects and processes multiple OMR cards from grid layout images."""

    def __init__(
        self,
        config: Optional[GridDetectorConfig] = None,
        bubble_detector: Optional[BubbleDetector] = None,
        ocr_engine: Optional[OCREngine] = None
    ):
        """
        Initialize the grid detector.

        Args:
            config: Configuration object.
            bubble_detector: Bubble detector instance.
            ocr_engine: OCR engine instance.
        """
        self.config = config or GridDetectorConfig()
        self.bubble_detector = bubble_detector or BubbleDetector()
        self._ocr_engine = ocr_engine
        self.doc_processor = DocumentProcessor()

    @property
    def ocr_engine(self) -> OCREngine:
        """Lazy-loaded OCR engine."""
        if self._ocr_engine is None:
            self._ocr_engine = OCREngine()
        return self._ocr_engine

    def detect_cards(self, image: NDArray[np.uint8]) -> List[NDArray[np.uint8]]:
        """
        Detect and extract individual OMR cards from a grid image.

        Args:
            image: Input image containing multiple OMR cards.

        Returns:
            List of individual card images sorted in grid order.
        """
        # Get card bounding boxes
        bboxes = self._detect_card_regions(image)

        if not bboxes:
            logger.warning("No OMR cards detected in image")
            return []

        # Sort boxes in grid order (top-to-bottom, left-to-right)
        sorted_bboxes = self._sort_grid_order(bboxes)

        # Extract card images
        cards = []
        for x, y, w, h in sorted_bboxes:
            # Add padding
            pad = self.config.card_padding
            x1 = max(0, x - pad)
            y1 = max(0, y - pad)
            x2 = min(image.shape[1], x + w + pad)
            y2 = min(image.shape[0], y + h + pad)

            card_img = image[y1:y2, x1:x2].copy()
            cards.append(card_img)

        logger.info(f"Detected {len(cards)} OMR cards in grid")
        return cards

    def _detect_card_regions(
        self, image: NDArray[np.uint8]
    ) -> List[Tuple[int, int, int, int]]:
        """
        Detect rectangular regions that could be OMR cards.

        Args:
            image: Input image.

        Returns:
            List of bounding boxes (x, y, w, h).
        """
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        img_area = image.shape[0] * image.shape[1]

        # Apply adaptive thresholding
        blurred = cv2.GaussianBlur(gray, (5, 5), 0)

        # Edge detection
        edges = cv2.Canny(
            blurred,
            self.config.canny_low,
            self.config.canny_high
        )

        # Morphological closing to connect edges
        kernel = cv2.getStructuringElement(
            cv2.MORPH_RECT,
            self.config.morph_kernel_size
        )
        closed = cv2.morphologyEx(edges, cv2.MORPH_CLOSE, kernel, iterations=2)

        # Dilate to merge nearby edges
        dilated = cv2.dilate(closed, kernel, iterations=2)

        # Find contours
        contours, _ = cv2.findContours(
            dilated, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE
        )

        bboxes = []
        for contour in contours:
            area = cv2.contourArea(contour)

            # Filter by area
            if area < self.config.min_contour_area:
                continue

            area_ratio = area / img_area
            if not (self.config.min_card_area_ratio <= area_ratio <= self.config.max_card_area_ratio):
                continue

            # Get bounding rectangle
            x, y, w, h = cv2.boundingRect(contour)

            # Filter by aspect ratio
            aspect_ratio = w / h if h > 0 else 0
            if not (self.config.min_aspect_ratio <= aspect_ratio <= self.config.max_aspect_ratio):
                continue

            # Try to find a more precise rectangle using approxPolyDP
            peri = cv2.arcLength(contour, True)
            approx = cv2.approxPolyDP(contour, 0.02 * peri, True)

            # If we get a quadrilateral, use it
            if len(approx) == 4:
                x, y, w, h = cv2.boundingRect(approx)

            bboxes.append((x, y, w, h))

        # Remove overlapping boxes (keep larger ones)
        bboxes = self._remove_overlapping(bboxes)

        return bboxes

    def _remove_overlapping(
        self, bboxes: List[Tuple[int, int, int, int]]
    ) -> List[Tuple[int, int, int, int]]:
        """Remove overlapping bounding boxes, keeping larger ones."""
        if not bboxes:
            return []

        # Sort by area (largest first)
        sorted_boxes = sorted(bboxes, key=lambda b: b[2] * b[3], reverse=True)
        result = []

        for box in sorted_boxes:
            x1, y1, w1, h1 = box
            is_overlapping = False

            for existing in result:
                x2, y2, w2, h2 = existing

                # Calculate intersection
                ix1 = max(x1, x2)
                iy1 = max(y1, y2)
                ix2 = min(x1 + w1, x2 + w2)
                iy2 = min(y1 + h1, y2 + h2)

                if ix1 < ix2 and iy1 < iy2:
                    intersection = (ix2 - ix1) * (iy2 - iy1)
                    smaller_area = min(w1 * h1, w2 * h2)

                    # If significant overlap (>50% of smaller box)
                    if intersection > 0.5 * smaller_area:
                        is_overlapping = True
                        break

            if not is_overlapping:
                result.append(box)

        return result

    def _sort_grid_order(
        self, bboxes: List[Tuple[int, int, int, int]]
    ) -> List[Tuple[int, int, int, int]]:
        """
        Sort bounding boxes in grid reading order.

        Args:
            bboxes: List of bounding boxes.

        Returns:
            Sorted list (top-to-bottom, left-to-right within rows).
        """
        if not bboxes:
            return []

        # Calculate average card height for row tolerance
        avg_height = sum(b[3] for b in bboxes) / len(bboxes)
        row_threshold = avg_height * self.config.row_tolerance

        # Sort by Y first
        y_sorted = sorted(bboxes, key=lambda b: b[1])

        # Group into rows
        rows: List[List[Tuple[int, int, int, int]]] = []
        current_row: List[Tuple[int, int, int, int]] = [y_sorted[0]]
        current_y = y_sorted[0][1]

        for box in y_sorted[1:]:
            if abs(box[1] - current_y) < row_threshold:
                current_row.append(box)
            else:
                rows.append(current_row)
                current_row = [box]
                current_y = box[1]

        rows.append(current_row)

        # Sort each row by X
        result = []
        for row in rows:
            sorted_row = sorted(row, key=lambda b: b[0])
            result.extend(sorted_row)

        return result

    def process_grid_image(
        self,
        image: NDArray[np.uint8],
        col_threshold: int = 60,
        question_x_offset: int = 300,
        num_question_columns: int = 4,
        questions_per_column: int = 10
    ) -> List[OMRCardResult]:
        """
        Process a grid image and grade all OMR cards.

        Args:
            image: Input image with multiple OMR cards.
            col_threshold: Column detection threshold.
            question_x_offset: X offset for question columns.
            num_question_columns: Number of question columns.
            questions_per_column: Questions per column.

        Returns:
            List of OMRCardResult for each detected card.
        """
        # Detect and extract individual cards
        cards = self.detect_cards(image)
        results = []

        for idx, card_img in enumerate(cards):
            try:
                result = self._process_single_card(
                    card_img,
                    idx,
                    col_threshold,
                    question_x_offset,
                    num_question_columns,
                    questions_per_column
                )
                results.append(result)
            except Exception as e:
                logger.error(f"Error processing card {idx}: {e}")
                # Add empty result for failed card
                results.append(OMRCardResult(
                    card_index=idx,
                    image=card_img,
                    bbox=(0, 0, card_img.shape[1], card_img.shape[0]),
                    student_name="Error",
                    answers={},
                    confidence_scores={}
                ))

        return results

    def _process_single_card(
        self,
        card_img: NDArray[np.uint8],
        card_index: int,
        col_threshold: int,
        question_x_offset: int,
        num_question_columns: int,
        questions_per_column: int
    ) -> OMRCardResult:
        """Process a single OMR card image."""
        # Try to apply perspective correction
        warped = self.doc_processor.process_document_image(card_img)
        if warped is None:
            warped = card_img

        # Detect bubbles
        bubbles = self.bubble_detector.detect_bubbles(warped)

        # Detect columns
        columns = self.bubble_detector.detect_columns(bubbles, col_threshold=col_threshold)

        # Filter question columns
        question_columns = [
            col for col in columns if col and col[0][0] > question_x_offset
        ]

        # Grade each question
        answers: Dict[int, List[int]] = {}
        confidence_scores: Dict[int, List[float]] = {}

        for col_idx, col_bubbles in enumerate(question_columns[:num_question_columns]):
            grid_rows = self.bubble_detector.sort_into_grid(col_bubbles)
            for row_idx, row in enumerate(grid_rows):
                q_num = col_idx * questions_per_column + row_idx + 1
                marking_status = self.bubble_detector.check_marking(warped, row)
                marked_indices = [
                    idx + 1 for idx, r in enumerate(marking_status) if r["is_marked"]
                ]
                answers[q_num] = marked_indices
                confidence_scores[q_num] = [r["score"] for r in marking_status]

        # Extract student name via OCR
        student_name = self._extract_student_name(warped)

        # Clear cache
        self.bubble_detector.clear_cache()

        return OMRCardResult(
            card_index=card_index,
            image=warped,
            bbox=(0, 0, warped.shape[1], warped.shape[0]),
            student_name=student_name,
            answers=answers,
            confidence_scores=confidence_scores
        )

    def _extract_student_name(self, image: NDArray[np.uint8]) -> str:
        """Extract student name from OMR card using OCR."""
        try:
            text_results = self.ocr_engine.extract_text(image)
            all_texts = [r["text"] for r in text_results]

            for i, text in enumerate(all_texts):
                if "이름" in text or "성명" in text:
                    if ":" in text and len(text.split(":")[1].strip()) > 0:
                        return text.split(":")[1].strip()
                    elif i + 1 < len(all_texts):
                        return all_texts[i + 1]

            # Try to find a name-like text (Korean characters)
            import re
            for text in all_texts:
                # Match Korean name pattern (2-4 characters)
                if re.match(r'^[가-힣]{2,4}$', text.strip()):
                    return text.strip()

        except Exception as e:
            logger.warning(f"Failed to extract student name: {e}")

        return "Unknown"


# Add method to DocumentProcessor for processing image directly
def _process_document_image(self, image: NDArray[np.uint8]) -> Optional[NDArray[np.uint8]]:
    """Process an image directly (not from file)."""
    if image is None:
        return None

    resized, ratio = self.resize_image(image)
    corners = self.get_corners(resized)

    if corners is None:
        return image

    scaled_corners = (corners.reshape(4, 2) / ratio).astype("float32")
    warped = self.four_point_transform(image, scaled_corners)
    return warped


# Monkey-patch the method onto DocumentProcessor
DocumentProcessor.process_document_image = _process_document_image
