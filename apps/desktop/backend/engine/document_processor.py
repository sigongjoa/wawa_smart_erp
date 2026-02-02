from dataclasses import dataclass
from typing import Optional, Tuple

import cv2
import numpy as np
from numpy.typing import NDArray


@dataclass
class DocumentProcessorConfig:
    """Configuration for document processing parameters."""

    # Resize settings
    resize_height: int = 1000

    # Edge detection (Canny) thresholds
    canny_low: int = 50
    canny_high: int = 200

    # Gaussian blur kernel size
    blur_kernel: Tuple[int, int] = (5, 5)

    # Morphological kernel size
    morph_kernel: Tuple[int, int] = (5, 5)

    # Polygon approximation epsilon factor
    poly_epsilon_factor: float = 0.02

    # Minimum area ratio for valid document contour (10% of image)
    min_area_ratio: float = 0.1

    # Number of top contours to consider
    top_contours: int = 10


class DocumentProcessor:
    """Processor for detecting and warping document images."""

    def __init__(self, config: Optional[DocumentProcessorConfig] = None):
        """
        Initialize document processor with configuration.

        Args:
            config: Configuration object. Uses defaults if not provided.
        """
        self.config = config or DocumentProcessorConfig()

    def resize_image(
        self, image: NDArray[np.uint8], height: Optional[int] = None
    ) -> Tuple[NDArray[np.uint8], float]:
        """
        Resize image to a fixed height while maintaining aspect ratio.

        Args:
            image: Input image as numpy array.
            height: Target height. Uses config default if not specified.

        Returns:
            Tuple of (resized image, scale ratio).
        """
        target_height = height or self.config.resize_height
        ratio = target_height / image.shape[0]
        dim = (int(image.shape[1] * ratio), target_height)
        return cv2.resize(image, dim, interpolation=cv2.INTER_AREA), ratio

    def get_corners(self, image: NDArray[np.uint8]) -> Optional[NDArray[np.float32]]:
        """
        Detect the four corners of a page/card.

        Args:
            image: Input image as numpy array.

        Returns:
            Array of 4 corner points, or None if not found.
        """
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        blurred = cv2.GaussianBlur(gray, self.config.blur_kernel, 0)

        # Use multiple thresholding methods for robustness
        # 1. Canny edge detection
        edged = cv2.Canny(blurred, self.config.canny_low, self.config.canny_high)
        # 2. Otsu thresholding (for blocky shapes)
        _, thresh = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY | cv2.THRESH_OTSU)

        combined = cv2.bitwise_or(edged, thresh)
        # Morphological operations to close gaps in contours
        kernel = cv2.getStructuringElement(cv2.MORPH_RECT, self.config.morph_kernel)
        combined = cv2.morphologyEx(combined, cv2.MORPH_CLOSE, kernel)

        contours, _ = cv2.findContours(combined, cv2.RETR_LIST, cv2.CHAIN_APPROX_SIMPLE)
        contours = sorted(contours, key=cv2.contourArea, reverse=True)[:self.config.top_contours]

        image_area = image.shape[0] * image.shape[1]
        min_area = image_area * self.config.min_area_ratio

        for c in contours:
            peri = cv2.arcLength(c, True)
            approx = cv2.approxPolyDP(c, self.config.poly_epsilon_factor * peri, True)

            # Look for a 4-point contour that covers a significant area
            if len(approx) == 4 and cv2.contourArea(c) > min_area:
                return approx

        return None

    def order_points(self, pts: NDArray[np.float32]) -> NDArray[np.float32]:
        """
        Order points as: top-left, top-right, bottom-right, bottom-left.

        Args:
            pts: Array of 4 points.

        Returns:
            Ordered array of 4 points.
        """
        rect = np.zeros((4, 2), dtype="float32")
        pts = pts.reshape(4, 2)

        s = pts.sum(axis=1)
        rect[0] = pts[np.argmin(s)]
        rect[2] = pts[np.argmax(s)]

        diff = np.diff(pts, axis=1)
        rect[1] = pts[np.argmin(diff)]
        rect[3] = pts[np.argmax(diff)]

        return rect

    def four_point_transform(
        self, image: NDArray[np.uint8], pts: NDArray[np.float32]
    ) -> NDArray[np.uint8]:
        """
        Apply perspective transform to get a top-down view.

        Args:
            image: Input image as numpy array.
            pts: Array of 4 corner points.

        Returns:
            Warped (perspective-corrected) image.
        """
        rect = self.order_points(pts)
        (tl, tr, br, bl) = rect

        widthA = np.sqrt(((br[0] - bl[0]) ** 2) + ((br[1] - bl[1]) ** 2))
        widthB = np.sqrt(((tr[0] - tl[0]) ** 2) + ((tr[1] - tl[1]) ** 2))
        maxWidth = max(int(widthA), int(widthB))

        heightA = np.sqrt(((tr[0] - br[0]) ** 2) + ((tr[1] - br[1]) ** 2))
        heightB = np.sqrt(((tl[0] - bl[0]) ** 2) + ((tl[1] - bl[1]) ** 2))
        maxHeight = max(int(heightA), int(heightB))

        dst = np.array([
            [0, 0],
            [maxWidth - 1, 0],
            [maxWidth - 1, maxHeight - 1],
            [0, maxHeight - 1]], dtype="float32")

        M = cv2.getPerspectiveTransform(rect, dst)
        warped = cv2.warpPerspective(image, M, (maxWidth, maxHeight))

        return warped

    def process_document(self, image_path: str) -> Optional[NDArray[np.uint8]]:
        """
        Main method to load, detect corners, and warp a document.

        Args:
            image_path: Path to the input image file.

        Returns:
            Warped image, or original image if corners not detected,
            or None if image cannot be loaded.
        """
        image = cv2.imread(image_path)
        if image is None:
            return None

        # Resize for faster processing while keeping track of the ratio
        resized, ratio = self.resize_image(image)

        corners = self.get_corners(resized)
        if corners is None:
            # Fallback if no 4-point contour found - return original
            return image

        # Rescale corners back to original image size
        scaled_corners = (corners.reshape(4, 2) / ratio).astype("float32")

        warped = self.four_point_transform(image, scaled_corners)
        return warped
