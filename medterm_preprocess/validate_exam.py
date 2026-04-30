"""exam_*.json 검증 — 빌드 전 스키마·일관성 확인."""
import json
import sys
from pathlib import Path

VALID_TYPES = {'객관식', '단답형', '매칭', '빈칸', '용어분해', 'OX'}
VALID_DIFFICULTY = {'하', '중', '상'}
VALID_ROLES = {'p', 'r', 'cv', 's'}
REQUIRED_FIELDS = {'no', 'type', 'topic', 'difficulty', 'question'}


def validate(json_path: Path) -> list[str]:
    errors: list[str] = []
    data = json.loads(Path(json_path).read_text(encoding='utf-8'))

    seen_no = set()
    for i, q in enumerate(data.get('questions', []), 1):
        prefix = f'Q#{q.get("no", f"index{i}")}'
        for f in REQUIRED_FIELDS:
            if f not in q:
                errors.append(f'{prefix}: 필수 필드 누락 — {f}')
        if q.get('no') in seen_no:
            errors.append(f'{prefix}: 중복 번호')
        seen_no.add(q.get('no'))
        if q.get('type') not in VALID_TYPES:
            errors.append(f'{prefix}: type 오류 — {q.get("type")}')
        if q.get('difficulty') not in VALID_DIFFICULTY:
            errors.append(f'{prefix}: difficulty 오류 — {q.get("difficulty")}')

        # 객관식
        if q.get('type') == '객관식':
            choices = q.get('choices', [])
            if not (3 <= len(choices) <= 5):
                errors.append(f'{prefix}: 객관식 보기 개수 비정상 ({len(choices)})')
            ans = q.get('answer')
            if not (isinstance(ans, str) and ans in 'ABCDE'[:len(choices)]):
                errors.append(f'{prefix}: 객관식 answer는 A~{chr(ord("A")+len(choices)-1)} 중 하나 — 현재 {ans}')

        # 매칭
        if q.get('type') == '매칭':
            items = q.get('items', {})
            options = q.get('options', {})
            ans = q.get('answer', {})
            if len(items) != len(options):
                errors.append(f'{prefix}: 매칭 items({len(items)}) vs options({len(options)}) 길이 불일치')
            if set(ans.keys()) != set(items.keys()):
                errors.append(f'{prefix}: 매칭 answer 키가 items 키와 불일치')
            for k, v in ans.items():
                if v not in options:
                    errors.append(f'{prefix}: 매칭 answer[{k}]={v} 가 options 에 없음')

        # 용어분해
        if q.get('type') == '용어분해':
            if 'parts' not in q:
                errors.append(f'{prefix}: 용어분해는 parts 배열 필요')
            else:
                for j, part in enumerate(q['parts']):
                    if part.get('role') not in VALID_ROLES:
                        errors.append(f'{prefix}: parts[{j}].role 오류 — {part.get("role")}')
                    if not part.get('value'):
                        errors.append(f'{prefix}: parts[{j}].value 비어 있음')

        # 답·해설 권장
        if 'answer' not in q:
            errors.append(f'{prefix}: answer 누락')

    return errors


def main():
    targets = sys.argv[1:] or [Path(__file__).parent / 'output' / 'exam_30q.json']
    fail = 0
    for path in targets:
        errs = validate(Path(path))
        if errs:
            print(f'❌ {path}')
            for e in errs:
                print(f'  - {e}')
            fail += 1
        else:
            print(f'✅ {path} — 통과')
    sys.exit(1 if fail else 0)


if __name__ == '__main__':
    main()
