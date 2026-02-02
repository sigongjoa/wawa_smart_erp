
import sys
import os

# Add backend path to sys.path to import engine
script_dir = os.path.dirname(os.path.abspath(__file__))
backend_dir = os.path.join(script_dir, "apps", "desktop", "backend")
sys.path.append(backend_dir)

from engine.pdf_answer_extractor import PDFAnswerExtractor

def test_regex():
    extractor = PDFAnswerExtractor()
    
    # Test cases that previously failed or are new
    test_cases = [
        ("1 3", {1: 3}, "Simple space separated"),
        ("1. 3", {1: 3}, "Dot separator"),
        ("1) 3", {1: 3}, "Parenthesis separator"),
        ("1 ④", {1: 4}, "Circle number with space"),
        ("10 5", {10: 5}, "Two digit question number"),
    ]
    
    print("Running Regex Verification...")
    passed = 0
    for text, expected, desc in test_cases:
        result = extractor._parse_answers(text)
        if result == expected:
            print(f"[PASS] {desc}: '{text}' -> {result}")
            passed += 1
        else:
            print(f"[FAIL] {desc}: '{text}' -> Expected {expected}, got {result}")

    if passed == len(test_cases):
        print("\nSUCCESS: All regex patterns verified.")
        sys.exit(0)
    else:
        print("\nFAILURE: Some regex patterns failed.")
        sys.exit(1)

if __name__ == "__main__":
    test_regex()
