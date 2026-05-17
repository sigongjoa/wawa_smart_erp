"""
WAWA Smart ERP — 선생님용 유즈케이스 가이드 PPT v2
실제 사용 시나리오 중심 (LoL 세계관 데모 데이터)
"""
from pptx import Presentation
from pptx.util import Inches, Pt
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN
from pptx.enum.shapes import MSO_SHAPE

prs = Presentation()
prs.slide_width = Inches(13.333)
prs.slide_height = Inches(7.5)

# ── 색상 ──
BG = RGBColor(0x1A, 0x1A, 0x2E)
CARD = RGBColor(0x25, 0x25, 0x3D)
CARD2 = RGBColor(0x1E, 0x2D, 0x3D)
BLUE = RGBColor(0x4A, 0x90, 0xD9)
GOLD = RGBColor(0xF0, 0xB9, 0x0B)
GREEN = RGBColor(0x22, 0xC5, 0x5E)
RED = RGBColor(0xE5, 0x3E, 0x3E)
PURPLE = RGBColor(0x9B, 0x59, 0xB6)
ORANGE = RGBColor(0xE6, 0x7E, 0x22)
WHITE = RGBColor(0xFF, 0xFF, 0xFF)
GRAY = RGBColor(0xAA, 0xAA, 0xAA)
LGRAY = RGBColor(0xDD, 0xDD, 0xDD)

def bg(slide):
    slide.background.fill.solid()
    slide.background.fill.fore_color.rgb = BG

def box(slide, l, t, w, h, txt, sz=18, c=WHITE, b=False, al=PP_ALIGN.LEFT):
    tb = slide.shapes.add_textbox(Inches(l), Inches(t), Inches(w), Inches(h))
    tf = tb.text_frame; tf.word_wrap = True
    p = tf.paragraphs[0]; p.text = txt; p.font.size = Pt(sz)
    p.font.color.rgb = c; p.font.bold = b; p.alignment = al
    return tb

def card(slide, l, t, w, h, fc=CARD, bc=None):
    s = slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(l), Inches(t), Inches(w), Inches(h))
    s.fill.solid(); s.fill.fore_color.rgb = fc
    if bc: s.line.color.rgb = bc; s.line.width = Pt(1.5)
    else: s.line.fill.background()
    s.shadow.inherit = False
    return s

def mtext(slide, l, t, w, h, lines):
    tb = slide.shapes.add_textbox(Inches(l), Inches(t), Inches(w), Inches(h))
    tf = tb.text_frame; tf.word_wrap = True
    for i, (txt, sz, c, b) in enumerate(lines):
        p = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
        p.text = txt; p.font.size = Pt(sz); p.font.color.rgb = c; p.font.bold = b
        p.space_after = Pt(3)
    return tb

# ============================================================
# SLIDE 1: 표지
# ============================================================
s = prs.slides.add_slide(prs.slide_layouts[6]); bg(s)
box(s, 1, 1.0, 11.3, 1, 'WAWA Smart ERP', 52, GOLD, True, PP_ALIGN.CENTER)
box(s, 1, 2.0, 11.3, 0.6, '학원 선생님을 위한 유즈케이스 가이드', 24, LGRAY, False, PP_ALIGN.CENTER)

card(s, 3, 3.2, 7.3, 2.5, RGBColor(0x20, 0x20, 0x38), BLUE)
mtext(s, 3.3, 3.3, 6.8, 2.3, [
    ('"선생님이 학생 관리에 쓰는 시간을 줄여드립니다"', 18, LGRAY, False),
    ('', 8, GRAY, False),
    ('수업시간 관리  ·  성적 평가 & 리포트  ·  교재/프린트 관리', 15, WHITE, False),
    ('결석 & 보강 일정  ·  학생 성장 피드백  ·  학원 내 업무 관리', 15, WHITE, False),
    ('', 8, GRAY, False),
    ('데모: wawa-smart-erp.pages.dev → (test)협곡점', 13, BLUE, False),
])

box(s, 1, 6.3, 11.3, 0.5, '6개 핵심 기능  ·  실제 사용 시나리오  ·  LoL 세계관 데모 데이터', 14, GRAY, False, PP_ALIGN.CENTER)

# ============================================================
# SLIDE 2: 전체 기능 한눈에
# ============================================================
s = prs.slides.add_slide(prs.slide_layouts[6]); bg(s)
box(s, 0.5, 0.3, 12, 0.7, '전체 기능 한눈에 보기', 36, GOLD, True)
box(s, 0.5, 0.85, 12, 0.4, '선생님의 하루를 따라가는 6가지 핵심 기능', 15, GRAY, False)

features = [
    ('수업', '수업 시간 관리', '학생별 실시간 타이머\n지각·화장실·외출 등\n순수 수업시간 자동 계산', BLUE, '수업 시작 → 진행 → 종료'),
    ('평가', '성적 & 리포트', '월말평가 성적 입력\n과목별 코멘트 작성\n학부모 리포트 전송', GREEN, '성적 입력 → 리포트 → 전송'),
    ('교재', '교재 & 프린트', '학생별 맞춤 프린트\n제작·배부 현황 관리\n여러 학생 동시 관리', PURPLE, '제작 → 배부 → 완료 체크'),
    ('보강', '결석 & 보강', '결석 사유 기록\n보강 일정 자동 관리\n학생 많아도 빠짐없이', RED, '결석 → 보강 생성 → 일정 확정'),
    ('학생', '학생 성장 피드백', '학생별 종합 현황\n학부모 주기적 피드백\n출석·성적·프린트 통합', ORANGE, '현황 파악 → 피드백 작성 → 전송'),
    ('보드', '학원 업무 관리', '공지사항 & 할일\n선생님간 업무 공유\n마감일 기반 관리', GOLD, '공지 → 할일 배정 → 완료'),
]

for i, (tab, title, desc, color, flow) in enumerate(features):
    col = i % 3
    row = i // 3
    x = 0.5 + col * 4.15
    y = 1.5 + row * 2.85
    card(s, x, y, 3.95, 2.65, CARD, color)
    mtext(s, x + 0.15, y + 0.1, 3.65, 2.45, [
        (f'[ {tab} ]  {title}', 16, color, True),
        ('', 4, GRAY, False),
        (desc, 12, LGRAY, False),
        ('', 6, GRAY, False),
        (flow, 10, GRAY, False),
    ])

# ============================================================
# SLIDE 3: 수업 — 수업 시간 관리
# ============================================================
s = prs.slides.add_slide(prs.slide_layouts[6]); bg(s)
box(s, 0.5, 0.3, 12, 0.7, '[ 수업 ]  수업 시간 관리', 36, BLUE, True)

# 문제 상황
card(s, 0.5, 1.2, 6.1, 1.8, RGBColor(0x3D, 0x1E, 0x1E), RED)
mtext(s, 0.7, 1.3, 5.7, 1.6, [
    ('이런 상황, 겪어보셨죠?', 16, RED, True),
    ('', 4, GRAY, False),
    ('"야스오가 18:40에 바람 쐬러 나갔다가 18:45에 돌아왔는데...', 12, LGRAY, False),
    (' 이거 수업시간에서 빼야 하나? 몇 분이었지?"', 12, LGRAY, False),
    ('"럭스가 5분 늦게 왔는데 가렌 오빠가 늦게 데려다줬다고..."', 12, LGRAY, False),
    ('"이렐리아 수업이 10분 연장됐는데 기록이 안 남아있네"', 12, LGRAY, False),
])

# 해결
card(s, 6.8, 1.2, 6.1, 1.8, RGBColor(0x1E, 0x2D, 0x1E), GREEN)
mtext(s, 7.0, 1.3, 5.7, 1.6, [
    ('WAWA가 자동으로 관리합니다', 16, GREEN, True),
    ('', 4, GRAY, False),
    ('학생 카드 탭 → 수업 시작 (타이머 자동 가동)', 12, LGRAY, False),
    ('[정지] 버튼 → 사유 선택 (화장실/외출/간식/기타)', 12, LGRAY, False),
    ('[재개] 버튼 → 정지 시간 자동 차감, 순수 수업시간만 기록', 12, LGRAY, False),
    ('지각/연장도 자동 감지 → 학부모 리포트에 반영', 12, LGRAY, False),
])

# 시나리오 타임라인
card(s, 0.5, 3.3, 12.3, 3.5, CARD2, BLUE)
box(s, 0.8, 3.4, 11.8, 0.4, '하이머딩거 선생님의 월요일 — 실시간 타이머 시나리오', 18, GOLD, True)

timeline = [
    ('16:00', '이즈리얼 수업 시작', '카드 탭 → 타이머 시작', WHITE),
    ('16:05', '럭스 도착 (5분 지각)', '"가렌 오빠가 늦게 데려다줌" 메모 → 지각 자동 기록', RED),
    ('17:30', '이즈리얼·럭스 수업 종료', '[완료] 버튼 → 이즈리얼 90분, 럭스 85분(지각 5분 차감) 자동 저장', GREEN),
    ('18:00', '야스오 수업 시작', '카드 탭 → 타이머 시작', WHITE),
    ('18:40', '야스오 "바람 쐬고 올게요"', '[정지] → 사유: 외출 선택', GOLD),
    ('18:45', '야스오 복귀', '[재개] → 5분 자동 차감 → 순수 수업시간만 기록', GREEN),
    ('20:00', '이렐리아 수업 시작', '질문이 많아서 21:40까지 진행', WHITE),
    ('21:40', '이렐리아 수업 종료', '10분 초과 자동 기록 → "초과" 배지 표시', BLUE),
]

for i, (time, event, detail, color) in enumerate(timeline):
    y = 3.95 + i * 0.35
    box(s, 0.8, y, 0.9, 0.32, time, 11, BLUE, True)
    box(s, 1.7, y, 3.0, 0.32, event, 11, color, False)
    box(s, 4.7, y, 7.8, 0.32, detail, 10, GRAY, False)

# 퇴근
card(s, 0.5, 6.9, 12.3, 0.4, RGBColor(0x15, 0x25, 0x15), GREEN)
mtext(s, 0.8, 6.9, 11.8, 0.35, [
    ('퇴근 버튼 → 수업 안 온 학생 자동 결석 처리 + 보강 자동 생성  |  기록은 출석부·리포트에 자동 반영', 12, GREEN, False),
])

# ============================================================
# SLIDE 4: 평가 — 성적 & 학부모 리포트
# ============================================================
s = prs.slides.add_slide(prs.slide_layouts[6]); bg(s)
box(s, 0.5, 0.3, 12, 0.7, '[ 평가 ]  성적 입력 & 학부모 리포트', 36, GREEN, True)

card(s, 0.5, 1.2, 6.1, 1.5, RGBColor(0x3D, 0x1E, 0x1E), RED)
mtext(s, 0.7, 1.3, 5.7, 1.3, [
    ('이런 상황, 겪어보셨죠?', 16, RED, True),
    ('', 4, GRAY, False),
    ('"월말평가 끝나면 학부모님한테 점수 알려줘야 하는데..."', 12, LGRAY, False),
    ('"카톡으로 하나하나 보내려면 시간이 너무 걸려"', 12, LGRAY, False),
    ('"지난달 대비 얼마나 올랐는지 기억이 안 나"', 12, LGRAY, False),
])

card(s, 6.8, 1.2, 6.1, 1.5, RGBColor(0x1E, 0x2D, 0x1E), GREEN)
mtext(s, 7.0, 1.3, 5.7, 1.3, [
    ('WAWA가 해결합니다', 16, GREEN, True),
    ('', 4, GRAY, False),
    ('점수 입력 → 코멘트 작성 → 리포트 자동 생성', 12, LGRAY, False),
    ('전월 대비 성적 변화 자동 계산 (▲5점, ▼3점)', 12, LGRAY, False),
    ('JPG 다운로드 or 카카오톡 공유 링크 → 원클릭 전송', 12, LGRAY, False),
])

# 3단계 흐름
steps = [
    ('STEP 1', '성적 입력', '학생 선택 → 과목별 점수 입력\n(blur 시 자동 저장)\n\n입력하는 순간 바로 저장되므로\n별도 저장 버튼이 필요 없습니다', BLUE),
    ('STEP 2', '코멘트 작성', '과목별 선생님 코멘트 입력\n또는 [AI 코멘트 생성] 클릭\n\n"야스오: 방정식 기초 보충 중,\n출석률 개선이 시급합니다"', GREEN),
    ('STEP 3', '리포트 전송', '리포트 미리보기 확인 →\n[카카오톡 공유] 클릭 →\n메시지 자동 복사 → 붙여넣기\n\n전송 현황: 0/4 → 1/4 → 4/4', GOLD),
]

for i, (step, title, desc, color) in enumerate(steps):
    x = 0.5 + i * 4.15
    card(s, x, 3.0, 3.95, 3.0, CARD, color)
    mtext(s, x + 0.15, 3.1, 3.65, 2.8, [
        (step, 12, color, True),
        (title, 20, WHITE, True),
        ('', 4, GRAY, False),
        (desc, 12, LGRAY, False),
    ])

# 리포트 구성
card(s, 0.5, 6.2, 12.3, 1.0, CARD2)
mtext(s, 0.8, 6.25, 11.8, 0.9, [
    ('리포트에 포함되는 정보', 14, GOLD, True),
    ('학원명 · 학생명 · 월/학기 · 과목별 점수(바 차트) · 전월 대비 증감(▲▼) · 과목별 코멘트 · AI 총평  →  학부모가 한눈에 파악', 12, LGRAY, False),
])

# ============================================================
# SLIDE 5: 교재 — 프린트 & 교재 관리
# ============================================================
s = prs.slides.add_slide(prs.slide_layouts[6]); bg(s)
box(s, 0.5, 0.3, 12, 0.7, '[ 교재 ]  프린트 & 교재 제작 관리', 36, PURPLE, True)

card(s, 0.5, 1.2, 6.1, 1.8, RGBColor(0x3D, 0x1E, 0x1E), RED)
mtext(s, 0.7, 1.3, 5.7, 1.6, [
    ('이런 상황, 겪어보셨죠?', 16, RED, True),
    ('', 4, GRAY, False),
    ('"야스오한테 방정식 프린트 줘야 하는데 어디까지 줬더라?"', 12, LGRAY, False),
    ('"에코한테 시간관리 프린트 만들어야 하는데 까먹었네"', 12, LGRAY, False),
    ('"학생이 10명이 넘으니까 누구한테 뭘 줘야 하는지 헷갈려"', 12, LGRAY, False),
    ('"프린트를 만들었는데 나눠줬는지 안 줬는지 모르겠어"', 12, LGRAY, False),
])

card(s, 6.8, 1.2, 6.1, 1.8, RGBColor(0x1E, 0x2D, 0x1E), GREEN)
mtext(s, 7.0, 1.3, 5.7, 1.6, [
    ('WAWA가 해결합니다', 16, GREEN, True),
    ('', 4, GRAY, False),
    ('학생별 맞춤 프린트를 등록 → 제작/배부 상태 추적', 12, LGRAY, False),
    ('대기(todo) → 완료(done) 상태로 체크', 12, LGRAY, False),
    ('학생이 많아져도 필터링으로 "대기 중"만 한눈에', 12, LGRAY, False),
    ('누가 몇 장 남았는지, 어떤 학생이 밀렸는지 바로 파악', 12, LGRAY, False),
])

# 시나리오
card(s, 0.5, 3.3, 12.3, 3.8, CARD2, PURPLE)
box(s, 0.8, 3.4, 11.8, 0.4, '하이머딩거 선생님의 교재 관리 시나리오', 18, GOLD, True)

scenarios = [
    ('야스오', '방정식 보충 시리즈 (3장)', PURPLE, [
        ('방정식 기초 (1) - 바람을 잡아라', '일차방정식 기본', '완료 ✅'),
        ('방정식 기초 (2) - 폭풍의 길', '연립방정식', '완료 ✅'),
        ('방정식 심화 (3) - 최후의 숨결', '이차방정식 입문', '대기 ⏳'),
    ]),
    ('에코', '시간관리 훈련 (1장)', BLUE, [
        ('시간관리 연습 프린트', '제한시간 내 문제풀이', '대기 ⏳'),
    ]),
    ('이즈리얼', '기초 강화 (1장)', GOLD, [
        ('연산 집중 훈련', '계산 실수 방지용', '대기 ⏳'),
    ]),
]

y_pos = 3.95
for name, series, color, items in scenarios:
    h = 0.4 + len(items) * 0.3
    card(s, 0.8, y_pos, 11.5, h, CARD, color)
    box(s, 1.0, y_pos + 0.02, 3, 0.3, f'{name} — {series}', 13, color, True)
    for j, (title, memo, status) in enumerate(items):
        iy = y_pos + 0.35 + j * 0.3
        sc = GREEN if '완료' in status else GOLD
        box(s, 1.2, iy, 3.5, 0.28, title, 11, WHITE, False)
        box(s, 4.7, iy, 3.5, 0.28, memo, 10, GRAY, False)
        box(s, 8.5, iy, 1.5, 0.28, status, 11, sc, True)
    y_pos += h + 0.15

# 핵심 포인트
card(s, 0.5, 6.85, 12.3, 0.4, RGBColor(0x25, 0x15, 0x35), PURPLE)
mtext(s, 0.8, 6.85, 11.8, 0.35, [
    ('핵심: 학생 1명 = 맞춤 프린트 N장  |  학생별로 진행상황 독립 관리  |  대기/완료 필터링으로 빠짐없이', 12, PURPLE, False),
])

# ============================================================
# SLIDE 6: 보강 — 결석 & 보강 일정
# ============================================================
s = prs.slides.add_slide(prs.slide_layouts[6]); bg(s)
box(s, 0.5, 0.3, 12, 0.7, '[ 보강 ]  결석 & 보강 일정 관리', 36, RED, True)

card(s, 0.5, 1.2, 6.1, 2.0, RGBColor(0x3D, 0x1E, 0x1E), RED)
mtext(s, 0.7, 1.3, 5.7, 1.8, [
    ('이런 상황, 겪어보셨죠?', 16, RED, True),
    ('', 4, GRAY, False),
    ('"야스오가 오늘 안 왔는데 보강을 언제 잡아야 하지?"', 12, LGRAY, False),
    ('"징크스 보강이 토요일이었나 월요일이었나..."', 12, LGRAY, False),
    ('"학생이 15명인데 누가 보강이 밀려있는지 머리로 기억이 안 돼"', 12, LGRAY, False),
    ('"국어·영어 따로 보강을 잡으려면 빈 시간을 찾아야 하는데..."', 12, LGRAY, False),
    ('"사전에 연락한 결석이랑 무단결석이 섞여서 관리가 안 돼"', 12, LGRAY, False),
])

card(s, 6.8, 1.2, 6.1, 2.0, RGBColor(0x1E, 0x2D, 0x1E), GREEN)
mtext(s, 7.0, 1.3, 5.7, 1.8, [
    ('WAWA가 해결합니다', 16, GREEN, True),
    ('', 4, GRAY, False),
    ('결석 시 자동 보강 생성 (대기 → 예정 → 완료)', 12, LGRAY, False),
    ('결석 사유 + 누가 연락했는지 기록', 12, LGRAY, False),
    ('보강 일정을 한눈에 확인 — 대기/예정/완료 필터', 12, LGRAY, False),
    ('학생의 수업 시간표 정보가 있으니 빈 시간 파악 가능', 12, LGRAY, False),
    ('수업 퇴근 시 자동 결석 처리 → 보강 자동 생성', 12, LGRAY, False),
])

# 두 가지 경로
card(s, 0.5, 3.5, 6.1, 3.3, CARD2, ORANGE)
mtext(s, 0.7, 3.6, 5.7, 3.1, [
    ('경로 A: 사전 연락 결석', 18, ORANGE, True),
    ('', 6, GRAY, False),
    ('① 바이(언니)가 카톡으로 연락', 13, WHITE, False),
    ('   "징크스가 내일 실험 사고로 못 가요"', 12, GRAY, False),
    ('', 4, GRAY, False),
    ('② 선생님이 [보강] 탭에서 결석 등록', 13, WHITE, False),
    ('   날짜 + 사유 + 통보자 기록', 12, GRAY, False),
    ('', 4, GRAY, False),
    ('③ 보강 자동 생성 (상태: 대기중)', 13, GOLD, False),
    ('', 4, GRAY, False),
    ('④ 보호자와 조율 후 보강일 확정', 13, WHITE, False),
    ('   "토요일 14시, 바이 언니가 데려다줌"', 12, GRAY, False),
    ('', 4, GRAY, False),
    ('⑤ 보강 수업 후 완료 처리', 13, GREEN, False),
])

card(s, 6.8, 3.5, 6.1, 3.3, CARD2, RED)
mtext(s, 7.0, 3.6, 5.7, 3.1, [
    ('경로 B: 당일 무단 결석 (퇴근 처리)', 18, RED, True),
    ('', 6, GRAY, False),
    ('① 수업 시간에 야스오가 안 옴', 13, WHITE, False),
    ('   연락도 없음...', 12, GRAY, False),
    ('', 4, GRAY, False),
    ('② 하루 수업 끝나고 [퇴근] 버튼 클릭', 13, WHITE, False),
    ('', 4, GRAY, False),
    ('③ 수업에 안 온 학생 자동 감지', 13, GOLD, False),
    ('   "야스오(18:00~19:30) 미출석"', 12, GRAY, False),
    ('', 4, GRAY, False),
    ('④ 일괄 결석 처리 + 보강 자동 생성', 13, RED, False),
    ('', 4, GRAY, False),
    ('⑤ 나중에 요네 형에게 연락 → 보강일 확정', 13, GREEN, False),
])

# ============================================================
# SLIDE 7: 학생 — 학부모 피드백
# ============================================================
s = prs.slides.add_slide(prs.slide_layouts[6]); bg(s)
box(s, 0.5, 0.3, 12, 0.7, '[ 학생 ]  학부모 주기적 피드백', 36, ORANGE, True)

card(s, 0.5, 1.2, 6.1, 1.5, RGBColor(0x3D, 0x1E, 0x1E), RED)
mtext(s, 0.7, 1.3, 5.7, 1.3, [
    ('이런 상황, 겪어보셨죠?', 16, RED, True),
    ('', 4, GRAY, False),
    ('"학부모님이 우리 애 요즘 어떤가요? 라고 물으면..."', 12, LGRAY, False),
    ('"출석은 어떤지, 성적은 어떤지, 프린트는 잘 하고 있는지"', 12, LGRAY, False),
    ('"이걸 학생마다 정리해서 알려주려면 시간이 너무 걸려"', 12, LGRAY, False),
])

card(s, 6.8, 1.2, 6.1, 1.5, RGBColor(0x1E, 0x2D, 0x1E), GREEN)
mtext(s, 7.0, 1.3, 5.7, 1.3, [
    ('WAWA가 해결합니다', 16, GREEN, True),
    ('', 4, GRAY, False),
    ('학생 프로필 = 한 화면에 모든 정보 통합', 12, LGRAY, False),
    ('출석 현황 + 성적 추이 + 프린트 진행 + 리포트 이력', 12, LGRAY, False),
    ('학부모 상담 시 이 화면만 보면 됩니다', 12, LGRAY, False),
])

# 학생 프로필 예시
card(s, 0.5, 3.0, 12.3, 1.0, CARD2, ORANGE)
mtext(s, 0.8, 3.05, 11.8, 0.9, [
    ('야스오 프로필 — 학부모(요네 형) 상담 화면', 16, ORANGE, True),
    ('중2 · 수학 · 담당: 하이머딩거  |  등원일: 2026-03-03  |  보호자: 요네(형) 010-2222-0003', 12, LGRAY, False),
])

cards_data = [
    ('출석 현황', BLUE, '4월 출석률: 75%\n지각 2회, 결석 1회\n\n"바람처럼 왔다 감"\n→ 요네 형과 상담 필요'),
    ('성적 추이', GREEN, '3월 수학: 58점\n(학원 평균 대비 -22)\n\n재능은 있으나\n결석으로 진도 밀림'),
    ('프린트 현황', PURPLE, '완료 2장 / 대기 1장\n\n방정식 기초 (1) ✅\n방정식 기초 (2) ✅\n방정식 심화 (3) ⏳'),
    ('학부모 리포트', GOLD, '3월 리포트 발송 완료\n\n"재능은 있으나 출결이\n불안정합니다.\n방정식 기초부터 보충 중"'),
]

for i, (title, color, desc) in enumerate(cards_data):
    x = 0.5 + i * 3.1
    card(s, x, 4.2, 2.9, 2.8, CARD, color)
    mtext(s, x + 0.15, 4.3, 2.6, 2.6, [
        (title, 16, color, True),
        ('', 4, GRAY, False),
        (desc, 11, LGRAY, False),
    ])

# 핵심
card(s, 0.5, 7.0, 12.3, 0.35, RGBColor(0x25, 0x20, 0x15), ORANGE)
mtext(s, 0.8, 7.0, 11.8, 0.3, [
    ('핵심: 학부모님이 "우리 애 어때요?" 하면 → 학생 프로필 열어서 보여주기만 하면 됩니다', 12, ORANGE, False),
])

# ============================================================
# SLIDE 8: 보드 — 학원 내 업무 관리
# ============================================================
s = prs.slides.add_slide(prs.slide_layouts[6]); bg(s)
box(s, 0.5, 0.3, 12, 0.7, '[ 보드 ]  학원 내 업무 & 일정 관리', 36, GOLD, True)

card(s, 0.5, 1.2, 6.1, 1.5, RGBColor(0x3D, 0x1E, 0x1E), RED)
mtext(s, 0.7, 1.3, 5.7, 1.3, [
    ('이런 상황, 겪어보셨죠?', 16, RED, True),
    ('', 4, GRAY, False),
    ('"원장님이 월말평가 문제 출제하라고 했는데 마감이 언제더라?"', 12, LGRAY, False),
    ('"학부모 상담 일정을 선생님들끼리 조율해야 하는데..."', 12, LGRAY, False),
    ('"카톡 단톡방에서 업무 지시가 묻혀서 까먹었다"', 12, LGRAY, False),
])

card(s, 6.8, 1.2, 6.1, 1.5, RGBColor(0x1E, 0x2D, 0x1E), GREEN)
mtext(s, 7.0, 1.3, 5.7, 1.3, [
    ('WAWA가 해결합니다', 16, GREEN, True),
    ('', 4, GRAY, False),
    ('공지사항: 원장 → 선생님 전달 (핀 고정 가능)', 12, LGRAY, False),
    ('할일(Action Item): 담당자 + 마감일 지정 → 완료 체크', 12, LGRAY, False),
    ('카톡에서 묻히지 않고 마감일 기반으로 관리', 12, LGRAY, False),
])

# 공지 → 할일 흐름
card(s, 0.5, 3.0, 5.8, 4.0, CARD2, GOLD)
mtext(s, 0.7, 3.1, 5.4, 3.8, [
    ('공지사항 예시', 18, GOLD, True),
    ('', 6, GRAY, False),
    ('📌 4월 월말평가 안내  (핀 고정)', 14, WHITE, True),
    ('작성: 협곡원장 | 마감: 4/25', 11, GRAY, False),
    ('', 4, GRAY, False),
    ('4월 25일 수학/영어 월말평가 실시', 12, LGRAY, False),
    ('야스오는 시험 당일 반드시 출석하도록', 12, LGRAY, False),
    ('요네 형에게도 연락 부탁', 12, LGRAY, False),
    ('', 8, GRAY, False),
    ('학부모 상담 주간 (4/21~25)', 14, WHITE, True),
    ('작성: 협곡원장 | 마감: 4/21', 11, GRAY, False),
    ('', 4, GRAY, False),
    ('야스오 → 요네 형 상담 필수', 12, LGRAY, False),
    ('징크스 → 바이 언니 상담', 12, LGRAY, False),
    ('이즈리얼 → 아버지 상담', 12, LGRAY, False),
])

card(s, 6.5, 3.0, 6.3, 4.0, CARD2, BLUE)
mtext(s, 6.7, 3.1, 5.9, 3.8, [
    ('할일 (Action Items)', 18, BLUE, True),
    ('', 6, GRAY, False),
    ('⏳ 수학 월말평가 출제', 13, WHITE, True),
    ('   담당: 하이머딩거 | 마감: 4/20 | 진행중', 11, GRAY, False),
    ('', 4, GRAY, False),
    ('⏳ 영어 월말평가 출제', 13, WHITE, True),
    ('   담당: 소라카 | 마감: 4/20 | 진행중', 11, GRAY, False),
    ('', 4, GRAY, False),
    ('⏳ 학부모 상담 일정 (수학반)', 13, WHITE, True),
    ('   담당: 하이머딩거 | 마감: 4/18 | 진행중', 11, GRAY, False),
    ('', 4, GRAY, False),
    ('⏳ 학부모 상담 일정 (영어반)', 13, WHITE, True),
    ('   담당: 소라카 | 마감: 4/18 | 진행중', 11, GRAY, False),
    ('', 4, GRAY, False),
    ('✅ 야스오 방정식 보충 프린트', 13, GREEN, True),
    ('   담당: 하이머딩거 | 마감: 4/14 | 완료', 11, GREEN, False),
])

# ============================================================
# SLIDE 9: 하루 흐름 총정리
# ============================================================
s = prs.slides.add_slide(prs.slide_layouts[6]); bg(s)
box(s, 0.5, 0.3, 12, 0.7, '선생님의 하루 — WAWA와 함께', 36, GOLD, True)
box(s, 0.5, 0.85, 12, 0.4, '하이머딩거 선생님의 월요일을 따라가봅니다', 15, GRAY, False)

day_flow = [
    ('15:50', '출근', '보드 확인 → 오늘 할일 체크\n"월말평가 문제 출제 마감 4/20"', GOLD, '보드'),
    ('16:00', '1교시 시작', '이즈리얼·럭스 수업 타이머 시작\n럭스 5분 지각 → 자동 기록', BLUE, '수업'),
    ('17:30', '1교시 종료', '수업 완료 → 출석 자동 저장', BLUE, '수업'),
    ('17:40', '교재 확인', '야스오 "방정식 심화 (3)" 프린트 출력\n에코 "시간관리 프린트" 배부 체크', PURPLE, '교재'),
    ('18:00', '2교시 시작', '야스오·아리 수업 시작\n야스오 18:40 외출(5분) → 자동 차감', BLUE, '수업'),
    ('19:30', '2교시 종료', '수업 완료 → 야스오 순수 83분 기록', BLUE, '수업'),
    ('19:35', '보강 확인', '징크스 토요일 보강 메모 확인\n카타리나 보강 미정 → 타론에게 연락', RED, '보강'),
    ('20:00', '3교시 시작', '이렐리아 수업 → 질문 많아 10분 연장', BLUE, '수업'),
    ('21:40', '퇴근', '[퇴근] 버튼 → 미출석 학생 자동 결석\n+ 보강 자동 생성', GREEN, '수업'),
    ('21:45', '리포트', '3월 리포트 미전송 학생 확인\n럭스 리포트 → 가렌 오빠에게 카톡 전송', GREEN, '평가'),
]

for i, (time, title, desc, color, tab) in enumerate(day_flow):
    y = 1.4 + i * 0.57
    # 시간
    box(s, 0.5, y, 0.8, 0.5, time, 12, BLUE, True)
    # 탭 배지
    box(s, 1.35, y, 0.7, 0.5, tab, 9, color, True)
    # 제목
    box(s, 2.1, y, 2.0, 0.5, title, 13, WHITE, True)
    # 설명
    box(s, 4.1, y, 8.8, 0.5, desc.replace('\n', '  |  '), 11, LGRAY, False)

# ============================================================
# SLIDE 10: 시작하기
# ============================================================
s = prs.slides.add_slide(prs.slide_layouts[6]); bg(s)
box(s, 1, 0.8, 11.3, 0.8, 'WAWA Smart ERP', 48, GOLD, True, PP_ALIGN.CENTER)
box(s, 1, 1.7, 11.3, 0.5, '지금 바로 체험해보세요', 24, WHITE, False, PP_ALIGN.CENTER)

# 데모 접속
card(s, 2.5, 2.6, 8.3, 2.5, RGBColor(0x20, 0x20, 0x38), BLUE)
mtext(s, 2.8, 2.7, 7.8, 2.3, [
    ('데모 접속 방법', 20, BLUE, True),
    ('', 6, GRAY, False),
    ('1.  wawa-smart-erp.pages.dev 접속', 15, WHITE, False),
    ('2.  학원 선택: (test)협곡점', 15, WHITE, False),
    ('3.  로그인 (아래 계정 중 선택)', 15, WHITE, False),
    ('', 6, GRAY, False),
    ('협곡원장 / 1234  →  관리자 (전체 기능)', 14, GOLD, False),
    ('하이머딩거 / 1234  →  수학 선생님 (담당 학생 7명)', 14, BLUE, False),
    ('소라카 / 1234  →  영어 선생님 (담당 학생 4명)', 14, GREEN, False),
])

# 기능 요약
card(s, 2.5, 5.4, 8.3, 1.5, CARD2)
mtext(s, 2.8, 5.45, 7.8, 1.4, [
    ('WAWA가 해결하는 것들', 16, GOLD, True),
    ('', 4, GRAY, False),
    ('✓ 수업시간 — 지각·외출·연장 자동 계산, 수기 기록 불필요', 12, LGRAY, False),
    ('✓ 성적/리포트 — 점수 입력 → 리포트 자동 생성 → 학부모 원클릭 전송', 12, LGRAY, False),
    ('✓ 교재 — 학생별 맞춤 프린트 배부·진행 추적', 12, LGRAY, False),
    ('✓ 보강 — 결석 → 보강 자동 생성 → 일정 관리, 학생 많아도 빠짐없이', 12, LGRAY, False),
    ('✓ 학생 피드백 — 출석·성적·프린트 통합 → 학부모 상담 시 한 화면으로', 12, LGRAY, False),
    ('✓ 업무 관리 — 공지·할일 마감일 기반 관리, 카톡에서 안 묻힘', 12, LGRAY, False),
])

# 저장
out = '/mnt/g/progress/wawa/wawa_smart_erp/docs/WAWA_ERP_유즈케이스_선생님가이드.pptx'
prs.save(out)
print(f'PPT saved: {out}')
print(f'Slides: {len(prs.slides)}')
