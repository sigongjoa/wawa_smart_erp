#!/usr/bin/env bash
# 셀프-서브 어휘 시험 통합 유스케이스 테스트
# 의존: wrangler dev가 127.0.0.1:8787 에서 동작 중. KV에 play:test-token-pdy 주입됨.
set -u
API="http://127.0.0.1:8787"
TOKEN="test-token-pdy"
H_AUTH=(-H "Authorization: Bearer $TOKEN" -H "Origin: http://localhost:5173" -H "Sec-Fetch-Site: same-site")

PASS=0; FAIL=0

# ── 매 실행 시작 시 fixture 리셋 (idempotent) ──
echo "▶ test fixture reset"
npx wrangler d1 execute wawa-smart-erp-test --local --env development --command "
DELETE FROM vocab_grade_results;
DELETE FROM vocab_print_answers;
DELETE FROM vocab_print_jobs WHERE created_by LIKE 'student:%';
DELETE FROM vocab_exam_policy WHERE id='vep-test-pdy';
UPDATE vocab_exam_policy SET cooldown_min=60, daily_limit=3, word_cooldown_min=30 WHERE academy_id='acad-1' AND scope='academy';
UPDATE vocab_words SET review_count=0, wrong_count=0, box=1, last_quizzed_at=NULL WHERE student_id='gst-sb-104c7909-e29';
" >/dev/null 2>&1
check() {
  local label="$1" expected="$2" actual="$3"
  if [[ "$actual" == "$expected" ]]; then
    echo "  ✓ $label"
    PASS=$((PASS + 1))
  else
    echo "  ✗ $label  (expected=$expected  actual=$actual)"
    FAIL=$((FAIL + 1))
  fi
}
contains() {
  local label="$1" needle="$2" haystack="$3"
  if [[ "$haystack" == *"$needle"* ]]; then
    echo "  ✓ $label"
    PASS=$((PASS + 1))
  else
    echo "  ✗ $label  (missing '$needle' in $haystack)"
    FAIL=$((FAIL + 1))
  fi
}

echo
echo "━━━ UC1: 학생 응시 가능성 조회 ━━━"
RES=$(curl -s "${H_AUTH[@]}" "$API/api/play/vocab/exam/availability")
AVAIL=$(echo "$RES" | python3 -c "import json,sys;d=json.load(sys.stdin)['data'];print(d['available'])")
TODAY=$(echo "$RES" | python3 -c "import json,sys;d=json.load(sys.stdin)['data'];print(d['todayCount'])")
COUNT=$(echo "$RES" | python3 -c "import json,sys;d=json.load(sys.stdin)['data'];print(d['policy']['vocab_count'])")
check "available=True"      "True" "$AVAIL"
check "todayCount=0"        "0"    "$TODAY"
check "policy vocab_count=10" "10" "$COUNT"

echo
echo "━━━ UC2: 학생이 셀프-시험 시작 (정책 vocab_count=10 적용) ━━━"
RES=$(curl -s -X POST "${H_AUTH[@]}" -H "Content-Type: application/json" -d '{}' \
  "$API/api/play/vocab/print/self-start")
JOB_ID=$(echo "$RES" | python3 -c "import json,sys;d=json.load(sys.stdin)['data'];print(d['id'])")
QCNT=$(echo "$RES" | python3 -c "import json,sys;d=json.load(sys.stdin)['data'];print(len(d['questions']))")
STATUS=$(echo "$RES" | python3 -c "import json,sys;d=json.load(sys.stdin)['data'];print(d['status'])")
echo "  → job_id=$JOB_ID"
check "questions=10"        "10"            "$QCNT"
check "status=in_progress"  "in_progress"   "$STATUS"
HAS_CHOICES=$(echo "$RES" | python3 -c "import json,sys;d=json.load(sys.stdin)['data'];q=d['questions'][0];print(len(q['choices']))")
check "choices=4"           "4"             "$HAS_CHOICES"

echo
echo "━━━ UC3: 시험 도중 답안 자동저장 (선택지 0~3 랜덤) ━━━"
QUESTIONS=$(echo "$RES" | python3 -c "import json,sys;d=json.load(sys.stdin)['data'];import json as j;print(j.dumps(d['questions']))")
SAVE_OK=0; SAVE_FAIL=0
while IFS= read -r line; do
  WID=$(echo "$line" | python3 -c "import json,sys;print(json.loads(sys.stdin.read())['wordId'])")
  IDX=$(( RANDOM % 4 ))
  CODE=$(curl -s -o /dev/null -w "%{http_code}" -X PUT "${H_AUTH[@]}" -H "Content-Type: application/json" \
    -d "{\"selected_index\":$IDX}" "$API/api/play/vocab/print/$JOB_ID/answers/$WID")
  if [[ "$CODE" == "200" ]]; then SAVE_OK=$((SAVE_OK+1)); else SAVE_FAIL=$((SAVE_FAIL+1)); fi
done < <(echo "$QUESTIONS" | python3 -c "import json,sys;[print(json.dumps(q)) for q in json.load(sys.stdin)]")
check "10개 답안 저장 성공"  "10" "$SAVE_OK"
check "저장 실패 0"           "0"  "$SAVE_FAIL"

echo
echo "━━━ UC4: 시험 제출 → 자동 채점 ━━━"
RES=$(curl -s -X POST "${H_AUTH[@]}" "$API/api/play/vocab/print/$JOB_ID/submit")
echo "  → $RES"
TOT=$(echo "$RES" | python3 -c "import json,sys;d=json.load(sys.stdin)['data'];print(d['total'])")
SUBAT=$(echo "$RES" | python3 -c "import json,sys;d=json.load(sys.stdin)['data'];print(bool(d.get('submittedAt')))")
check "total=10"            "10"   "$TOT"
check "submittedAt 존재"     "True" "$SUBAT"

echo
echo "━━━ UC5: 결과 조회 — breakdown(정답 공개) 포함 ━━━"
RES=$(curl -s "${H_AUTH[@]}" "$API/api/play/vocab/print/$JOB_ID")
RSTAT=$(echo "$RES" | python3 -c "import json,sys;d=json.load(sys.stdin)['data'];print(d['status'])")
HAS_BD=$(echo "$RES" | python3 -c "import json,sys;d=json.load(sys.stdin)['data'];print('breakdown' in d)")
check "status=submitted"    "submitted" "$RSTAT"
check "breakdown 포함"        "True"       "$HAS_BD"

echo
echo "━━━ UC6: 즉시 재시작 시도 → cooldown(60분) 차단 ━━━"
RES=$(curl -s -X POST "${H_AUTH[@]}" -H "Content-Type: application/json" -d '{}' \
  "$API/api/play/vocab/print/self-start")
ERR=$(echo "$RES" | python3 -c "import json,sys;d=json.load(sys.stdin);print(d.get('error',''))")
contains "cooldown 메시지"   "후 가능" "$ERR"

echo
echo "━━━ UC7: 정책 변경(쿨다운=0, daily_limit=10)으로 즉시 응시 가능 확인 ━━━"
TEACHER_TOKEN=$(echo -n '{}' | xxd -p)
# 직접 D1 UPDATE — 테스트 환경이라 가능
npx wrangler d1 execute wawa-smart-erp-test --local --env development --command "UPDATE vocab_exam_policy SET cooldown_min=0, daily_limit=10, word_cooldown_min=0 WHERE academy_id='acad-1' AND scope='academy'" >/dev/null 2>&1
RES=$(curl -s "${H_AUTH[@]}" "$API/api/play/vocab/exam/availability")
AVAIL=$(echo "$RES" | python3 -c "import json,sys;d=json.load(sys.stdin)['data'];print(d['available'])")
CD=$(echo "$RES" | python3 -c "import json,sys;d=json.load(sys.stdin)['data'];print(d['policy']['cooldown_min'])")
DL=$(echo "$RES" | python3 -c "import json,sys;d=json.load(sys.stdin)['data'];print(d['policy']['daily_limit'])")
check "available=True (쿨다운 해제)" "True" "$AVAIL"
check "cooldown_min=0"               "0"    "$CD"
check "daily_limit=10"               "10"   "$DL"

echo
echo "━━━ UC8: 학생별 오버라이드(vocab_count=5) → 학생 풀에 적용 ━━━"
npx wrangler d1 execute wawa-smart-erp-test --local --env development --command "
INSERT INTO vocab_exam_policy
  (id, academy_id, scope, scope_id, vocab_count, cooldown_min, daily_limit, box_filter, enabled, word_cooldown_min)
VALUES ('vep-test-pdy','acad-1','student','gst-sb-104c7909-e29',5,0,10,'1,2,3,4',1,0)
ON CONFLICT(academy_id, scope, scope_id) DO UPDATE SET vocab_count=5, cooldown_min=0, daily_limit=10" >/dev/null 2>&1

RES=$(curl -s -X POST "${H_AUTH[@]}" -H "Content-Type: application/json" -d '{}' \
  "$API/api/play/vocab/print/self-start")
QCNT=$(echo "$RES" | python3 -c "import json,sys;d=json.load(sys.stdin)['data'];print(len(d['questions']))")
JOB2=$(echo "$RES" | python3 -c "import json,sys;d=json.load(sys.stdin)['data'];print(d['id'])")
check "오버라이드 적용 vocab_count=5" "5" "$QCNT"
# 정리: 결과 보드용 제출
curl -s -X POST "${H_AUTH[@]}" "$API/api/play/vocab/print/$JOB2/submit" >/dev/null

echo
echo "━━━ UC9: 박스 갱신 — 응시 후 box/wrong_count 변동 확인 ━━━"
ROW=$(npx wrangler d1 execute wawa-smart-erp-test --local --env development \
  --command "SELECT SUM(review_count) AS reviews, SUM(wrong_count) AS wrongs, COUNT(CASE WHEN box>1 THEN 1 END) AS boosted, COUNT(CASE WHEN box=1 THEN 1 END) AS reset FROM vocab_words WHERE student_id='gst-sb-104c7909-e29'" 2>&1 | grep -E '"reviews"|"wrongs"|"boosted"|"reset"')
echo "$ROW"
REV=$(echo "$ROW" | grep '"reviews"' | grep -oE '[0-9]+')
WRG=$(echo "$ROW" | grep '"wrongs"' | grep -oE '[0-9]+')
echo "  → reviews=$REV  wrongs=$WRG"
[[ -n "$REV" && "$REV" -gt 0 ]] && { echo "  ✓ review_count 증가"; PASS=$((PASS+1)); } || { echo "  ✗ review_count 미증가"; FAIL=$((FAIL+1)); }

echo
echo "━━━ UC10: vocab_grade_results 기록 검증 ━━━"
GR=$(npx wrangler d1 execute wawa-smart-erp-test --local --env development \
  --command "SELECT COUNT(*) AS n, SUM(correct) AS correct FROM vocab_grade_results gr JOIN vocab_print_jobs j ON j.id=gr.print_job_id WHERE j.student_id='gst-sb-104c7909-e29'" 2>&1 | grep -E '"n"|"correct"')
echo "$GR"
N=$(echo "$GR" | grep '"n"' | grep -oE '[0-9]+')
[[ "$N" == "15" ]] && { echo "  ✓ 결과 15행(10+5)"; PASS=$((PASS+1)); } || { echo "  ✗ 결과 행수 $N (예상 15)"; FAIL=$((FAIL+1)); }

echo
echo "━━━ UC11: policy_id 추적 ━━━"
PIDS=$(npx wrangler d1 execute wawa-smart-erp-test --local --env development \
  --command "SELECT policy_id, COUNT(*) FROM vocab_print_jobs WHERE student_id='gst-sb-104c7909-e29' AND policy_id IS NOT NULL GROUP BY policy_id" 2>&1 | grep -E '"policy_id"|COUNT')
echo "$PIDS"
contains "기본 정책 ID 기록"      "vep-default-acad-1" "$PIDS"
contains "오버라이드 정책 ID 기록" "vep-test-pdy"       "$PIDS"

echo
echo "━━━ UC12: 페이징 응답 스키마 검증 — {items, pagination} 정식 형태 ━━━"
JWT=$(node -e "
const {SignJWT} = require('jose');
const enc = new TextEncoder();
(async () => {
  const t = await new SignJWT({userId:'user-i170bjn6w',email:'teacher1@academy.local',role:'admin',academyId:'acad-1'})
    .setProtectedHeader({alg:'HS256'}).setIssuedAt()
    .setExpirationTime(Math.floor(Date.now()/1000)+3600)
    .sign(enc.encode('wawa-dev-jwt-secret-2026'));
  console.log(t);
})();" 2>/dev/null)
RES=$(curl -s "$API/api/vocab/words?student_id=gst-sb-104c7909-e29" \
  -H "Authorization: Bearer $JWT" -H "Origin: http://localhost:5173" -H "Sec-Fetch-Site: same-site")
SHAPE=$(echo "$RES" | python3 -c "
import json,sys;d=json.load(sys.stdin);
data=d.get('data',{})
print('PAGED' if isinstance(data, dict) and 'items' in data and 'pagination' in data and isinstance(data['items'], list) else 'BROKEN')
" 2>/dev/null)
check "GET /api/vocab/words 응답 = {items[],pagination}" "PAGED" "$SHAPE"

echo
echo "━━━ 결과: PASS=$PASS  FAIL=$FAIL ━━━"
exit $FAIL
