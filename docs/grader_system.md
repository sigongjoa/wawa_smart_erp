# Grader System Module

## Overview
The **Grader Module** (`/grader`) provides automated OMR grading using computer vision via a Python backend.

## OMR Processing Flow

```mermaid
sequenceDiagram
    participant UI as Desktop App
    participant BE as FastAPI Backend
    participant CV as OpenCV/OCR Engine
    
    UI->>BE: POST /api/batch-grade (OMR Image + Answer PDF)
    BE->>CV: Process OMR Image
    CV-->>BE: Extract Marks & Name
    BE->>BE: Match Marks with Answer Key
    BE-->>UI: Return Grading Results & Image URL
    UI->>UI: Display Results & Handle Matching
```

## Grading Modes

### 1. Single Grading (단건 채점)
- Manual matching of a specific student to an OMR image.
- Review results immediately and save to Notion.

### 2. Batch Grading (일괄 채점)
- Automatic name recognition via OCR.
- Bulk saving of grading results for multiple students.

## Backend Interaction
Results are fetched from `http://localhost:8000/api/batch-grade`.

```mermaid
graph TD
    A[Upload OMR] --> B{OCR Name Found?}
    B -- Yes --> C[Match with Student List]
    B -- No --> D[Mark as Unidentified]
    C --> E[Calculate Score]
    D --> F[Manual Match Required]
    E --> G[Save to Notion Scores DB]
```
