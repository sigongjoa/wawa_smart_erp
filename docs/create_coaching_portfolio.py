"""
WAWA Smart ERP — Premium Coaching Portfolio PPT (v3)
Editorial design: one message per slide, generous whitespace,
hero screenshots, warm minimal palette.
"""
from pptx import Presentation
from pptx.util import Inches, Pt, Emu
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN
from pptx.enum.shapes import MSO_SHAPE
from PIL import Image
import os

prs = Presentation()
prs.slide_width  = Inches(13.333)
prs.slide_height = Inches(7.5)
SW = prs.slide_width
SH = prs.slide_height
BLANK = prs.slide_layouts[6]

SHOTS    = "/mnt/g/progress/wawa/wawa_smart_erp/docs/screenshots"
PAGES    = os.path.join(SHOTS, "pages")
OUT      = "/mnt/g/progress/wawa/wawa_smart_erp/docs/WAWA_Coaching_Portfolio.pptx"

# ── Palette ──────────────────────────────────
# Warm cream base + charcoal type + single gold accent
# Additional colors used sparingly for functional badges only
CREAM      = RGBColor(0xFA, 0xF8, 0xF3)
OFF_WHITE  = RGBColor(0xF4, 0xF1, 0xEB)
WHITE      = RGBColor(0xFF, 0xFF, 0xFF)
INK        = RGBColor(0x1C, 0x1C, 0x1E)    # titles
BODY       = RGBColor(0x3A, 0x3A, 0x3C)    # body text
CAPTION    = RGBColor(0x8E, 0x8E, 0x93)    # captions, labels
MUTED      = RGBColor(0xB5, 0xB0, 0xA7)    # dividers, light text
SAND       = RGBColor(0xD6, 0xD1, 0xC7)    # card borders
GOLD       = RGBColor(0xBF, 0x94, 0x5F)    # primary accent
GOLD_LIGHT = RGBColor(0xE8, 0xD5, 0xB5)    # accent bg tint
SLATE      = RGBColor(0x5A, 0x6A, 0x7A)    # functional badge (blue-gray)
FERN       = RGBColor(0x6B, 0x8F, 0x71)    # functional badge (green)
CLAY       = RGBColor(0xB8, 0x6B, 0x62)    # functional badge (red)

FN = "Pretendard"


# ── Drawing primitives ───────────────────────
def _bg(slide, color=CREAM):
    slide.background.fill.solid()
    slide.background.fill.fore_color.rgb = color

def _rect(s, x, y, w, h, fill, line=False):
    r = s.shapes.add_shape(MSO_SHAPE.RECTANGLE, x, y, w, h)
    r.fill.solid(); r.fill.fore_color.rgb = fill
    if not line: r.line.fill.background()
    r.shadow.inherit = False
    return r

def _rrect(s, x, y, w, h, fill=WHITE, border=SAND, lw=0.75):
    r = s.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, x, y, w, h)
    r.fill.solid(); r.fill.fore_color.rgb = fill
    r.line.color.rgb = border; r.line.width = Pt(lw)
    r.shadow.inherit = False
    return r

def _line(s, x, y, w, color=MUTED):
    _rect(s, x, y, w, Pt(0.75), color)

def _text(s, x, y, w, h, t, sz=14, c=BODY, b=False, al=PP_ALIGN.LEFT, sp=0):
    tb = s.shapes.add_textbox(x, y, w, h)
    tf = tb.text_frame; tf.word_wrap = True
    p = tf.paragraphs[0]; p.alignment = al
    if sp: p.space_after = Pt(sp)
    r = p.add_run(); r.text = t; r.font.size = Pt(sz)
    r.font.color.rgb = c; r.font.bold = b; r.font.name = FN
    return tb

def _multi(s, x, y, w, h, lines):
    """lines: [(text, size, color, bold, spacing_after), ...]
    spacing_after defaults to 3."""
    tb = s.shapes.add_textbox(x, y, w, h)
    tf = tb.text_frame; tf.word_wrap = True
    for i, item in enumerate(lines):
        t, sz, c, bold = item[0], item[1], item[2], item[3]
        sp_after = item[4] if len(item) > 4 else 3
        p = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
        p.space_after = Pt(sp_after)
        r = p.add_run(); r.text = t; r.font.size = Pt(sz)
        r.font.color.rgb = c; r.font.bold = bold; r.font.name = FN
    return tb

def _hero_img(s, path, x, y, max_w, max_h):
    """Fit an image proportionally inside bounds."""
    if not os.path.exists(path):
        return False
    with Image.open(path) as im:
        iw, ih = im.size
    ratio = min(max_w / iw, max_h / ih)
    nw, nh = int(iw * ratio), int(ih * ratio)
    cx = x + (max_w - nw) // 2
    cy = y + (max_h - nh) // 2
    s.shapes.add_picture(path, cx, cy, width=nw, height=nh)
    return True

def _find(filename):
    """Find screenshot in pages/ or screenshots/ dir."""
    for d in [PAGES, SHOTS]:
        p = os.path.join(d, filename)
        if os.path.exists(p):
            return p
    return None

def _screenshot(s, filename, x, y, w, h):
    """Place a screenshot with subtle shadow card behind it."""
    fp = _find(filename)
    # card background
    _rrect(s, x, y, w, h, fill=WHITE, border=SAND, lw=0.5)
    if fp:
        pad = Inches(0.08)
        _hero_img(s, fp, x + pad, y + pad, w - pad * 2, h - pad * 2)

def _page_footer(s, num, total, section_en):
    """Minimal footer: section label left, page right."""
    _text(s, Inches(1.0), Inches(7.0), Inches(5), Inches(0.3),
           section_en, sz=8, c=MUTED)
    _text(s, Inches(11.5), Inches(7.0), Inches(1.2), Inches(0.3),
           f"{num:02d} / {total:02d}", sz=8, c=MUTED, al=PP_ALIGN.RIGHT)

def _step_row(s, x, y, num, title, desc, accent=GOLD):
    """Horizontal step: number bar | title + desc."""
    # number bar
    _rect(s, x, y, Inches(0.04), Inches(0.55), accent)
    _text(s, x + Inches(0.15), y, Inches(0.3), Inches(0.28),
          str(num), sz=15, c=accent, b=True)
    _text(s, x + Inches(0.45), y - Inches(0.02), Inches(5.0), Inches(0.3),
          title, sz=14, c=INK, b=True)
    _text(s, x + Inches(0.45), y + Inches(0.28), Inches(5.0), Inches(0.28),
          desc, sz=11, c=CAPTION)


TOTAL = 12

# ══════════════════════════════════════════════════════
# 01  COVER
# ══════════════════════════════════════════════════════
def slide_cover():
    s = prs.slides.add_slide(BLANK); _bg(s)

    # top thin gold line
    _rect(s, Inches(5.0), Inches(2.4), Inches(3.3), Pt(1.5), GOLD)

    _text(s, Inches(0), Inches(2.7), SW, Inches(1.5),
          "가르침을 설계하다",
          sz=56, c=INK, b=True, al=PP_ALIGN.CENTER)

    # bottom thin gold line
    _rect(s, Inches(5.0), Inches(4.5), Inches(3.3), Pt(1.5), GOLD)

    _text(s, Inches(0), Inches(4.9), SW, Inches(0.5),
          "WAWA Smart ERP  ·  사용 가이드",
          sz=13, c=CAPTION, al=PP_ALIGN.CENTER)

    _text(s, Inches(0), Inches(6.6), SW, Inches(0.3),
          "1:1 맞춤형 학습 관리 시스템",
          sz=10, c=MUTED, al=PP_ALIGN.CENTER)


# ══════════════════════════════════════════════════════
# 02  OVERVIEW — 6 feature grid
# ══════════════════════════════════════════════════════
def slide_overview():
    s = prs.slides.add_slide(BLANK); _bg(s)

    _text(s, Inches(1.0), Inches(0.6), Inches(11), Inches(0.7),
          "한 명의 학생도 놓치지 않는 시스템",
          sz=32, c=INK, b=True)
    _text(s, Inches(1.0), Inches(1.25), Inches(8), Inches(0.3),
          "선생님의 하루를 따라가는 6가지 핵심 기능",
          sz=13, c=CAPTION)

    feats = [
        ("수업 타이머",   "학생별 실시간 타이머 · 지각/외출 자동 차감\n순수 수업시간만 기록합니다",      SLATE),
        ("성적 · 리포트", "점수 입력 → 바 차트 리포트 자동 생성\nAI 코멘트 · 학부모 카카오톡 전송",    FERN),
        ("결석 · 보강",   "결석 → 보강 자동 생성 · 일정 지정\n퇴근 버튼 하나로 일괄 처리",           CLAY),
        ("학생 프로필",   "성적 추이 · 출결 · 코멘트 한 화면\n학부모 상담 시 이 화면만 열면 끝",       GOLD),
        ("교재 · 게시판", "맞춤 프린트 배부 추적 · 미완료 필터\n공지 · 할일 D-day 마감일 관리",       SLATE),
        ("가챠 동기부여", "학습 보상 카드 시스템\n수집 욕구로 자연스러운 참여 유도",                   GOLD),
    ]

    for i, (title, desc, accent) in enumerate(feats):
        col, row = i % 3, i // 3
        cx = Inches(1.0 + col * 3.9)
        cy = Inches(2.0 + row * 2.55)

        # subtle card
        _rrect(s, cx, cy, Inches(3.5), Inches(2.15),
               fill=WHITE, border=SAND)

        # accent bar
        _rect(s, cx + Inches(0.25), cy + Inches(0.25),
              Inches(0.5), Pt(2.5), accent)

        _text(s, cx + Inches(0.25), cy + Inches(0.5),
              Inches(3.0), Inches(0.35), title, sz=16, c=INK, b=True)
        _text(s, cx + Inches(0.25), cy + Inches(1.0),
              Inches(3.0), Inches(1.0), desc, sz=11, c=CAPTION)

    _page_footer(s, 1, TOTAL, "SYSTEM OVERVIEW")


# ══════════════════════════════════════════════════════
# 03  TIMER — 수업 시작 ~ 정지/재개
# ══════════════════════════════════════════════════════
def slide_timer_1():
    s = prs.slides.add_slide(BLANK); _bg(s)

    # Left side — text
    _text(s, Inches(1.0), Inches(0.7), Inches(5.0), Inches(0.8),
          "수업의 시작과 끝을\n시스템이 기억합니다",
          sz=30, c=INK, b=True)

    _text(s, Inches(1.0), Inches(1.9), Inches(4.5), Inches(0.5),
          "학생 카드를 탭하면 타이머가 시작되고,\n모든 시간이 자동으로 기록됩니다.",
          sz=13, c=CAPTION)

    _step_row(s, Inches(1.0), Inches(3.0), 1,
              "학생 카드 탭 → 수업 시작",
              "대기 중인 학생 카드를 탭하면 타이머 자동 시작", SLATE)
    _step_row(s, Inches(1.0), Inches(3.9), 2,
              "[정지] → 사유 선택",
              "외출 / 휴식 / 화장실 — 정지 시간은 자동 차감", SLATE)
    _step_row(s, Inches(1.0), Inches(4.8), 3,
              "[완료] → 수업 종료",
              "순수 수업시간이 저장되고 출석 처리 완료", SLATE)

    # Right side — hero screenshot
    _screenshot(s, "10-timer-main.png",
                Inches(6.6), Inches(0.5), Inches(6.0), Inches(6.4))

    _page_footer(s, 2, TOTAL, "CLASS TIMER")


# ══════════════════════════════════════════════════════
# 04  TIMER — 퇴근 & 자동 정리
# ══════════════════════════════════════════════════════
def slide_timer_2():
    s = prs.slides.add_slide(BLANK); _bg(s)

    # Right side — text (flipped layout)
    _text(s, Inches(7.0), Inches(0.7), Inches(5.5), Inches(0.8),
          "퇴근 한 번이면\n하루가 정리됩니다",
          sz=30, c=INK, b=True)

    _step_row(s, Inches(7.0), Inches(2.0), 4,
              "[퇴근] 버튼 한 번 클릭",
              "하루 수업이 끝나면 퇴근 버튼으로 마감", SLATE)

    _multi(s, Inches(7.0), Inches(3.2), Inches(5.0), Inches(2.5), [
        ("퇴근 시 자동으로:", 13, INK, True, 8),
        ("수업 안 온 학생 → 결석 자동 감지", 12, BODY, False, 4),
        ("결석 학생 → 보강 자동 생성", 12, BODY, False, 4),
        ("모든 출결 데이터 → 자동 저장", 12, BODY, False, 12),
        ("\"보강 잡아야 하나...\" 고민은 WAWA가 대신합니다", 11, CAPTION, False, 0),
    ])

    # Left side — hero screenshot
    _screenshot(s, "01-timer-session-done.png",
                Inches(0.8), Inches(0.5), Inches(5.8), Inches(6.4))

    _page_footer(s, 3, TOTAL, "CLASS TIMER")


# ══════════════════════════════════════════════════════
# 05  EXAM & REPORT — 성적 입력
# ══════════════════════════════════════════════════════
def slide_exam_1():
    s = prs.slides.add_slide(BLANK); _bg(s)

    _text(s, Inches(1.0), Inches(0.7), Inches(5.0), Inches(0.8),
          "점수를 입력하면\n리포트가 완성됩니다",
          sz=30, c=INK, b=True)

    _text(s, Inches(1.0), Inches(1.9), Inches(4.5), Inches(0.5),
          "월말평가 성적을 입력하면 과목별 바 차트와\n코멘트가 포함된 학부모 리포트가 자동 생성됩니다.",
          sz=13, c=CAPTION)

    _step_row(s, Inches(1.0), Inches(3.0), 1,
              "시험 설정 (정기고사 / 월말평가)",
              "원장이 월별 시험을 설정하면 학생별 입력 폼 자동 생성", FERN)
    _step_row(s, Inches(1.0), Inches(3.9), 2,
              "학생 선택 → 점수 입력",
              "점수 입력 후 다른 곳 클릭하면 자동 저장 (blur 저장)", FERN)
    _step_row(s, Inches(1.0), Inches(4.8), 3,
              "코멘트 작성 (직접 or AI 생성)",
              "[AI 코멘트 생성] → 출석·성적 기반 코멘트 자동 작성", FERN)

    _screenshot(s, "80-exams-main.png",
                Inches(6.6), Inches(0.5), Inches(6.0), Inches(6.4))

    _page_footer(s, 4, TOTAL, "EXAM & REPORT")


# ══════════════════════════════════════════════════════
# 06  EXAM & REPORT — 학부모 전송
# ══════════════════════════════════════════════════════
def slide_exam_2():
    s = prs.slides.add_slide(BLANK); _bg(s)

    _text(s, Inches(7.0), Inches(0.7), Inches(5.5), Inches(0.8),
          "학부모에게 보내는\n신뢰의 리포트",
          sz=30, c=INK, b=True)

    _step_row(s, Inches(7.0), Inches(2.0), 4,
              "[카카오톡 공유] → 원클릭 전송",
              "리포트 이미지 자동 업로드 + 공유 메시지 클립보드 복사", FERN)

    _multi(s, Inches(7.0), Inches(3.2), Inches(5.0), Inches(2.5), [
        ("리포트에 포함되는 정보:", 13, INK, True, 8),
        ("학원명 · 학생명 · 해당 월/학기", 12, BODY, False, 4),
        ("과목별 점수 (바 차트 시각화)", 12, BODY, False, 4),
        ("과목별 선생님 코멘트", 12, BODY, False, 4),
        ("AI 종합 총평 (선택)", 12, BODY, False, 12),
        ("카톡에서 붙여넣기만 하면 끝", 11, FERN, True, 0),
    ])

    # Left — report screenshot (large)
    _screenshot(s, "70-report-main.png",
                Inches(0.8), Inches(0.5), Inches(5.8), Inches(6.4))

    _page_footer(s, 5, TOTAL, "EXAM & REPORT")


# ══════════════════════════════════════════════════════
# 07  ABSENCE & MAKEUP — 결석 → 보강
# ══════════════════════════════════════════════════════
def slide_absence():
    s = prs.slides.add_slide(BLANK); _bg(s)

    _text(s, Inches(1.0), Inches(0.7), Inches(5.0), Inches(0.8),
          "결석하면 보강이\n자동으로 생깁니다",
          sz=30, c=INK, b=True)

    _text(s, Inches(1.0), Inches(1.9), Inches(4.5), Inches(0.5),
          "사전 연락이든 무단결석이든, 보강이 자동 생성되어\n누락 없이 관리됩니다.",
          sz=13, c=CAPTION)

    _step_row(s, Inches(1.0), Inches(3.0), 1,
              "결석 등록 (사전연락 or 퇴근 시 자동)",
              "사유 선택: 사전연락 / 무단 / 병결", CLAY)
    _step_row(s, Inches(1.0), Inches(3.9), 2,
              "보강일 날짜 입력 → [지정]",
              "학부모와 조율한 날짜 입력하면 보강 일정 확정", CLAY)
    _step_row(s, Inches(1.0), Inches(4.8), 3,
              "보강 수업 후 [완료] 처리",
              "미보강 / 보강예정 / 완료 — 필터로 상태별 확인", CLAY)

    _screenshot(s, "40-absence-main.png",
                Inches(6.6), Inches(0.5), Inches(6.0), Inches(6.4))

    _page_footer(s, 6, TOTAL, "ABSENCE & MAKEUP")


# ══════════════════════════════════════════════════════
# 08  STUDENT PROFILE
# ══════════════════════════════════════════════════════
def slide_student():
    s = prs.slides.add_slide(BLANK); _bg(s)

    _text(s, Inches(7.0), Inches(0.7), Inches(5.5), Inches(0.8),
          "\"우리 애 어때요?\"\n이 화면 하나로 답합니다",
          sz=30, c=INK, b=True)

    _multi(s, Inches(7.0), Inches(2.2), Inches(5.0), Inches(3.5), [
        ("학생 프로필 한 화면:", 13, INK, True, 10),
        ("성적 추이 차트 (6개월 / 12개월)", 12, BODY, False, 4),
        ("출결 요약 (출석률 · 결석 · 지각)", 12, BODY, False, 4),
        ("기본 정보 (과목 · 담당 · 학부모 연락처)", 12, BODY, False, 4),
        ("코멘트 히스토리 (월별 기록)", 12, BODY, False, 16),
        ("학부모 상담 시 이 화면을 열면", 12, CAPTION, False, 2),
        ("출석/성적/프린트/코멘트가 한눈에", 13, GOLD, True, 0),
    ])

    _screenshot(s, "30-student-list.png",
                Inches(0.8), Inches(0.5), Inches(5.8), Inches(6.4))

    _page_footer(s, 7, TOTAL, "STUDENT PROFILE")


# ══════════════════════════════════════════════════════
# 09  MATERIALS & BOARD
# ══════════════════════════════════════════════════════
def slide_materials():
    s = prs.slides.add_slide(BLANK); _bg(s)

    _text(s, Inches(1.0), Inches(0.7), Inches(5.0), Inches(0.8),
          "누구한테 뭘 줬는지\n카톡에서 안 묻히는 업무",
          sz=30, c=INK, b=True)

    # Materials section
    _text(s, Inches(1.0), Inches(2.0), Inches(3), Inches(0.25),
          "교재 관리", sz=10, c=GOLD, b=True)
    _line(s, Inches(1.0), Inches(2.3), Inches(4.5), GOLD_LIGHT)

    _step_row(s, Inches(1.0), Inches(2.6), 1,
              "학생별 맞춤 프린트 등록",
              "학생 1명 = 프린트 N장, 각각 독립 관리", SLATE)
    _step_row(s, Inches(1.0), Inches(3.5), 2,
              "[미완료] 필터 → 오늘 할 일 확인",
              "빠뜨리는 일 없이 배부 현황 관리", SLATE)

    # Board section
    _text(s, Inches(1.0), Inches(4.6), Inches(3), Inches(0.25),
          "게시판", sz=10, c=GOLD, b=True)
    _line(s, Inches(1.0), Inches(4.9), Inches(4.5), GOLD_LIGHT)

    _step_row(s, Inches(1.0), Inches(5.2), 3,
              "고정 공지 + 할일 + D-day",
              "업무 지시 = 공지 | 실행 = 할일. 마감일 기반 추적", SLATE)

    # Right — stacked screenshots
    _screenshot(s, "50-materials-main.png",
                Inches(6.6), Inches(0.5), Inches(6.0), Inches(2.95))
    _screenshot(s, "20-board-main.png",
                Inches(6.6), Inches(3.65), Inches(6.0), Inches(3.25))

    _page_footer(s, 8, TOTAL, "MATERIALS & BOARD")


# ══════════════════════════════════════════════════════
# 10  GACHA — 동기부여
# ══════════════════════════════════════════════════════
def slide_gacha():
    s = prs.slides.add_slide(BLANK); _bg(s)

    _text(s, Inches(7.0), Inches(0.7), Inches(5.5), Inches(0.8),
          "공부가 게임이 되는\n순간을 만듭니다",
          sz=30, c=INK, b=True)

    _multi(s, Inches(7.0), Inches(2.2), Inches(5.0), Inches(3.5), [
        ("가챠 카드 시스템:", 13, INK, True, 10),
        ("출석/성적 달성 시 보상 카드 획득", 12, BODY, False, 4),
        ("수집 욕구를 자극하는 카드 컬렉션", 12, BODY, False, 4),
        ("학생별 획득 현황 추적", 12, BODY, False, 16),
        ("\"이번 주 개근하면 카드 뽑기!\"", 12, CAPTION, False, 2),
        ("→ 학습을 강요하지 않고, 스스로 원하게 만드는 것", 12, GOLD, True, 0),
    ])

    # Left — stacked gacha screenshots
    _screenshot(s, "90-gacha-student.png",
                Inches(0.8), Inches(0.5), Inches(5.8), Inches(2.95))
    _screenshot(s, "91-gacha-cards.png",
                Inches(0.8), Inches(3.65), Inches(5.8), Inches(3.25))

    _page_footer(s, 9, TOTAL, "MOTIVATION SYSTEM")


# ══════════════════════════════════════════════════════
# 11  TIMELINE — 선생님의 하루
# ══════════════════════════════════════════════════════
def slide_timeline():
    s = prs.slides.add_slide(BLANK); _bg(s)

    _text(s, Inches(1.0), Inches(0.5), Inches(11), Inches(0.6),
          "선생님의 하루 — WAWA와 함께",
          sz=30, c=INK, b=True)
    _text(s, Inches(1.0), Inches(1.1), Inches(8), Inches(0.3),
          "실제 하루를 따라가며 각 기능이 어떻게 연결되는지 보여드립니다",
          sz=12, c=CAPTION)

    # Vertical timeline line
    _rect(s, Inches(2.0), Inches(1.7), Pt(2), Inches(5.2), GOLD_LIGHT)

    timeline = [
        ("15:50", "보드 확인 → 오늘 할일 체크, D-day 확인",                  SLATE,  "게시판"),
        ("16:00", "학생 카드 탭 → 수업 시작, 지각 자동 기록",                  SLATE,  "타이머"),
        ("17:30", "수업 완료 → 출석 자동 저장",                               SLATE,  "타이머"),
        ("17:40", "학생별 프린트 배부 확인 → 미완료 체크",                      SLATE,  "교재"),
        ("18:00", "2교시 수업 → 외출 5분 자동 차감 → 순수 시간 기록",          SLATE,  "타이머"),
        ("19:30", "보강 일정 확인 → 학부모와 날짜 조율 → [지정]",              CLAY,   "보강"),
        ("20:00", "3교시 수업 → 질문 많아 10분 연장도 자동 반영",               SLATE,  "타이머"),
        ("21:00", "[퇴근] 버튼 → 미출석 결석 + 보강 자동 생성",                FERN,   "출결"),
        ("21:10", "미전송 학생 확인 → 카카오톡 공유 → 학부모 전송",             FERN,   "리포트"),
    ]

    for i, (time, desc, color, badge_label) in enumerate(timeline):
        y = Inches(1.8 + i * 0.56)

        # time dot on line
        dot = s.shapes.add_shape(MSO_SHAPE.OVAL,
            Inches(1.92), y + Inches(0.06), Inches(0.18), Inches(0.18))
        dot.fill.solid(); dot.fill.fore_color.rgb = GOLD
        dot.line.fill.background(); dot.shadow.inherit = False

        # time
        _text(s, Inches(0.8), y + Inches(0.04), Inches(1.0), Inches(0.3),
              time, sz=13, c=GOLD, b=True, al=PP_ALIGN.RIGHT)

        # badge
        badge = _rrect(s, Inches(2.35), y + Inches(0.04),
                        Inches(0.65), Inches(0.28), fill=color, border=color)
        _text(s, Inches(2.37), y + Inches(0.05), Inches(0.61), Inches(0.24),
              badge_label, sz=8, c=WHITE, b=True, al=PP_ALIGN.CENTER)

        # description
        _text(s, Inches(3.15), y + Inches(0.04), Inches(9.5), Inches(0.3),
              desc, sz=12, c=BODY)

    _page_footer(s, 10, TOTAL, "DAILY TIMELINE")


# ══════════════════════════════════════════════════════
# 12  GET STARTED + CLOSING
# ══════════════════════════════════════════════════════
def slide_closing():
    s = prs.slides.add_slide(BLANK); _bg(s)

    # Top section — access info
    _text(s, Inches(1.0), Inches(0.6), Inches(5), Inches(0.4),
          "지금 바로 체험해보세요", sz=26, c=INK, b=True)

    # Access card
    _rrect(s, Inches(1.0), Inches(1.3), Inches(5.0), Inches(3.2),
           fill=WHITE, border=GOLD, lw=1)
    _rect(s, Inches(1.3), Inches(1.55), Inches(1.0), Pt(2.5), GOLD)

    _multi(s, Inches(1.3), Inches(1.8), Inches(4.4), Inches(2.5), [
        ("데모 접속", 18, INK, True, 12),
        ("1.  wawa-smart-erp.pages.dev  접속", 13, BODY, False, 4),
        ("2.  학원 선택:  (test)협곡점", 13, BODY, False, 4),
        ("3.  로그인:", 13, BODY, False, 8),
        ("    협곡원장 / 1234  — 관리자 (전체 기능)", 12, GOLD, False, 3),
        ("    하이머딩거 / 1234  — 수학 선생님", 12, SLATE, False, 3),
        ("    소라카 / 1234  — 영어 선생님", 12, FERN, False, 0),
    ])

    # Right side — what WAWA changes
    _text(s, Inches(7.0), Inches(0.6), Inches(5.5), Inches(0.4),
          "WAWA가 바꾸는 것들", sz=26, c=INK, b=True)

    changes = [
        ("수업시간",    "지각/외출/연장 자동 계산, 수기 기록 불필요"),
        ("성적/리포트", "점수 입력 → 리포트 자동 생성 → 학부모 원클릭 전송"),
        ("결석/보강",   "결석 → 보강 자동 생성 → 일정 관리"),
        ("학생 프로필", "출석/성적/프린트/코멘트 통합 한 화면"),
        ("동기부여",    "가챠 카드로 학습 흥미 자극"),
    ]

    for i, (label, desc) in enumerate(changes):
        y = Inches(1.4 + i * 0.6)
        _rect(s, Inches(7.0), y, Pt(2), Inches(0.4), GOLD)
        _text(s, Inches(7.2), y, Inches(1.5), Inches(0.3),
              label, sz=13, c=INK, b=True)
        _text(s, Inches(8.7), y, Inches(4.0), Inches(0.3),
              desc, sz=11, c=CAPTION)

    # Bottom closing message
    _rect(s, Inches(3.5), Inches(5.3), Inches(6.3), Pt(1.5), GOLD)

    _text(s, Inches(0), Inches(5.6), SW, Inches(0.6),
          "선생님의 노하우가 체계적 교육의 표준이 됩니다.",
          sz=28, c=INK, b=True, al=PP_ALIGN.CENTER)

    _text(s, Inches(0), Inches(6.5), SW, Inches(0.3),
          "WAWA SMART ERP",
          sz=10, c=MUTED, al=PP_ALIGN.CENTER)

    _page_footer(s, 11, TOTAL, "GET STARTED")


# ══════════════════════════════════════════════════════
# BUILD
# ══════════════════════════════════════════════════════
slide_cover()
slide_overview()
slide_timer_1()
slide_timer_2()
slide_exam_1()
slide_exam_2()
slide_absence()
slide_student()
slide_materials()
slide_gacha()
slide_timeline()
slide_closing()

prs.save(OUT)
print(f"[OK] {OUT}")
print(f"     {len(prs.slides)} slides")
