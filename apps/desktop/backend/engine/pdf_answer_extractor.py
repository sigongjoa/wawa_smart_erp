"""
PDF Answer Extractor Module

Extracts answer keys from PDF files containing exam questions and answers.
Uses OCR and pattern matching to automatically detect and parse answer sections.
"""

import re
import logging
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Tuple

import numpy as np
from numpy.typing import NDArray

try:
    import fitz  # PyMuPDF
except ImportError:
    fitz = None

try:
    from pdf2image import convert_from_path, convert_from_bytes
except ImportError:
    convert_from_path = None
    convert_from_bytes = None

from .ocr_engine import OCREngine

logger = logging.getLogger(__name__)


@dataclass
class AnswerExtractorConfig:
    """Configuration for answer extraction."""

    # Keywords to identify answer sections
    answer_keywords: List[str] = field(default_factory=lambda: [
        "정답", "답안", "답", "Answer", "ANSWER", "정답표", "모범답안",
        "채점기준", "답안지", "해답"
    ])

    # Patterns to match answer formats
    # Pattern groups: (question_number, answer)
    answer_patterns: List[str] = field(default_factory=lambda: [
        # Korean circle numbers: 1.③, 1번③, 1)③
        r'(\d+)\s*[.번\)]\s*([①②③④⑤])',
        # Number answers: 1.3, 1번:3, 1)3
        r'(\d+)\s*[.번\):]\s*(\d)',
        # Parentheses format: (1)③, (1)3
        r'\((\d+)\)\s*([①②③④⑤\d])',
        # Space separated: 1 ③, 1 3
        r'(\d+)\s+([①②③④⑤])',
        # Simple space separated number: 1 3
        r'(\d+)\s+([1-5])',
        # Compact format: 1③2①3④ (continuous)
        r'(\d+)([①②③④⑤])',
    ])

    # Circle number to integer mapping
    circle_to_int: Dict[str, int] = field(default_factory=lambda: {
        '①': 1, '②': 2, '③': 3, '④': 4, '⑤': 5,
        '⑥': 6, '⑦': 7, '⑧': 8, '⑨': 9, '⑩': 10
    })

    # PDF rendering DPI for OCR
    pdf_dpi: int = 200

    # Minimum confidence for OCR results
    min_ocr_confidence: float = 0.5


class PDFAnswerExtractor:
    """Extracts answer keys from PDF exam documents."""

    def __init__(
        self,
        config: Optional[AnswerExtractorConfig] = None,
        ocr_engine: Optional[OCREngine] = None
    ):
        """
        Initialize the PDF answer extractor.

        Args:
            config: Configuration object. Uses defaults if not provided.
            ocr_engine: OCR engine instance. Creates new one if not provided.
        """
        self.config = config or AnswerExtractorConfig()
        self._ocr_engine = ocr_engine

    @property
    def ocr_engine(self) -> OCREngine:
        """Lazy-loaded OCR engine."""
        if self._ocr_engine is None:
            self._ocr_engine = OCREngine()
        return self._ocr_engine

    def extract_from_pdf_path(self, pdf_path: str) -> Dict[str, Any]:
        """
        Extract answer key from a PDF file path.

        Args:
            pdf_path: Path to the PDF file.

        Returns:
            Dictionary containing:
                - answers: List of answers (1-indexed question numbers)
                - total_questions: Number of questions detected
                - raw_text: Raw OCR text for debugging
                - confidence: Extraction confidence score
        """
        # Try PyMuPDF first (faster), then pdf2image
        images = self._pdf_to_images_path(pdf_path)
        if not images:
            logger.error(f"Failed to convert PDF to images: {pdf_path}")
            return self._empty_result("PDF conversion failed")

        return self._extract_from_images(images)

    def extract_from_pdf_bytes(self, pdf_bytes: bytes) -> Dict[str, Any]:
        """
        Extract answer key from PDF bytes.

        Args:
            pdf_bytes: PDF file content as bytes.

        Returns:
            Dictionary containing answers and metadata.
        """
        images = self._pdf_to_images_bytes(pdf_bytes)
        if not images:
            logger.error("Failed to convert PDF bytes to images")
            return self._empty_result("PDF conversion failed")

        return self._extract_from_images(images)

    def _pdf_to_images_path(self, pdf_path: str) -> List[NDArray[np.uint8]]:
        """Convert PDF file to list of images."""
        images = []

        # Try PyMuPDF first
        if fitz is not None:
            try:
                doc = fitz.open(pdf_path)
                for page in doc:
                    # Render page to image
                    mat = fitz.Matrix(self.config.pdf_dpi / 72, self.config.pdf_dpi / 72)
                    pix = page.get_pixmap(matrix=mat)
                    img = np.frombuffer(pix.samples, dtype=np.uint8).reshape(
                        pix.height, pix.width, pix.n
                    )
                    # Convert to BGR if needed
                    if pix.n == 4:  # RGBA
                        img = img[:, :, :3]
                    if pix.n >= 3:
                        img = img[:, :, ::-1]  # RGB to BGR
                    images.append(img)
                doc.close()
                return images
            except Exception as e:
                logger.warning(f"PyMuPDF failed, trying pdf2image: {e}")

        # Fallback to pdf2image
        if convert_from_path is not None:
            try:
                pil_images = convert_from_path(pdf_path, dpi=self.config.pdf_dpi)
                for pil_img in pil_images:
                    img = np.array(pil_img)
                    if len(img.shape) == 3 and img.shape[2] == 3:
                        img = img[:, :, ::-1]  # RGB to BGR
                    images.append(img)
                return images
            except Exception as e:
                logger.error(f"pdf2image failed: {e}")

        return images

    def _pdf_to_images_bytes(self, pdf_bytes: bytes) -> List[NDArray[np.uint8]]:
        """Convert PDF bytes to list of images."""
        images = []

        # Try PyMuPDF first
        if fitz is not None:
            try:
                doc = fitz.open(stream=pdf_bytes, filetype="pdf")
                for page in doc:
                    mat = fitz.Matrix(self.config.pdf_dpi / 72, self.config.pdf_dpi / 72)
                    pix = page.get_pixmap(matrix=mat)
                    img = np.frombuffer(pix.samples, dtype=np.uint8).reshape(
                        pix.height, pix.width, pix.n
                    )
                    if pix.n == 4:
                        img = img[:, :, :3]
                    if pix.n >= 3:
                        img = img[:, :, ::-1]
                    images.append(img)
                doc.close()
                return images
            except Exception as e:
                logger.warning(f"PyMuPDF failed, trying pdf2image: {e}")

        # Fallback to pdf2image
        if convert_from_bytes is not None:
            try:
                pil_images = convert_from_bytes(pdf_bytes, dpi=self.config.pdf_dpi)
                for pil_img in pil_images:
                    img = np.array(pil_img)
                    if len(img.shape) == 3 and img.shape[2] == 3:
                        img = img[:, :, ::-1]
                    images.append(img)
                return images
            except Exception as e:
                logger.error(f"pdf2image failed: {e}")

        return images

    def _extract_from_images(self, images: List[NDArray[np.uint8]]) -> Dict[str, Any]:
        """Extract answers from list of page images."""
        all_text = []
        all_answers: Dict[int, int] = {}

        # Process each page
        for page_idx, image in enumerate(images):
            # OCR the page
            ocr_results = self.ocr_engine.extract_text(image)
            page_text = " ".join([r["text"] for r in ocr_results])
            all_text.append(page_text)

            # Check if this page contains answer section
            if self._contains_answer_section(page_text):
                logger.info(f"Found answer section on page {page_idx + 1}")
                answers = self._parse_answers(page_text)
                all_answers.update(answers)

        # If no answer section found, try parsing all pages
        if not all_answers:
            logger.info("No explicit answer section found, parsing all pages")
            full_text = " ".join(all_text)
            all_answers = self._parse_answers(full_text)

        # Convert to sorted list
        if all_answers:
            max_q = max(all_answers.keys())
            answer_list = [
                all_answers.get(i, 0) for i in range(1, max_q + 1)
            ]
        else:
            answer_list = []

        return {
            "answers": answer_list,
            "total_questions": len(answer_list),
            "raw_text": " ".join(all_text)[:2000],  # Truncate for response
            "confidence": self._calculate_confidence(all_answers, all_text),
            "answer_map": all_answers
        }

    def _contains_answer_section(self, text: str) -> bool:
        """Check if text contains answer section keywords."""
        text_lower = text.lower()
        for keyword in self.config.answer_keywords:
            if keyword.lower() in text_lower:
                return True
        return False

    def _parse_answers(self, text: str) -> Dict[int, int]:
        """
        Parse answers from text using pattern matching.

        Args:
            text: Text containing answers.

        Returns:
            Dictionary mapping question numbers to answers.
        """
        answers: Dict[int, int] = {}

        for pattern in self.config.answer_patterns:
            matches = re.findall(pattern, text)
            for match in matches:
                try:
                    q_num = int(match[0])
                    answer_str = match[1]

                    # Convert circle number to integer
                    if answer_str in self.config.circle_to_int:
                        answer = self.config.circle_to_int[answer_str]
                    else:
                        answer = int(answer_str)

                    # Only update if not already set (first match wins)
                    if q_num not in answers and 1 <= answer <= 10:
                        answers[q_num] = answer
                except (ValueError, IndexError):
                    continue

        return answers

    def _calculate_confidence(
        self,
        answers: Dict[int, int],
        texts: List[str]
    ) -> float:
        """Calculate confidence score for extraction."""
        if not answers:
            return 0.0

        # Check for sequential question numbers
        q_nums = sorted(answers.keys())
        if not q_nums:
            return 0.0

        # Calculate gaps in sequence
        expected = list(range(q_nums[0], q_nums[-1] + 1))
        missing = len(expected) - len(q_nums)
        gap_penalty = missing / len(expected) if expected else 0

        # Check if answer keywords were found
        full_text = " ".join(texts)
        keyword_found = self._contains_answer_section(full_text)
        keyword_bonus = 0.2 if keyword_found else 0

        # Base confidence
        base_confidence = 0.7 - (gap_penalty * 0.3) + keyword_bonus

        return min(1.0, max(0.0, base_confidence))

    def _empty_result(self, error: str) -> Dict[str, Any]:
        """Return empty result with error message."""
        return {
            "answers": [],
            "total_questions": 0,
            "raw_text": "",
            "confidence": 0.0,
            "error": error
        }


# Convenience function
def extract_answers_from_pdf(
    pdf_path: Optional[str] = None,
    pdf_bytes: Optional[bytes] = None
) -> Dict[str, Any]:
    """
    Extract answers from a PDF file.

    Args:
        pdf_path: Path to PDF file.
        pdf_bytes: PDF content as bytes.

    Returns:
        Dictionary with answers and metadata.
    """
    extractor = PDFAnswerExtractor()

    if pdf_path:
        return extractor.extract_from_pdf_path(pdf_path)
    elif pdf_bytes:
        return extractor.extract_from_pdf_bytes(pdf_bytes)
    else:
        return extractor._empty_result("No PDF provided")
