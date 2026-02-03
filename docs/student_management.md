# Student Management Module

## Overview
The **Student Management Module** (`/student`) is the source of truth for all student data, synced with the Notion "Students" database.

## Database Relationships

```mermaid
erDiagram
    STUDENT ||--o{ ENROLLMENT : "signed up for"
    STUDENT ||--o{ SCORE : "earns"
    TEACHER ||--o{ STUDENT : "manages"
    
    STUDENT {
        string id PK
        string name
        string grade
        string parentPhone
        string status
    }
    TEACHER {
        string id PK
        string name
        string subject
    }
```

## Features

### 1. Master List
- Search by name or phone.
- Filter by grade and active/inactive status.

### 2. CRUD Operations
- **Create**: Add new students with profiles and parent info.
- **Update**: Modify subjects, grades, or teacher assignments.
- **Delete**: Archive or remove student records.

### 3. Subject & Teacher Assignment
Mapping students to specific subjects and their respective managing teachers.

```mermaid
graph LR
    A[Student] --> B[Math: Teacher A]
    A --> C[English: Teacher B]
    A --> D[Science: Teacher C]
```
