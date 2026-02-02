"""
Engine module for Smart-Grader OMR processing.

This module provides the core processing engines for:
- Document alignment and perspective correction
- Bubble detection and marking analysis
- OCR text extraction
- PDF answer extraction
- Grid-based multi-OMR detection
- Batch grading
"""

from .document_processor import DocumentProcessor, DocumentProcessorConfig
from .bubble_detector import BubbleDetector, BubbleDetectorConfig
from .ocr_engine import OCREngine
from .pdf_answer_extractor import PDFAnswerExtractor, AnswerExtractorConfig
from .omr_grid_detector import OMRGridDetector, GridDetectorConfig, OMRCardResult
from .batch_grader import BatchGrader, BatchGradingResult, StudentResult

__all__ = [
    "DocumentProcessor",
    "DocumentProcessorConfig",
    "BubbleDetector",
    "BubbleDetectorConfig",
    "OCREngine",
    "PDFAnswerExtractor",
    "AnswerExtractorConfig",
    "OMRGridDetector",
    "GridDetectorConfig",
    "OMRCardResult",
    "BatchGrader",
    "BatchGradingResult",
    "StudentResult",
]
