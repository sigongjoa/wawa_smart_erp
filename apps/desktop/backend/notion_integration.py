"""
Notion Integration for Smart-Grader
Uploads grading results to Notion database
"""
import os
import json
import logging
from datetime import datetime
from typing import Optional, List, Dict, Any
from notion_client import Client
from notion_client.errors import APIResponseError

logger = logging.getLogger(__name__)

# Configuration from environment variables
# Set these in your environment or .env file:
# NOTION_API_KEY, NOTION_TEACHERS_DB, NOTION_STUDENTS_DB, NOTION_SCORES_DB, NOTION_EXAM_SCHEDULE_DB
DEFAULT_CONFIG = {
    "notionApiKey": os.environ.get("NOTION_API_KEY", ""),
    "notionTeachersDb": os.environ.get("NOTION_TEACHERS_DB", ""),
    "notionStudentsDb": os.environ.get("NOTION_STUDENTS_DB", ""),
    "notionScoresDb": os.environ.get("NOTION_SCORES_DB", ""),
    "notionExamScheduleDb": os.environ.get("NOTION_EXAM_SCHEDULE_DB", "")
}

# Existing Scores DB properties (discovered from database):
# - 이름 (title): Student name
# - 점수 (number): Score
# - 과목 (select): Subject
# - 난이도 (select): Difficulty
# - 시험년월 (rich_text): Exam date
# - 코멘트 (rich_text): Comment
# - 선생님 (relation): Teacher relation
# - 학생 (relation): Student relation


class NotionIntegration:
    """Handle Notion database operations for grading results"""

    def __init__(self, config: Optional[Dict[str, str]] = None):
        """Initialize with config or use defaults"""
        self.config = config or DEFAULT_CONFIG
        self.notion = Client(auth=self.config["notionApiKey"])
        self.scores_db_id = self.config["notionScoresDb"]
        self.students_db_id = self.config["notionStudentsDb"]

    def get_grade(self, percentage: float) -> str:
        """Convert percentage to letter grade"""
        if percentage >= 90:
            return "A"
        elif percentage >= 80:
            return "B"
        elif percentage >= 70:
            return "C"
        elif percentage >= 60:
            return "D"
        else:
            return "F"

    def get_difficulty(self, percentage: float) -> str:
        """Infer difficulty based on average score"""
        if percentage >= 85:
            return "쉬움"
        elif percentage >= 70:
            return "보통"
        else:
            return "어려움"

    def upload_grading_results(
        self,
        batch_id: str,
        students: List[Dict[str, Any]],
        exam_date: Optional[str] = None,
        subject: Optional[str] = None,
        difficulty: Optional[str] = None,
        average_score: Optional[float] = None
    ) -> Dict[str, Any]:
        """
        Upload grading results to Notion

        Args:
            batch_id: Unique identifier for this grading batch
            students: List of student results from batch grading
            exam_date: Date of the exam (YYYY-MM format, optional)
            subject: Subject name (optional)
            difficulty: Difficulty level (optional)
            average_score: Average score to infer difficulty (optional)

        Returns:
            Dict with upload results and any errors
        """
        results = {
            "success": [],
            "failed": [],
            "total": len(students)
        }

        # Default exam date to current year-month
        if not exam_date:
            exam_date = datetime.now().strftime("%Y-%m")

        # Infer difficulty from average score if not provided
        if not difficulty and average_score is not None:
            difficulty = self.get_difficulty(average_score)

        for student in students:
            try:
                # Build properties for Notion page using existing schema
                properties = {
                    "이름": {
                        "title": [{"text": {"content": student.get("name", "Unknown")}}]
                    },
                    "점수": {"number": student.get("percentage", 0)},
                    "시험년월": {
                        "rich_text": [{"text": {"content": exam_date}}]
                    }
                }

                # Add subject if provided
                if subject:
                    properties["과목"] = {"select": {"name": subject}}

                # Add difficulty if available
                if difficulty:
                    properties["난이도"] = {"select": {"name": difficulty}}

                # Add comment with detailed info
                comment_parts = []
                comment_parts.append(f"배치ID: {batch_id}")
                comment_parts.append(f"정답: {student.get('correct_count', 0)}/{student.get('total_questions', 0)}")
                comment_parts.append(f"등급: {self.get_grade(student.get('percentage', 0))}")

                # Add answer details summary if available
                if student.get("details"):
                    wrong_questions = []
                    for q_num, detail in student.get("details", {}).items():
                        if not detail.get("correct", True):
                            selected = detail.get("selected", [])
                            wrong_questions.append(f"Q{q_num}")
                    if wrong_questions:
                        comment_parts.append(f"오답: {', '.join(wrong_questions[:10])}")
                        if len(wrong_questions) > 10:
                            comment_parts.append(f"...외 {len(wrong_questions) - 10}문항")

                comment = " | ".join(comment_parts)
                # Truncate if too long
                if len(comment) > 1900:
                    comment = comment[:1900] + "..."

                properties["코멘트"] = {
                    "rich_text": [{"text": {"content": comment}}]
                }

                # Create page in Notion
                page = self.notion.pages.create(
                    parent={"database_id": self.scores_db_id},
                    properties=properties
                )

                results["success"].append({
                    "name": student.get("name", "Unknown"),
                    "page_id": page["id"],
                    "percentage": student.get("percentage", 0),
                    "url": page.get("url", "")
                })

                logger.info(f"Uploaded score for {student.get('name', 'Unknown')}: {student.get('percentage', 0)}%")

            except APIResponseError as e:
                logger.error(f"Failed to upload score for {student.get('name', 'Unknown')}: {e}")
                results["failed"].append({
                    "name": student.get("name", "Unknown"),
                    "error": str(e)
                })
            except Exception as e:
                logger.error(f"Unexpected error uploading score: {e}")
                results["failed"].append({
                    "name": student.get("name", "Unknown"),
                    "error": str(e)
                })

        return results

    def get_recent_scores(self, limit: int = 10) -> List[Dict[str, Any]]:
        """Get recent score entries from Notion via search"""
        try:
            results = self.notion.search(
                filter={"property": "object", "value": "page"},
                page_size=100
            )

            scores = []
            # Filter pages that belong to scores database
            scores_db_normalized = self.scores_db_id.replace("-", "")

            for page in results.get("results", []):
                parent = page.get("parent", {})
                parent_db = parent.get("database_id", "").replace("-", "")

                if parent_db == scores_db_normalized:
                    props = page.get("properties", {})
                    score_entry = {
                        "id": page["id"],
                        "name": self._extract_title(props.get("이름", {})),
                        "percentage": props.get("점수", {}).get("number"),
                        "subject": self._extract_select(props.get("과목", {})),
                        "difficulty": self._extract_select(props.get("난이도", {})),
                        "exam_date": self._extract_rich_text(props.get("시험년월", {})),
                        "comment": self._extract_rich_text(props.get("코멘트", {})),
                        "created": page.get("created_time"),
                        "url": page.get("url", "")
                    }
                    scores.append(score_entry)

            # Sort by created time and limit
            scores.sort(key=lambda x: x.get("created", ""), reverse=True)
            return scores[:limit]

        except Exception as e:
            logger.error(f"Error fetching recent scores: {e}")
            return []

    def _extract_title(self, prop: Dict) -> str:
        """Extract text from title property"""
        titles = prop.get("title", [])
        return titles[0].get("plain_text", "") if titles else ""

    def _extract_select(self, prop: Dict) -> Optional[str]:
        """Extract value from select property"""
        select = prop.get("select")
        return select.get("name") if select else None

    def _extract_rich_text(self, prop: Dict) -> Optional[str]:
        """Extract text from rich_text property"""
        texts = prop.get("rich_text", [])
        return texts[0].get("plain_text", "") if texts else None


# Singleton instance
_notion_instance: Optional[NotionIntegration] = None


def get_notion_integration() -> NotionIntegration:
    """Get or create Notion integration instance"""
    global _notion_instance
    if _notion_instance is None:
        _notion_instance = NotionIntegration()
    return _notion_instance


# Test function
if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)

    notion = get_notion_integration()

    # Test upload with sample data
    print("Testing upload with sample data...")
    test_students = [
        {
            "name": "AI채점 테스트",
            "percentage": 85.0,
            "correct_count": 17,
            "total_questions": 20,
            "details": {
                "1": {"selected": [2], "correct": True},
                "5": {"selected": [3], "correct": False},
                "10": {"selected": [1], "correct": False},
                "15": {"selected": [4], "correct": False}
            }
        }
    ]

    results = notion.upload_grading_results(
        batch_id="smart-grader-test-001",
        students=test_students,
        subject="수학",
        exam_date="2026-02"
    )

    print(f"\nUpload results:")
    print(f"  Total: {results['total']}")
    print(f"  Success: {len(results['success'])}")
    print(f"  Failed: {len(results['failed'])}")

    if results['success']:
        for s in results['success']:
            print(f"    - {s['name']}: {s['percentage']}% (Page: {s['page_id'][:8]}...)")

    if results['failed']:
        for f in results['failed']:
            print(f"    - {f['name']}: {f['error']}")

    # Test getting recent scores
    print("\nFetching recent scores...")
    recent = notion.get_recent_scores(limit=5)
    print(f"Found {len(recent)} recent scores:")
    for score in recent:
        print(f"  - {score['name']}: {score['percentage']}% ({score['subject'] or 'N/A'})")
