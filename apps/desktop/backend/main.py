from fastapi import FastAPI, UploadFile, File, HTTPException, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import os
import uuid
import cv2
import logging
import aiofiles
from typing import List, Optional
from engine.document_processor import DocumentProcessor
from engine.bubble_detector import BubbleDetector
from engine.ocr_engine import OCREngine
from engine.pdf_answer_extractor import PDFAnswerExtractor
from engine.omr_grid_detector import OMRGridDetector
from engine.batch_grader import BatchGrader

os.environ["DISABLE_MODEL_SOURCE_CHECK"] = "True"

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Smart-Grader API")

# Configuration
ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "http://localhost:5173,http://localhost:3000").split(",")
ALLOWED_IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".bmp", ".tiff", ".webp"}
ALLOWED_IMAGE_MIME_TYPES = {"image/jpeg", "image/png", "image/bmp", "image/tiff", "image/webp"}
ALLOWED_PDF_EXTENSIONS = {".pdf"}
ALLOWED_PDF_MIME_TYPES = {"application/pdf"}
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB
MAX_PDF_SIZE = 50 * 1024 * 1024  # 50MB for PDFs

# Combined allowed extensions for backward compatibility
ALLOWED_EXTENSIONS = ALLOWED_IMAGE_EXTENSIONS
ALLOWED_MIME_TYPES = ALLOWED_IMAGE_MIME_TYPES

# SS-03 OMR Format Configuration
SS03_QUESTION_COLUMN_X_OFFSET = 300  # X coordinate threshold for question columns (skip ID columns)
SS03_COLUMN_THRESHOLD = 60  # Pixel threshold for grouping bubbles into columns
SS03_NUM_QUESTION_COLUMNS = 4  # Number of question columns in SS-03 format
SS03_QUESTIONS_PER_COLUMN = 10  # Questions per column

# Configure CORS with specific origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)

UPLOAD_DIR = "uploads"
PROCESSED_DIR = "processed"
os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs(PROCESSED_DIR, exist_ok=True)

# Mount static files to serve processed images
app.mount("/processed", StaticFiles(directory=PROCESSED_DIR), name="processed")

# Initialize engines (OCR-dependent engines are lazy-loaded for faster startup)
doc_processor = DocumentProcessor()
bubble_detector = BubbleDetector()
batch_grader = BatchGrader()
_ocr_engine: Optional[OCREngine] = None
_pdf_extractor: Optional[PDFAnswerExtractor] = None
_grid_detector: Optional[OMRGridDetector] = None


def get_ocr_engine() -> OCREngine:
    """Lazy initialization of OCR engine to improve startup time."""
    global _ocr_engine
    if _ocr_engine is None:
        logger.info("Initializing OCR engine (first use)...")
        _ocr_engine = OCREngine()
    return _ocr_engine


def get_pdf_extractor() -> PDFAnswerExtractor:
    """Lazy initialization of PDF answer extractor."""
    global _pdf_extractor
    if _pdf_extractor is None:
        logger.info("Initializing PDF answer extractor...")
        _pdf_extractor = PDFAnswerExtractor(ocr_engine=get_ocr_engine())
    return _pdf_extractor


def get_grid_detector() -> OMRGridDetector:
    """Lazy initialization of grid detector."""
    global _grid_detector
    if _grid_detector is None:
        logger.info("Initializing OMR grid detector...")
        _grid_detector = OMRGridDetector(
            bubble_detector=bubble_detector,
            ocr_engine=get_ocr_engine()
        )
    return _grid_detector


def validate_file(file: UploadFile) -> None:
    """Validate uploaded image file type and size."""
    # Check file extension
    if file.filename:
        ext = os.path.splitext(file.filename)[1].lower()
        if ext not in ALLOWED_IMAGE_EXTENSIONS:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid file type. Allowed: {', '.join(ALLOWED_IMAGE_EXTENSIONS)}"
            )

    # Check MIME type
    if file.content_type and file.content_type not in ALLOWED_IMAGE_MIME_TYPES:
        raise HTTPException(
            status_code=400,
            detail="Invalid file type. Please upload an image file."
        )


def validate_pdf_file(file: UploadFile) -> None:
    """Validate uploaded PDF file."""
    if file.filename:
        ext = os.path.splitext(file.filename)[1].lower()
        if ext not in ALLOWED_PDF_EXTENSIONS:
            raise HTTPException(
                status_code=400,
                detail="Invalid file type. Please upload a PDF file."
            )

    if file.content_type and file.content_type not in ALLOWED_PDF_MIME_TYPES:
        raise HTTPException(
            status_code=400,
            detail="Invalid file type. Please upload a PDF file."
        )

@app.post("/api/grade")
async def grade_omr(file: UploadFile = File(...)):
    """
    Upload an OMR scan and get grading results.
    """
    # Validate file type
    validate_file(file)

    # Use only UUID for filename to prevent path traversal attacks
    file_id = str(uuid.uuid4())
    ext = os.path.splitext(file.filename or ".jpg")[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        ext = ".jpg"
    input_path = os.path.join(UPLOAD_DIR, f"{file_id}{ext}")

    # Async file write for better performance
    try:
        content = await file.read()
        if len(content) > MAX_FILE_SIZE:
            raise HTTPException(status_code=400, detail="File too large. Maximum size is 10MB.")
        async with aiofiles.open(input_path, "wb") as buffer:
            await buffer.write(content)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"File upload error: {e}")
        raise HTTPException(status_code=500, detail="Failed to save uploaded file.")

    try:
        # 1. Processing (Alignment)
        warped = doc_processor.process_document(input_path)
        if warped is None:
            raise HTTPException(status_code=400, detail="Could not detect document corners.")
            
        warped_path = os.path.join(PROCESSED_DIR, f"warped_{file_id}.jpg")
        
        # 2. Bubble Detection & Grading
        bubbles = bubble_detector.detect_bubbles(warped)
        marking_results = bubble_detector.check_marking(warped, bubbles)
        
        # Visualize detections on warped image
        vis_image = warped.copy()
        for i, res in enumerate(marking_results):
            x, y, w, h = res["bbox"]
            color = (0, 255, 0) if res["is_marked"] else (0, 0, 255)
            cv2.rectangle(vis_image, (x, y), (x + w, y + h), color, 2)
            
        cv2.imwrite(warped_path, vis_image)
        
        # Multi-column mapping logic for SS-03
        # 1. Sort by X to find columns
        columns = bubble_detector.detect_columns(bubbles, col_threshold=SS03_COLUMN_THRESHOLD)

        grading_results = {}
        # Filter out the first few columns if they are part of Class/ID info
        # For SS-03, columns starting from X > threshold are questions
        question_columns = [
            col for col in columns if col[0][0] > SS03_QUESTION_COLUMN_X_OFFSET
        ]

        # Process each question column
        for col_idx, col_bubbles in enumerate(question_columns[:SS03_NUM_QUESTION_COLUMNS]):
            grid_rows = bubble_detector.sort_into_grid(col_bubbles)
            for row_idx, row in enumerate(grid_rows):
                q_num = col_idx * SS03_QUESTIONS_PER_COLUMN + row_idx + 1
                marking_status = bubble_detector.check_marking(warped, row)
                marked_indices = [
                    idx for idx, r in enumerate(marking_status) if r["is_marked"]
                ]
                grading_results[q_num] = {
                    "selected": marked_indices,
                    "confidence": [r["score"] for r in marking_status]
                }
        
        # 3. Handwriting OCR (optional for name) - lazy loaded
        ocr_engine = get_ocr_engine()
        text_results = ocr_engine.extract_text(warped)
        
        # Improved name extraction logic
        student_name = "Unknown"
        all_texts = [res["text"] for res in text_results]
        
        for i, text in enumerate(all_texts):
            if "이름" in text or "성명" in text:
                # Often the name is in the same block or the next one
                # If "이름: 김철수" format
                if ":" in text and len(text.split(":")[1].strip()) > 0:
                    student_name = text.split(":")[1].strip()
                elif i + 1 < len(all_texts):
                    student_name = all_texts[i+1]
                break
        
        # Clear grayscale cache to free memory
        bubble_detector.clear_cache()

        # 4. Final aggregation
        response = {
            "id": file_id,
            "warped_url": f"/processed/warped_{file_id}.jpg",
            "grades": grading_results,
            "text_found": text_results,
            "student_name": student_name,
            "message": "Grading complete."
        }

        return response

    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Grading error for file {file_id}: {e}")
        raise HTTPException(status_code=500, detail="An error occurred during grading. Please try again.")
    finally:
        # Clean up uploaded file to prevent disk space accumulation
        if os.path.exists(input_path):
            try:
                os.remove(input_path)
            except OSError as e:
                logger.warning(f"Failed to clean up file {input_path}: {e}")

@app.post("/api/batch-grade")
async def batch_grade_omr(
    answer_pdf: UploadFile = File(..., description="PDF file containing answer key"),
    omr_image: UploadFile = File(..., description="Image with multiple OMR cards in grid layout")
):
    """
    Batch grade multiple OMR cards against an answer key from PDF.

    - Upload a PDF containing the exam with answer key
    - Upload an image containing multiple OMR cards in grid layout
    - Returns grading results for all detected students
    """
    # Validate files
    validate_pdf_file(answer_pdf)
    validate_file(omr_image)

    batch_id = str(uuid.uuid4())
    pdf_path = os.path.join(UPLOAD_DIR, f"{batch_id}_answers.pdf")
    omr_path = os.path.join(UPLOAD_DIR, f"{batch_id}_omr.jpg")

    try:
        # Save PDF file
        pdf_content = await answer_pdf.read()
        if len(pdf_content) > MAX_PDF_SIZE:
            raise HTTPException(status_code=400, detail="PDF file too large. Maximum size is 50MB.")
        async with aiofiles.open(pdf_path, "wb") as f:
            await f.write(pdf_content)

        # Save OMR image
        omr_content = await omr_image.read()
        if len(omr_content) > MAX_FILE_SIZE:
            raise HTTPException(status_code=400, detail="Image file too large. Maximum size is 10MB.")
        async with aiofiles.open(omr_path, "wb") as f:
            await f.write(omr_content)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"File upload error: {e}")
        raise HTTPException(status_code=500, detail="Failed to save uploaded files.")

    try:
        # 1. Extract answer key from PDF
        logger.info(f"Extracting answers from PDF: {batch_id}")
        pdf_extractor = get_pdf_extractor()
        answer_result = pdf_extractor.extract_from_pdf_path(pdf_path)

        if not answer_result["answers"]:
            raise HTTPException(
                status_code=400,
                detail="Could not extract answer key from PDF. Please check the PDF format."
            )

        answer_key = answer_result["answers"]
        total_questions = len(answer_key)
        logger.info(f"Extracted {total_questions} answers from PDF")

        # 2. Load and process OMR grid image
        logger.info(f"Processing OMR grid image: {batch_id}")
        omr_image_data = cv2.imread(omr_path)
        if omr_image_data is None:
            raise HTTPException(status_code=400, detail="Could not read OMR image.")

        # 3. Detect and grade individual OMR cards
        grid_detector = get_grid_detector()
        card_results = grid_detector.process_grid_image(
            omr_image_data,
            col_threshold=SS03_COLUMN_THRESHOLD,
            question_x_offset=SS03_QUESTION_COLUMN_X_OFFSET,
            num_question_columns=SS03_NUM_QUESTION_COLUMNS,
            questions_per_column=SS03_QUESTIONS_PER_COLUMN
        )

        # If no cards detected in grid, treat the entire image as a single OMR card
        if not card_results:
            logger.info("No grid detected, processing as single OMR card")
            from engine.omr_grid_detector import OMRCardResult

            # Process as single card using existing single-grade logic
            warped = doc_processor.process_document(omr_path)
            if warped is None:
                warped = omr_image_data

            bubbles = bubble_detector.detect_bubbles(warped)
            columns = bubble_detector.detect_columns(bubbles, col_threshold=SS03_COLUMN_THRESHOLD)
            question_columns = [
                col for col in columns if col and col[0][0] > SS03_QUESTION_COLUMN_X_OFFSET
            ]

            answers = {}
            confidence_scores = {}
            for col_idx, col_bubbles in enumerate(question_columns[:SS03_NUM_QUESTION_COLUMNS]):
                grid_rows = bubble_detector.sort_into_grid(col_bubbles)
                for row_idx, row in enumerate(grid_rows):
                    q_num = col_idx * SS03_QUESTIONS_PER_COLUMN + row_idx + 1
                    marking_status = bubble_detector.check_marking(warped, row)
                    marked_indices = [
                        idx + 1 for idx, r in enumerate(marking_status) if r["is_marked"]
                    ]
                    answers[q_num] = marked_indices
                    confidence_scores[q_num] = [r["score"] for r in marking_status]

            # Extract student name
            ocr_engine = get_ocr_engine()
            text_results = ocr_engine.extract_text(warped)
            student_name = "Unknown"
            all_texts = [res["text"] for res in text_results]
            for i, text in enumerate(all_texts):
                if "이름" in text or "성명" in text:
                    if ":" in text and len(text.split(":")[1].strip()) > 0:
                        student_name = text.split(":")[1].strip()
                    elif i + 1 < len(all_texts):
                        student_name = all_texts[i + 1]
                    break

            bubble_detector.clear_cache()

            card_results = [OMRCardResult(
                card_index=0,
                image=warped,
                bbox=(0, 0, warped.shape[1], warped.shape[0]),
                student_name=student_name,
                answers=answers,
                confidence_scores=confidence_scores
            )]

        logger.info(f"Detected {len(card_results)} OMR cards")

        # 4. Prepare student data for batch grading
        student_data = []
        for card in card_results:
            student_data.append({
                "name": card.student_name,
                "answers": card.answers
            })

        # 5. Grade all students
        grading_result = batch_grader.grade_batch(answer_key, student_data)

        # 6. Save processed images for visualization
        processed_images = []
        for idx, card in enumerate(card_results):
            card_path = os.path.join(PROCESSED_DIR, f"card_{batch_id}_{idx}.jpg")
            cv2.imwrite(card_path, card.image)
            processed_images.append(f"/processed/card_{batch_id}_{idx}.jpg")

        # 7. Build response
        students_response = []
        for student in grading_result.students:
            students_response.append({
                "index": student.student_index,
                "name": student.student_name,
                "score": student.score_display,
                "percentage": round(student.score, 1),
                "correct_count": student.correct_count,
                "total_questions": student.total_questions,
                "details": student.details,
                "image_url": processed_images[student.student_index] if student.student_index < len(processed_images) else None
            })

        response = {
            "batch_id": batch_id,
            "answer_key": answer_key,
            "total_questions": total_questions,
            "students": students_response,
            "statistics": grading_result.statistics,
            "pdf_extraction": {
                "confidence": answer_result.get("confidence", 0),
                "raw_text_preview": answer_result.get("raw_text", "")[:500]
            },
            "message": f"Batch grading complete. Graded {len(card_results)} students."
        }

        return response

    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Batch grading error for {batch_id}: {e}")
        raise HTTPException(
            status_code=500,
            detail="An error occurred during batch grading. Please try again."
        )
    finally:
        # Clean up uploaded files
        for path in [pdf_path, omr_path]:
            if os.path.exists(path):
                try:
                    os.remove(path)
                except OSError as e:
                    logger.warning(f"Failed to clean up file {path}: {e}")


@app.get("/")
async def root():
    return {"message": "Smart-Grader API is running."}


# Notion Integration Endpoints
from notion_integration import get_notion_integration, NotionIntegration

@app.post("/api/notion/upload")
async def upload_to_notion(
    batch_id: str = Form(..., description="Batch ID from grading"),
    students_json: str = Form(..., description="JSON array of student results"),
    subject: str = Form(None, description="Subject name (optional)"),
    exam_date: str = Form(None, description="Exam date YYYY-MM (optional)")
):
    """
    Upload grading results to Notion database.

    - batch_id: The batch ID from batch grading
    - students_json: JSON string containing array of student results
    - subject: Optional subject name
    - exam_date: Optional exam date in YYYY-MM format
    """
    try:
        import json
        students = json.loads(students_json)

        if not students:
            raise HTTPException(status_code=400, detail="No student data provided")

        # Calculate average score for difficulty inference
        avg_score = sum(s.get("percentage", 0) for s in students) / len(students)

        notion = get_notion_integration()
        result = notion.upload_grading_results(
            batch_id=batch_id,
            students=students,
            subject=subject,
            exam_date=exam_date,
            average_score=avg_score
        )

        return {
            "success": True,
            "uploaded": len(result["success"]),
            "failed": len(result["failed"]),
            "total": result["total"],
            "details": result
        }

    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid JSON in students_json")
    except Exception as e:
        logger.exception(f"Notion upload error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to upload to Notion: {str(e)}")


@app.get("/api/notion/recent")
async def get_recent_notion_scores(limit: int = 10):
    """
    Get recent scores from Notion database.

    - limit: Maximum number of scores to return (default 10)
    """
    try:
        notion = get_notion_integration()
        scores = notion.get_recent_scores(limit=limit)
        return {
            "success": True,
            "count": len(scores),
            "scores": scores
        }
    except Exception as e:
        logger.exception(f"Error fetching Notion scores: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch scores: {str(e)}")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
