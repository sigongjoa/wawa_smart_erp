"""
Batch Grader Module

Compares student answers with answer keys and calculates scores.
Supports batch processing of multiple students.
"""

import logging
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)


@dataclass
class StudentResult:
    """Grading result for a single student."""

    student_name: str
    student_index: int
    total_questions: int
    correct_count: int
    score: float  # Percentage
    points: int  # Raw points (1 per correct)
    answers: Dict[int, List[int]]  # Student's answers
    correct_answers: Dict[int, int]  # Correct answer key
    details: List[Dict[str, Any]]  # Per-question details

    @property
    def score_display(self) -> str:
        """Format score for display."""
        return f"{self.correct_count}/{self.total_questions}"

    @property
    def percentage_display(self) -> str:
        """Format percentage for display."""
        return f"{self.score:.1f}%"


@dataclass
class BatchGradingResult:
    """Result of batch grading multiple students."""

    answer_key: List[int]
    total_questions: int
    students: List[StudentResult]
    statistics: Dict[str, Any]

    @classmethod
    def empty(cls, error: str = "") -> "BatchGradingResult":
        """Create an empty result."""
        return cls(
            answer_key=[],
            total_questions=0,
            students=[],
            statistics={"error": error} if error else {}
        )


class BatchGrader:
    """Grades multiple students against an answer key."""

    def __init__(self, points_per_question: int = 1):
        """
        Initialize the batch grader.

        Args:
            points_per_question: Points awarded per correct answer.
        """
        self.points_per_question = points_per_question

    def grade_batch(
        self,
        answer_key: List[int],
        student_answers: List[Dict[str, Any]]
    ) -> BatchGradingResult:
        """
        Grade a batch of students against the answer key.

        Args:
            answer_key: List of correct answers (1-indexed, values 1-5).
            student_answers: List of dicts with 'name' and 'answers' keys.
                answers is a Dict[int, List[int]] mapping question -> selected answers.

        Returns:
            BatchGradingResult with all student results and statistics.
        """
        if not answer_key:
            return BatchGradingResult.empty("No answer key provided")

        total_questions = len(answer_key)
        student_results: List[StudentResult] = []

        for idx, student_data in enumerate(student_answers):
            student_name = student_data.get("name", f"Student {idx + 1}")
            answers = student_data.get("answers", {})

            result = self._grade_student(
                student_name=student_name,
                student_index=idx,
                student_answers=answers,
                answer_key=answer_key,
                total_questions=total_questions
            )
            student_results.append(result)

        # Calculate statistics
        statistics = self._calculate_statistics(student_results, total_questions)

        return BatchGradingResult(
            answer_key=answer_key,
            total_questions=total_questions,
            students=student_results,
            statistics=statistics
        )

    def _grade_student(
        self,
        student_name: str,
        student_index: int,
        student_answers: Dict[int, List[int]],
        answer_key: List[int],
        total_questions: int
    ) -> StudentResult:
        """Grade a single student."""
        correct_count = 0
        details: List[Dict[str, Any]] = []

        # Convert answer key to dict (1-indexed)
        correct_answer_map = {
            i + 1: ans for i, ans in enumerate(answer_key)
        }

        for q_num in range(1, total_questions + 1):
            correct_answer = correct_answer_map.get(q_num, 0)
            student_selected = student_answers.get(q_num, [])

            # Check if correct
            is_correct = False
            if len(student_selected) == 1 and student_selected[0] == correct_answer:
                is_correct = True
                correct_count += 1

            details.append({
                "question": q_num,
                "correct_answer": correct_answer,
                "student_answer": student_selected,
                "is_correct": is_correct,
                "status": "correct" if is_correct else (
                    "wrong" if student_selected else "unanswered"
                )
            })

        score = (correct_count / total_questions * 100) if total_questions > 0 else 0
        points = correct_count * self.points_per_question

        return StudentResult(
            student_name=student_name,
            student_index=student_index,
            total_questions=total_questions,
            correct_count=correct_count,
            score=score,
            points=points,
            answers=student_answers,
            correct_answers=correct_answer_map,
            details=details
        )

    def _calculate_statistics(
        self,
        results: List[StudentResult],
        total_questions: int
    ) -> Dict[str, Any]:
        """Calculate batch statistics."""
        if not results:
            return {
                "student_count": 0,
                "average_score": 0,
                "highest_score": 0,
                "lowest_score": 0,
                "std_deviation": 0,
                "question_accuracy": []
            }

        scores = [r.score for r in results]
        correct_counts = [r.correct_count for r in results]

        # Basic statistics
        avg_score = sum(scores) / len(scores)
        highest = max(scores)
        lowest = min(scores)

        # Standard deviation
        variance = sum((s - avg_score) ** 2 for s in scores) / len(scores)
        std_dev = variance ** 0.5

        # Per-question accuracy
        question_accuracy: List[Dict[str, Any]] = []
        for q_num in range(1, total_questions + 1):
            correct_for_q = sum(
                1 for r in results
                if any(d["question"] == q_num and d["is_correct"] for d in r.details)
            )
            accuracy = (correct_for_q / len(results) * 100) if results else 0
            question_accuracy.append({
                "question": q_num,
                "correct_count": correct_for_q,
                "total_students": len(results),
                "accuracy": accuracy
            })

        return {
            "student_count": len(results),
            "average_score": round(avg_score, 2),
            "average_correct": round(sum(correct_counts) / len(correct_counts), 2),
            "highest_score": round(highest, 2),
            "lowest_score": round(lowest, 2),
            "std_deviation": round(std_dev, 2),
            "question_accuracy": question_accuracy,
            "perfect_scores": sum(1 for r in results if r.score == 100),
            "failing_scores": sum(1 for r in results if r.score < 60)
        }

    def format_results_table(self, result: BatchGradingResult) -> str:
        """Format results as a text table for display."""
        lines = [
            "=" * 60,
            f"{'채점 결과':^60}",
            "=" * 60,
            f"총 문항 수: {result.total_questions}",
            f"총 학생 수: {result.statistics.get('student_count', 0)}",
            "-" * 60,
            f"{'#':<4} {'이름':<15} {'점수':<10} {'정답률':<10}",
            "-" * 60
        ]

        for i, student in enumerate(result.students, 1):
            lines.append(
                f"{i:<4} {student.student_name:<15} "
                f"{student.score_display:<10} {student.percentage_display:<10}"
            )

        lines.extend([
            "-" * 60,
            f"평균 점수: {result.statistics.get('average_score', 0):.1f}%",
            f"최고 점수: {result.statistics.get('highest_score', 0):.1f}%",
            f"최저 점수: {result.statistics.get('lowest_score', 0):.1f}%",
            "=" * 60
        ])

        return "\n".join(lines)


def grade_students(
    answer_key: List[int],
    student_data: List[Dict[str, Any]]
) -> BatchGradingResult:
    """
    Convenience function to grade a batch of students.

    Args:
        answer_key: List of correct answers.
        student_data: List of student answer dicts.

    Returns:
        BatchGradingResult with all results.
    """
    grader = BatchGrader()
    return grader.grade_batch(answer_key, student_data)
