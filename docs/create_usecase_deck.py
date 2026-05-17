"""WAWA ERP Use Case Deck — 페르소나 · 여정 · 플로우 (15 slides)"""
from pptx import Presentation
from pptx.util import Inches, Pt, Emu
from pptx.dml.color import RGBColor
from pptx.enum.shapes import MSO_SHAPE, MSO_CONNECTOR
from pptx.enum.text import PP_ALIGN

NAVY = RGBColor(0x0A, 0x1F, 0x44)
CORAL = RGBColor(0xFF, 0x6B, 0x6B)
LIGHT = RGBColor(0xF5, 0xF7, 0xFA)
GRAY = RGBColor(0x6B, 0x72, 0x80)
WHITE = RGBColor(0xFF, 0xFF, 0xFF)
ACCENT = RGBColor(0x4A, 0x90, 0xE2)
GREEN = RGBColor(0x2E, 0xB8, 0x7C)
YELLOW = RGBColor(0xFF, 0xC1, 0x07)

prs = Presentation()
prs.slide_width = Inches(13.333)
prs.slide_height = Inches(7.5)
SW, SH = prs.slide_width, prs.slide_height
BLANK = prs.slide_layouts[6]


def set_fill(shape, color):
    shape.fill.solid()
    shape.fill.fore_color.rgb = color
    shape.line.fill.background()


def add_text(slide, x, y, w, h, text, *, size=16, bold=False, color=NAVY, align=PP_ALIGN.LEFT, font='Pretendard'):
    tb = slide.shapes.add_textbox(x, y, w, h)
    tf = tb.text_frame
    tf.word_wrap = True
    tf.margin_left = tf.margin_right = Emu(0)
    tf.margin_top = tf.margin_bottom = Emu(0)
    p = tf.paragraphs[0]
    p.alignment = align
    run = p.add_run()
    run.text = text
    run.font.name = font
    run.font.size = Pt(size)
    run.font.bold = bold
    run.font.color.rgb = color
    return tb


def add_bullets(slide, x, y, w, h, items, *, size=13, color=NAVY, font='Pretendard', space=6):
    tb = slide.shapes.add_textbox(x, y, w, h)
    tf = tb.text_frame
    tf.word_wrap = True
    for i, item in enumerate(items):
        p = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
        p.alignment = PP_ALIGN.LEFT
        p.space_after = Pt(space)
        run = p.add_run()
        run.text = f"•  {item}"
        run.font.name = font
        run.font.size = Pt(size)
        run.font.color.rgb = color
    return tb


def add_rect(slide, x, y, w, h, color, line=False):
    r = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, x, y, w, h)
    set_fill(r, color)
    if not line:
        r.line.fill.background()
    return r


def add_rounded(slide, x, y, w, h, color):
    r = slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, x, y, w, h)
    set_fill(r, color)
    return r


def add_oval(slide, x, y, w, h, color):
    r = slide.shapes.add_shape(MSO_SHAPE.OVAL, x, y, w, h)
    set_fill(r, color)
    return r


def add_header(slide, title, subtitle=None):
    add_rect(slide, 0, 0, SW, Inches(0.08), CORAL)
    add_text(slide, Inches(0.6), Inches(0.3), Inches(12), Inches(0.7), title, size=26, bold=True, color=NAVY)
    if subtitle:
        add_text(slide, Inches(0.6), Inches(0.95), Inches(12), Inches(0.4), subtitle, size=13, color=GRAY)
    add_rect(slide, Inches(0.6), Inches(1.4), Inches(0.6), Inches(0.04), CORAL)


def add_page(slide, n, total=15):
    add_text(slide, Inches(12.5), Inches(7.1), Inches(0.6), Inches(0.3), f"{n:02d} / {total:02d}",
             size=10, color=GRAY, align=PP_ALIGN.RIGHT)


def arrow_right(slide, x, y, w, h=Inches(0.35), color=CORAL):
    a = slide.shapes.add_shape(MSO_SHAPE.RIGHT_ARROW, x, y, w, h)
    set_fill(a, color)
    return a


# =============================================================
# Slide 1 — Cover
# =============================================================
s = prs.slides.add_slide(BLANK)
add_rect(s, 0, 0, SW, SH, NAVY)
add_rect(s, 0, Inches(3.0), SW, Inches(0.06), CORAL)
add_text(s, Inches(0.8), Inches(1.9), Inches(12), Inches(0.7), "WAWA ERP", size=52, bold=True, color=WHITE)
add_text(s, Inches(0.8), Inches(3.3), Inches(12), Inches(0.7), "Use Cases & User Journeys", size=32, color=WHITE)
add_text(s, Inches(0.8), Inches(4.2), Inches(12), Inches(0.5),
         "페르소나 3종  ·  유즈케이스 10개  ·  End-to-End 플로우", size=16, color=CORAL)
add_text(s, Inches(0.8), Inches(6.5), Inches(8), Inches(0.4), "Companion to IR Deck  ·  2026.04", size=12, color=WHITE)

# =============================================================
# Slide 2 — 페르소나 3종
# =============================================================
s = prs.slides.add_slide(BLANK)
add_header(s, "Personas", "누가 이 제품을 쓰는가")

personas = [
    ("원장", "박선영", "협곡점 대표\n학생 60명 · 선생 3명",
     "매출·출결·선생 성과를\n한 화면에서 보고 싶다", CORAL),
    ("선생", "김민수", "수학 담당\n학생 20명 케어",
     "담당 학생의 성적·숙제·\n상담 맥락을 잃지 않기", ACCENT),
    ("학부모", "이지연", "중2 자녀\n학원비 월 40만원 지출",
     "내 아이가 잘 하고 있다는\n증거를 정기적으로 받기", GREEN),
]
cw, gap = Inches(4.0), Inches(0.15)
for i, (role, name, profile, jtbd, color) in enumerate(personas):
    x = Inches(0.6) + (cw + gap) * i
    add_rect(s, x, Inches(1.9), cw, Inches(5.0), LIGHT)
    add_rect(s, x, Inches(1.9), cw, Inches(0.15), color)
    avatar = add_oval(s, x + Inches(1.4), Inches(2.25), Inches(1.2), Inches(1.2), color)
    add_text(s, x, Inches(3.6), cw, Inches(0.4), role, size=13, bold=True, color=color, align=PP_ALIGN.CENTER)
    add_text(s, x, Inches(4.05), cw, Inches(0.6), name, size=26, bold=True, color=NAVY, align=PP_ALIGN.CENTER)
    add_text(s, x, Inches(4.8), cw, Inches(0.7), profile, size=12, color=GRAY, align=PP_ALIGN.CENTER)
    add_rect(s, x + Inches(0.4), Inches(5.75), cw - Inches(0.8), Emu(8000), color)
    add_text(s, x, Inches(5.9), cw, Inches(0.4), "Job-to-be-Done", size=11, color=color, bold=True, align=PP_ALIGN.CENTER)
    add_text(s, x, Inches(6.3), cw, Inches(0.6), jtbd, size=12, color=NAVY, align=PP_ALIGN.CENTER)

add_page(s, 2)

# =============================================================
# Slide 3 — Journey Map: 원장
# =============================================================
s = prs.slides.add_slide(BLANK)
add_header(s, "Journey · 원장 박선영", "매일~매월 · 운영 의사결정 사이클")

stages = [
    ("매일 아침", "출결 대시보드 체크", "미입실 학생 확인", YELLOW),
    ("주 1회", "선생별 수업 시간 집계", "과부하·공백 조정", ACCENT),
    ("월 1회", "반별 성적 추이", "부담 재배분 결정", CORAL),
    ("월말", "학원 사용량 · ARPU", "요금제 상향 판단", GREEN),
]
bar_y = Inches(3.5)
bar_h = Inches(0.08)
add_rect(s, Inches(0.8), bar_y, Inches(11.7), bar_h, GRAY)

sw = Inches(2.75)
for i, (time, action, outcome, color) in enumerate(stages):
    cx = Inches(0.8) + Inches(0.5) + sw * i
    add_oval(s, cx - Inches(0.25), bar_y - Inches(0.17), Inches(0.5), Inches(0.5), color)
    add_text(s, cx - Inches(1.0), Inches(2.3), Inches(2.0), Inches(0.4), time, size=13, bold=True, color=color, align=PP_ALIGN.CENTER)
    add_rect(s, cx - Inches(1.2), Inches(2.75), Inches(2.4), Inches(0.5), LIGHT)
    add_text(s, cx - Inches(1.2), Inches(2.85), Inches(2.4), Inches(0.4), action, size=11, color=NAVY, align=PP_ALIGN.CENTER, bold=True)
    add_text(s, cx - Inches(1.2), Inches(4.3), Inches(2.4), Inches(0.6), outcome, size=11, color=GRAY, align=PP_ALIGN.CENTER)

# 결과
add_rect(s, Inches(0.6), Inches(5.8), Inches(12.1), Inches(1.2), LIGHT)
add_text(s, Inches(0.9), Inches(5.95), Inches(12), Inches(0.4), "결과", size=13, bold=True, color=CORAL)
add_text(s, Inches(0.9), Inches(6.4), Inches(12), Inches(0.5),
         "수기 엑셀 집계 3시간/월  →  대시보드 5분. 의사결정 근거가 숫자로 남음.",
         size=14, color=NAVY)

add_page(s, 3)

# =============================================================
# Slide 4 — Journey Map: 선생
# =============================================================
s = prs.slides.add_slide(BLANK)
add_header(s, "Journey · 선생 김민수", "매일~매월 · 학생 케어 사이클")

stages = [
    ("수업 시작", "타이머 on\n자동 출결", YELLOW),
    ("수업 중", "가챠 카드\n개념 복습", ACCENT),
    ("수업 후", "숙제 배포\n상담 메모", CORAL),
    ("주말", "결석 보강\n일정 관리", GREEN),
    ("월말", "AI 리포트\n5분 검토", NAVY),
]
bar_y = Inches(3.5)
add_rect(s, Inches(0.8), bar_y, Inches(11.7), Inches(0.08), GRAY)

sw = Inches(11.7) / 5
for i, (time, action, color) in enumerate(stages):
    cx = Inches(0.8) + sw * i + sw / 2
    add_oval(s, cx - Inches(0.25), bar_y - Inches(0.17), Inches(0.5), Inches(0.5), color)
    add_text(s, cx - Inches(1.0), Inches(2.3), Inches(2.0), Inches(0.4), time, size=13, bold=True, color=color, align=PP_ALIGN.CENTER)
    add_rect(s, cx - Inches(1.1), Inches(4.0), Inches(2.2), Inches(1.3), LIGHT)
    add_text(s, cx - Inches(1.1), Inches(4.15), Inches(2.2), Inches(1.1), action, size=12, color=NAVY, align=PP_ALIGN.CENTER, bold=True)

add_rect(s, Inches(0.6), Inches(5.8), Inches(12.1), Inches(1.2), LIGHT)
add_text(s, Inches(0.9), Inches(5.95), Inches(12), Inches(0.4), "결과", size=13, bold=True, color=CORAL)
add_text(s, Inches(0.9), Inches(6.4), Inches(12), Inches(0.5),
         "리포트 작성 주 5시간 → 30분. 학생 맥락이 제품에 남고 선생 교체에도 안 사라진다.",
         size=14, color=NAVY)

add_page(s, 4)

# =============================================================
# Slide 5 — Journey Map: 학부모
# =============================================================
s = prs.slides.add_slide(BLANK)
add_header(s, "Journey · 학부모 이지연", "불안 → 신뢰로 가는 사이클")

# 감정 곡선 Before
add_text(s, Inches(0.6), Inches(1.9), Inches(5.5), Inches(0.4), "Before WAWA", size=14, bold=True, color=GRAY)
before = [
    "월초 — 학원비 40만원 결제. '잘 하고 있는 거 맞나?'",
    "월중 — 가끔 카톡 사진 1~2장. 진짜 상태는 모름",
    "월말 — 시험 성적 떨어지면 뒤늦게 발견",
    "→ 상시 불안 · 학원 이탈 고민",
]
add_bullets(s, Inches(0.6), Inches(2.35), Inches(5.8), Inches(3.0), before, size=12, color=GRAY)

# After
add_rect(s, Inches(6.8), Inches(1.9), Inches(6.0), Inches(0.04), CORAL)
add_text(s, Inches(6.8), Inches(1.9), Inches(5.5), Inches(0.4), "After WAWA", size=14, bold=True, color=CORAL)
after = [
    "매주 — 학부모 앱 푸시: 출결·숙제·가챠 수집",
    "상시 — 결석·지각 알림톡 실시간 수신",
    "월말 — AI 리포트 알림톡 → 성적 그래프 + 종합평",
    "→ 증거 기반 신뢰 · 리텐션 상승",
]
add_bullets(s, Inches(6.8), Inches(2.35), Inches(6.0), Inches(3.0), after, size=12, color=NAVY)

# 핵심 지표
add_rect(s, Inches(0.6), Inches(5.5), Inches(12.1), Inches(1.6), LIGHT)
add_text(s, Inches(0.9), Inches(5.65), Inches(12), Inches(0.4), "핵심 가치", size=13, bold=True, color=CORAL)
add_text(s, Inches(0.9), Inches(6.1), Inches(12), Inches(0.5),
         "학부모가 학원비를 '아깝지 않다'고 느끼게 만드는 정기적 증거 파이프라인.",
         size=14, color=NAVY)
add_text(s, Inches(0.9), Inches(6.6), Inches(12), Inches(0.5),
         "목표 지표  ·  학부모 앱 WAU 60%+  ·  알림톡 열람률 80%+  ·  학원 재등록률 +15%p",
         size=12, color=GRAY)
add_page(s, 5)

# =============================================================
# Slide 6 — UC-1~3 원장 플로우
# =============================================================
s = prs.slides.add_slide(BLANK)
add_header(s, "Use Cases · 원장", "UC-1 ~ UC-3")

ucs = [
    ("UC-1", "월말 운영 리뷰",
     "대시보드 → 사용량 → 반별 성적 → 출결률 → 선생별 수업시간",
     "수기 3시간 → 5분", CORAL),
    ("UC-2", "신규 선생 온보딩",
     "초대 코드 생성 → PIN 가입 → 담당 학생 배정 → 권한 자동 격리",
     "종이 계약 + 엑셀 권한 → 3분", ACCENT),
    ("UC-3", "학원비 미납 대응",
     "전사 결제 연동 → 실패 리스트 → 학부모 알림톡 자동 → 상태 추적",
     "수기 체크 → 자동화", GREEN),
]
y = Inches(1.9)
for code, title, flow, value, color in ucs:
    add_rect(s, Inches(0.6), y, Inches(1.3), Inches(1.5), color)
    add_text(s, Inches(0.6), y + Inches(0.45), Inches(1.3), Inches(0.4), code, size=15, bold=True, color=WHITE, align=PP_ALIGN.CENTER)
    add_text(s, Inches(0.6), y + Inches(0.85), Inches(1.3), Inches(0.3), "원장", size=10, color=WHITE, align=PP_ALIGN.CENTER)
    add_rect(s, Inches(2.0), y, Inches(10.7), Inches(1.5), LIGHT)
    add_text(s, Inches(2.2), y + Inches(0.15), Inches(10), Inches(0.4), title, size=17, bold=True, color=NAVY)
    add_text(s, Inches(2.2), y + Inches(0.65), Inches(10), Inches(0.4), flow, size=12, color=GRAY)
    add_text(s, Inches(2.2), y + Inches(1.1), Inches(10), Inches(0.35), f"가치  ·  {value}", size=12, bold=True, color=color)
    y += Inches(1.65)
add_page(s, 6)

# =============================================================
# Slide 7 — UC-4~6 선생 플로우
# =============================================================
s = prs.slides.add_slide(BLANK)
add_header(s, "Use Cases · 선생", "UC-4 ~ UC-6")

ucs = [
    ("UC-4", "수업 시작 (출결)",
     "타이머 시작 → 자동 출석 → 결석자 학부모 카톡 자동",
     "종이 출석부 → 실시간", CORAL),
    ("UC-5", "숙제 배포 → 채점",
     "숙제 생성 → 학생별 제출 확인 → 채점 → 피드백",
     "카톡 사진 → 구조화 워크플로우", ACCENT),
    ("UC-6", "학생 상담 준비",
     "프로필 열기 → 성적 + 출결 + 가챠 + 이전 상담 메모 한 화면",
     "맥락 유실 0 · 인수인계 자동", GREEN),
]
y = Inches(1.9)
for code, title, flow, value, color in ucs:
    add_rect(s, Inches(0.6), y, Inches(1.3), Inches(1.5), color)
    add_text(s, Inches(0.6), y + Inches(0.45), Inches(1.3), Inches(0.4), code, size=15, bold=True, color=WHITE, align=PP_ALIGN.CENTER)
    add_text(s, Inches(0.6), y + Inches(0.85), Inches(1.3), Inches(0.3), "선생", size=10, color=WHITE, align=PP_ALIGN.CENTER)
    add_rect(s, Inches(2.0), y, Inches(10.7), Inches(1.5), LIGHT)
    add_text(s, Inches(2.2), y + Inches(0.15), Inches(10), Inches(0.4), title, size=17, bold=True, color=NAVY)
    add_text(s, Inches(2.2), y + Inches(0.65), Inches(10), Inches(0.4), flow, size=12, color=GRAY)
    add_text(s, Inches(2.2), y + Inches(1.1), Inches(10), Inches(0.35), f"가치  ·  {value}", size=12, bold=True, color=color)
    y += Inches(1.65)
add_page(s, 7)

# =============================================================
# Slide 8 — UC-7~8 선생 플로우 2
# =============================================================
s = prs.slides.add_slide(BLANK)
add_header(s, "Use Cases · 선생 (cont.)", "UC-7 ~ UC-8")

ucs = [
    ("UC-7", "월말 AI 리포트",
     "학생 선택 → Gemini 초안 → 선생 5분 검토 → 학부모 전송",
     "선생 5시간/주 → 30분", CORAL),
    ("UC-8", "결석 보강 스케줄링",
     "결석 기록 → 보강 날짜 지정 → 학부모 알림 → 완료 자동 전이",
     "종이 메모 → 자동 추적", ACCENT),
]
y = Inches(1.9)
for code, title, flow, value, color in ucs:
    add_rect(s, Inches(0.6), y, Inches(1.3), Inches(1.7), color)
    add_text(s, Inches(0.6), y + Inches(0.55), Inches(1.3), Inches(0.4), code, size=15, bold=True, color=WHITE, align=PP_ALIGN.CENTER)
    add_text(s, Inches(0.6), y + Inches(0.95), Inches(1.3), Inches(0.3), "선생", size=10, color=WHITE, align=PP_ALIGN.CENTER)
    add_rect(s, Inches(2.0), y, Inches(10.7), Inches(1.7), LIGHT)
    add_text(s, Inches(2.2), y + Inches(0.2), Inches(10), Inches(0.4), title, size=17, bold=True, color=NAVY)
    add_text(s, Inches(2.2), y + Inches(0.75), Inches(10), Inches(0.4), flow, size=12, color=GRAY)
    add_text(s, Inches(2.2), y + Inches(1.25), Inches(10), Inches(0.35), f"가치  ·  {value}", size=12, bold=True, color=color)
    y += Inches(1.9)

# 하단 강조
add_rect(s, Inches(0.6), Inches(5.9), Inches(12.1), Inches(1.1), NAVY)
add_text(s, Inches(0.9), Inches(6.05), Inches(12), Inches(0.4), "가장 강력한 가치 제안", size=12, bold=True, color=CORAL)
add_text(s, Inches(0.9), Inches(6.5), Inches(12), Inches(0.4),
         "UC-7 AI 리포트 하나만으로 선생 월 80시간 절약 — 이것이 학원당 월 2만원의 근거.",
         size=14, bold=True, color=WHITE)
add_page(s, 8)

# =============================================================
# Slide 9 — UC-9~10 학부모 플로우
# =============================================================
s = prs.slides.add_slide(BLANK)
add_header(s, "Use Cases · 학부모", "UC-9 ~ UC-10")

ucs = [
    ("UC-9", "주간 학습 현황",
     "푸시 알림 → 대시보드 → 출결 + 숙제 완료율 + 가챠 + AI 코멘트",
     "카톡 사진 → 정기 증거 수령", GREEN),
    ("UC-10", "월말 AI 리포트 수신",
     "알림톡 링크 → 리포트 이미지 → 성적 그래프 + AI 종합평",
     "학원비가 아깝지 않다는 증거", CORAL),
]
y = Inches(1.9)
for code, title, flow, value, color in ucs:
    add_rect(s, Inches(0.6), y, Inches(1.3), Inches(1.7), color)
    add_text(s, Inches(0.6), y + Inches(0.55), Inches(1.3), Inches(0.4), code, size=15, bold=True, color=WHITE, align=PP_ALIGN.CENTER)
    add_text(s, Inches(0.6), y + Inches(0.95), Inches(1.3), Inches(0.3), "학부모", size=10, color=WHITE, align=PP_ALIGN.CENTER)
    add_rect(s, Inches(2.0), y, Inches(10.7), Inches(1.7), LIGHT)
    add_text(s, Inches(2.2), y + Inches(0.2), Inches(10), Inches(0.4), title, size=17, bold=True, color=NAVY)
    add_text(s, Inches(2.2), y + Inches(0.75), Inches(10), Inches(0.4), flow, size=12, color=GRAY)
    add_text(s, Inches(2.2), y + Inches(1.25), Inches(10), Inches(0.35), f"가치  ·  {value}", size=12, bold=True, color=color)
    y += Inches(1.9)

add_rect(s, Inches(0.6), Inches(5.9), Inches(12.1), Inches(1.1), LIGHT)
add_text(s, Inches(0.9), Inches(6.05), Inches(12), Inches(0.4), "리텐션 레버", size=12, bold=True, color=CORAL)
add_text(s, Inches(0.9), Inches(6.5), Inches(12), Inches(0.4),
         "학부모 만족이 학원 재등록률을 끌어올린다 → 학원은 WAWA를 계속 쓴다 (NRR 115%+ 근거).",
         size=13, color=NAVY)
add_page(s, 9)

# =============================================================
# Slide 10 — Flow A: 월말 리포트 E2E
# =============================================================
s = prs.slides.add_slide(BLANK)
add_header(s, "Flow A · 월말 리포트 End-to-End", "UC-7  ·  핵심 파이프라인")

steps = [
    ("선생", "월말평가\n성적 입력", ACCENT),
    ("시스템", "성적·출결·가챠\n숙제 집계", NAVY),
    ("Gemini", "초안 생성", CORAL),
    ("선생", "5분 검토\n·수정", ACCENT),
    ("시스템", "이미지 렌더\nR2 저장", NAVY),
    ("학부모", "알림톡 수신\n리포트 열람", GREEN),
]
box_w = Inches(1.95)
gap = Inches(0.08)
total = box_w * 6 + gap * 5
start_x = (SW - total) / 2
y = Inches(3.2)
for i, (actor, action, color) in enumerate(steps):
    x = start_x + (box_w + gap) * i
    add_rect(s, x, y, box_w, Inches(1.5), LIGHT)
    add_rect(s, x, y, box_w, Inches(0.35), color)
    add_text(s, x, y + Inches(0.04), box_w, Inches(0.3), actor, size=12, bold=True, color=WHITE, align=PP_ALIGN.CENTER)
    add_text(s, x, y + Inches(0.55), box_w, Inches(0.9), action, size=12, color=NAVY, align=PP_ALIGN.CENTER, bold=True)
    if i < 5:
        arrow_right(s, x + box_w - Inches(0.02), y + Inches(0.6), gap + Inches(0.08), Inches(0.35), CORAL)

# 성과 박스
add_rect(s, Inches(0.6), Inches(5.5), Inches(6.0), Inches(1.4), LIGHT)
add_text(s, Inches(0.9), Inches(5.65), Inches(5.5), Inches(0.4), "기존 방식", size=12, bold=True, color=GRAY)
add_text(s, Inches(0.9), Inches(6.1), Inches(5.5), Inches(0.7), "선생이 손으로 작성 · 주 5시간\n학부모마다 다른 포맷",
         size=12, color=GRAY)

add_rect(s, Inches(6.8), Inches(5.5), Inches(6.0), Inches(1.4), NAVY)
add_text(s, Inches(7.1), Inches(5.65), Inches(5.5), Inches(0.4), "WAWA 적용 후", size=12, bold=True, color=CORAL)
add_text(s, Inches(7.1), Inches(6.1), Inches(5.5), Inches(0.7),
         "선생 30분 · AI 초안 + 5분 검토\n학부모 알림톡 자동 · 일관된 포맷",
         size=12, color=WHITE)
add_page(s, 10)

# =============================================================
# Slide 11 — Flow B: 선생 교체 인수인계
# =============================================================
s = prs.slides.add_slide(BLANK)
add_header(s, "Flow B · 선생 교체 인수인계", "UC-6  ·  담당 학생 데이터 무손실 이관")

steps = [
    ("원장", "선생 퇴사\n처리", CORAL),
    ("시스템", "담당 학생\n재배정 모달", NAVY),
    ("원장", "새 선생에게\n일괄 할당", CORAL),
    ("시스템", "상담메모+성적\n+가챠 자동 이관", NAVY),
    ("새 선생", "프로필 열람\n맥락 파악", ACCENT),
]
box_w = Inches(2.35)
gap = Inches(0.08)
total = box_w * 5 + gap * 4
start_x = (SW - total) / 2
y = Inches(2.5)
for i, (actor, action, color) in enumerate(steps):
    x = start_x + (box_w + gap) * i
    add_rect(s, x, y, box_w, Inches(1.5), LIGHT)
    add_rect(s, x, y, box_w, Inches(0.35), color)
    add_text(s, x, y + Inches(0.04), box_w, Inches(0.3), actor, size=12, bold=True, color=WHITE, align=PP_ALIGN.CENTER)
    add_text(s, x, y + Inches(0.55), box_w, Inches(0.9), action, size=12, color=NAVY, align=PP_ALIGN.CENTER, bold=True)
    if i < 4:
        arrow_right(s, x + box_w - Inches(0.02), y + Inches(0.6), gap + Inches(0.08), Inches(0.35), CORAL)

# 이관되는 데이터
add_text(s, Inches(0.8), Inches(4.6), Inches(12), Inches(0.5), "자동 이관되는 학생 컨텍스트", size=14, bold=True, color=NAVY)
items = [
    ("성적 이력", "과목별 월별 점수 추이 · AI 리포트 히스토리", CORAL),
    ("출결 & 보강", "결석 사유 · 보강 완료 여부 · 학부모 소통 로그", ACCENT),
    ("가챠 & 숙제", "수집 카드 · 개념 이해도 · 숙제 제출률", GREEN),
    ("상담 메모", "'엄마 예민함, 수학 약함' 같은 선생 사이드 메모", NAVY),
]
cw = Inches(2.92)
for i, (t, d, c) in enumerate(items):
    x = Inches(0.6) + (cw + Inches(0.1)) * i
    add_rect(s, x, Inches(5.2), cw, Inches(1.7), LIGHT)
    add_rect(s, x, Inches(5.2), cw, Inches(0.1), c)
    add_text(s, x + Inches(0.2), Inches(5.35), cw - Inches(0.4), Inches(0.4), t, size=13, bold=True, color=NAVY)
    add_text(s, x + Inches(0.2), Inches(5.85), cw - Inches(0.4), Inches(1.0), d, size=10, color=GRAY)
add_page(s, 11)

# =============================================================
# Slide 12 — Flow C: 결석→보강→학부모 알림
# =============================================================
s = prs.slides.add_slide(BLANK)
add_header(s, "Flow C · 결석 → 보강 → 학부모 알림", "UC-4 + UC-8  ·  실시간 트리거 체인")

# 2단 플로우
row1 = [
    ("선생", "타이머 시작", ACCENT),
    ("시스템", "미입실 감지\n(10분)", NAVY),
    ("학부모", "자동 알림톡\n'자녀 미입실'", CORAL),
    ("학부모", "결석 사유\n응답", GREEN),
]
row2 = [
    ("선생", "보강 일정\n지정", ACCENT),
    ("학부모", "보강 확정\n알림톡", CORAL),
    ("보강일", "선생 완료\n체크", ACCENT),
    ("시스템", "makeup_done\n전이", NAVY),
]

def draw_row(steps, y):
    box_w = Inches(2.75)
    gap = Inches(0.15)
    total = box_w * 4 + gap * 3
    start = (SW - total) / 2
    for i, (actor, action, color) in enumerate(steps):
        x = start + (box_w + gap) * i
        add_rect(s, x, y, box_w, Inches(1.3), LIGHT)
        add_rect(s, x, y, box_w, Inches(0.3), color)
        add_text(s, x, y + Inches(0.03), box_w, Inches(0.3), actor, size=11, bold=True, color=WHITE, align=PP_ALIGN.CENTER)
        add_text(s, x, y + Inches(0.45), box_w, Inches(0.8), action, size=12, color=NAVY, align=PP_ALIGN.CENTER, bold=True)
        if i < 3:
            arrow_right(s, x + box_w - Inches(0.02), y + Inches(0.5), gap + Inches(0.1), Inches(0.3), CORAL)

draw_row(row1, Inches(2.0))
# 내려가는 화살표
arr = s.shapes.add_shape(MSO_SHAPE.DOWN_ARROW, Inches(6.4), Inches(3.45), Inches(0.5), Inches(0.6))
set_fill(arr, CORAL)
draw_row(row2, Inches(4.3))

add_rect(s, Inches(0.6), Inches(6.0), Inches(12.1), Inches(1.0), NAVY)
add_text(s, Inches(0.9), Inches(6.15), Inches(12), Inches(0.4), "핵심", size=12, bold=True, color=CORAL)
add_text(s, Inches(0.9), Inches(6.55), Inches(12), Inches(0.4),
         "선생 액션 하나로 3명(학생·선생·학부모)의 워크플로우가 자동 연결된다.",
         size=14, color=WHITE)
add_page(s, 12)

# =============================================================
# Slide 13 — KPI Matrix
# =============================================================
s = prs.slides.add_slide(BLANK)
add_header(s, "Success Metrics", "유즈케이스별 측정 가능한 성공 지표")

headers = ["UC", "지표", "현재 기준선", "목표"]
rows = [
    ["UC-1", "대시보드 도달 시간", "—", "< 5초"],
    ["UC-2", "초대→첫 수업", "1~3일", "< 1일"],
    ["UC-4", "미입실 알림 지연", "30분+", "< 3분"],
    ["UC-7", "리포트 작성 시간", "30분/학생", "5분/학생"],
    ["UC-9", "학부모 앱 WAU", "—", "60%+"],
    ["UC-10", "알림톡 열람률", "—", "80%+"],
]
col_w = [Inches(1.8), Inches(5.0), Inches(3.0), Inches(2.9)]
x0, y0 = Inches(0.6), Inches(2.0)

x = x0
for i, h in enumerate(headers):
    add_rect(s, x, y0, col_w[i], Inches(0.6), NAVY)
    add_text(s, x, y0 + Inches(0.12), col_w[i], Inches(0.5), h, size=14, bold=True, color=WHITE, align=PP_ALIGN.CENTER)
    x += col_w[i]

y = y0 + Inches(0.6)
for ri, row in enumerate(rows):
    x = x0
    bg = LIGHT if ri % 2 == 0 else WHITE
    for i, cell in enumerate(row):
        add_rect(s, x, y, col_w[i], Inches(0.55), bg)
        color = CORAL if i == 0 else (NAVY if i != 3 else CORAL)
        add_text(s, x, y + Inches(0.14), col_w[i], Inches(0.5), cell,
                 size=13, bold=(i == 0 or i == 3), color=color, align=PP_ALIGN.CENTER)
        x += col_w[i]
    y += Inches(0.55)

add_text(s, Inches(0.6), Inches(6.7), Inches(12), Inches(0.4),
         "* 현재 기준선 '—' 항목은 파일럿 단계에서 수집 예정.", size=11, color=GRAY)
add_page(s, 13)

# =============================================================
# Slide 14 — Edge Cases
# =============================================================
s = prs.slides.add_slide(BLANK)
add_header(s, "Edge Cases", "실패 시나리오와 대응")

cases = [
    ("네트워크 끊김 중 수업", "타이머 로컬 캐싱 · 복귀 시 자동 동기화", YELLOW),
    ("월 중간 선생 퇴사", "해당 월 리포트는 전 선생 기록 유지 · 다음 달부터 새 선생", CORAL),
    ("학부모 번호 오류", "알림톡 실패 시 원장 알림 + 수동 연락 fallback", ACCENT),
    ("AI 리포트 부정확", "선생 수정 권한 · 수정 이력 표시 (AI 초안 + 선생 5곳 수정)", GREEN),
    ("학원 이용 기간 만료", "로그인 시 403 + 결제 페이지 리다이렉트", NAVY),
    ("KV/R2 한도 터짐", "in-memory fallback · 관리자 즉시 알림 · 자동 degrade", CORAL),
]
cw = Inches(6.0)
for i, (t, d, c) in enumerate(cases):
    col = i % 2
    row = i // 2
    x = Inches(0.6) + (cw + Inches(0.15)) * col
    y = Inches(1.9) + Inches(1.5) * row
    add_rect(s, x, y, cw, Inches(1.35), LIGHT)
    add_rect(s, x, y, Inches(0.1), Inches(1.35), c)
    add_text(s, x + Inches(0.3), y + Inches(0.15), cw - Inches(0.5), Inches(0.45), t, size=14, bold=True, color=NAVY)
    add_text(s, x + Inches(0.3), y + Inches(0.7), cw - Inches(0.5), Inches(0.6), d, size=11, color=GRAY)
add_page(s, 14)

# =============================================================
# Slide 15 — Closing
# =============================================================
s = prs.slides.add_slide(BLANK)
add_rect(s, 0, 0, SW, SH, NAVY)
add_rect(s, 0, Inches(3.3), SW, Inches(0.06), CORAL)
add_text(s, Inches(0.8), Inches(2.2), Inches(12), Inches(0.8), "모든 유즈케이스가 하나의 주장으로 수렴한다.", size=32, bold=True, color=WHITE)
add_text(s, Inches(0.8), Inches(3.6), Inches(12), Inches(0.7), "선생의 시간을 학생에게 돌려드립니다.", size=26, color=CORAL)

add_text(s, Inches(0.8), Inches(5.5), Inches(12), Inches(0.4), "Next Steps", size=13, bold=True, color=CORAL)
nexts = [
    "파일럿 학원 3곳 UC-7 (AI 리포트) A/B 측정",
    "학부모 앱 UC-9, UC-10 베타 출시 (Q3 2026)",
    "Edge Case 5/6 운영 플레이북 문서화",
]
add_bullets(s, Inches(0.8), Inches(5.95), Inches(12), Inches(2.0), nexts, size=14, color=WHITE)
add_page(s, 15)

# =============================================================
out = '/mnt/g/progress/wawa/wawa_smart_erp/docs/WAWA_ERP_UseCases.pptx'
prs.save(out)
print(f"✅ Saved: {out}")
print(f"   Slides: {len(prs.slides)}")
