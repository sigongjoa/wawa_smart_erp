from dataclasses import dataclass
from typing import Dict, List, Optional, Tuple, Any

import cv2
import numpy as np
from numpy.typing import NDArray


# Type alias for bubble tuple: (x, y, width, height, contour)
BubbleTuple = Tuple[int, int, int, int, NDArray[np.int32]]


@dataclass
class BubbleDetectorConfig:
    """Configuration for bubble detection parameters."""

    # Binary threshold for detecting bubbles
    binary_threshold: int = 200

    # Morphological kernel size for noise removal
    morph_kernel_size: Tuple[int, int] = (3, 3)

    # Bubble size constraints (in pixels)
    min_bubble_size: int = 8
    max_bubble_size: int = 100

    # Aspect ratio constraints for valid bubbles
    min_aspect_ratio: float = 0.4
    max_aspect_ratio: float = 2.5

    # Minimum contour area to filter noise
    min_contour_area: int = 20

    # Distance threshold for deduplication (pixels)
    dedup_distance: float = 5.0

    # Column grouping threshold (pixels)
    column_threshold: int = 50

    # Row grouping threshold (pixels)
    row_threshold: int = 15

    # Marking detection threshold (0-1, higher = darker)
    marking_threshold: float = 0.35


class BubbleDetector:
    """Detector for OMR bubble marks in scanned documents."""

    def __init__(
        self,
        threshold: float = 0.7,
        config: Optional[BubbleDetectorConfig] = None
    ):
        """
        Initialize bubble detector with configuration.

        Args:
            threshold: Legacy threshold parameter (deprecated, use config).
            config: Configuration object. Uses defaults if not provided.
        """
        self.threshold = threshold
        self.config = config or BubbleDetectorConfig()
        # Cache for grayscale conversion to avoid redundant processing
        self._gray_cache: Optional[Tuple[int, NDArray[np.uint8]]] = None

    def _get_grayscale(self, image: NDArray[np.uint8]) -> NDArray[np.uint8]:
        """
        Get grayscale version of image with caching.

        Args:
            image: Input BGR image.

        Returns:
            Grayscale image.
        """
        image_id = id(image)
        if self._gray_cache is not None and self._gray_cache[0] == image_id:
            return self._gray_cache[1]

        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        self._gray_cache = (image_id, gray)
        return gray

    def clear_cache(self) -> None:
        """Clear the grayscale image cache."""
        self._gray_cache = None

    def detect_bubbles(self, warped_image: NDArray[np.uint8]) -> List[BubbleTuple]:
        """
        Detect bubble candidates in a warped OMR image.

        Args:
            warped_image: Perspective-corrected OMR image.

        Returns:
            List of bubble tuples (x, y, w, h, contour).
        """
        gray = self._get_grayscale(warped_image)
        _, thresh = cv2.threshold(
            gray, self.config.binary_threshold, 255, cv2.THRESH_BINARY_INV
        )

        # Morphological opening to remove thin grid lines
        kernel = cv2.getStructuringElement(
            cv2.MORPH_ELLIPSE, self.config.morph_kernel_size
        )
        thresh = cv2.morphologyEx(thresh, cv2.MORPH_OPEN, kernel, iterations=1)

        # RETR_LIST detects bubbles inside boxes
        contours, _ = cv2.findContours(thresh, cv2.RETR_LIST, cv2.CHAIN_APPROX_SIMPLE)

        bubble_candidates: List[BubbleTuple] = []
        for c in contours:
            (x, y, w, h) = cv2.boundingRect(c)
            ar = w / float(h)

            # Filter by size and aspect ratio
            if (self.config.min_bubble_size <= w <= self.config.max_bubble_size and
                self.config.min_bubble_size <= h <= self.config.max_bubble_size and
                self.config.min_aspect_ratio <= ar <= self.config.max_aspect_ratio):
                # Basic area filter to remove tiny specs
                if cv2.contourArea(c) > self.config.min_contour_area:
                    bubble_candidates.append((x, y, w, h, c))

        # Sort by X coordinate and deduplicate
        bubble_candidates = sorted(bubble_candidates, key=lambda b: b[0])
        deduped: List[BubbleTuple] = []

        for bubble in bubble_candidates:
            is_duplicate = False
            for existing in deduped:
                # If centers are very close, it's a duplicate (inner/outer contour)
                dist = np.sqrt(
                    (bubble[0] - existing[0]) ** 2 +
                    (bubble[1] - existing[1]) ** 2
                )
                if dist < self.config.dedup_distance:
                    is_duplicate = True
                    break
            if not is_duplicate:
                deduped.append(bubble)

        return deduped

    def detect_columns(
        self,
        bubbles: List[BubbleTuple],
        col_threshold: Optional[int] = None
    ) -> List[List[BubbleTuple]]:
        """
        Group bubbles into columns based on X coordinate proximity.

        Args:
            bubbles: List of bubble tuples.
            col_threshold: Maximum X distance for same column. Uses config default if None.

        Returns:
            List of columns, each containing bubbles sorted by Y coordinate.
        """
        if not bubbles:
            return []

        threshold = col_threshold if col_threshold is not None else self.config.column_threshold

        # Sort by X
        sorted_bubbles = sorted(bubbles, key=lambda b: b[0])
        columns: List[List[BubbleTuple]] = []
        current_col: List[BubbleTuple] = [sorted_bubbles[0]]

        for i in range(1, len(sorted_bubbles)):
            if abs(sorted_bubbles[i][0] - current_col[-1][0]) < threshold:
                current_col.append(sorted_bubbles[i])
            else:
                columns.append(sorted(current_col, key=lambda b: b[1]))
                current_col = [sorted_bubbles[i]]

        columns.append(sorted(current_col, key=lambda b: b[1]))
        return columns

    def sort_into_grid(
        self,
        bubbles: List[BubbleTuple],
        row_threshold: Optional[int] = None
    ) -> List[List[BubbleTuple]]:
        """
        Group bubbles into rows based on Y coordinate proximity.

        For multi-column layouts, this should be called per column.

        Args:
            bubbles: List of bubble tuples.
            row_threshold: Maximum Y distance for same row. Uses config default if None.

        Returns:
            List of rows, each containing bubbles sorted by X coordinate.
        """
        if not bubbles:
            return []

        threshold = row_threshold if row_threshold is not None else self.config.row_threshold

        # Sort by Y
        sorted_bubbles = sorted(bubbles, key=lambda b: b[1])
        rows: List[List[BubbleTuple]] = []
        current_row: List[BubbleTuple] = [sorted_bubbles[0]]

        for i in range(1, len(sorted_bubbles)):
            if abs(sorted_bubbles[i][1] - current_row[0][1]) < threshold:
                current_row.append(sorted_bubbles[i])
            else:
                rows.append(sorted(current_row, key=lambda b: b[0]))
                current_row = [sorted_bubbles[i]]

        rows.append(sorted(current_row, key=lambda b: b[0]))
        return rows

    def check_marking(
        self,
        warped_image: NDArray[np.uint8],
        bubbles: List[BubbleTuple]
    ) -> List[Dict[str, Any]]:
        """
        Check which bubbles are marked based on pixel intensity.

        Args:
            warped_image: Perspective-corrected OMR image.
            bubbles: List of bubble tuples to check.

        Returns:
            List of dictionaries with 'bbox', 'score', and 'is_marked' keys.
        """
        gray = self._get_grayscale(warped_image)
        results: List[Dict[str, Any]] = []

        for (x, y, w, h, _) in bubbles:
            roi = gray[y:y+h, x:x+w]
            avg_intensity = np.mean(roi)
            marking_score = (255 - avg_intensity) / 255.0

            is_marked = marking_score > self.config.marking_threshold

            results.append({
                "bbox": (x, y, w, h),
                "score": float(marking_score),
                "is_marked": bool(is_marked)
            })

        return results

    def grade_paper(
        self,
        warped_image: NDArray[np.uint8],
        answer_key_mapping: Optional[Dict[int, int]] = None
    ) -> Dict[int, Dict[str, Any]]:
        """
        Grade an entire OMR paper.

        Args:
            warped_image: Perspective-corrected OMR image.
            answer_key_mapping: Optional mapping of question numbers to correct answers.

        Returns:
            Dictionary mapping question numbers to grading results.
        """
        bubbles = self.detect_bubbles(warped_image)
        grid = self.sort_into_grid(bubbles)
        graded_results: Dict[int, Dict[str, Any]] = {}

        for i, row in enumerate(grid):
            marking_status = self.check_marking(warped_image, row)
            marked_indices = [
                idx for idx, res in enumerate(marking_status) if res["is_marked"]
            ]
            graded_results[i + 1] = {
                "selected": marked_indices,
                "confidence": [res["score"] for res in marking_status]
            }

        return graded_results
