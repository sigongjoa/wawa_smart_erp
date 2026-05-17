"""
WAWA Smart ERP — 선생님용 유즈케이스 가이드 PPT v3
밝은 배경 + 실제 인터랙션 스크린샷 (다중)
"""
from pptx import Presentation
from pptx.util import Inches, Pt
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN
from pptx.enum.shapes import MSO_SHAPE
import os

prs = Presentation()
prs.slide_width = Inches(13.333)
prs.slide_height = Inches(7.5)

SHOT_DIR = '/mnt/g/progress/wawa/wawa_smart_erp/docs/screenshots'

# ── 밝은 색상 팔레트 ──
BG_WHITE = RGBColor(0xFA, 0xFA, 0xFC)
BG_LIGHT = RGBColor(0xF0, 0xF2, 0xF7)
CARD_WHITE = RGBColor(0xFF, 0xFF, 0xFF)
CARD_BLUE = RGBColor(0xEE, 0xF3, 0xFF)
CARD_GREEN = RGBColor(0xEC, 0xFA, 0xF0)
CARD_RED = RGBColor(0xFD, 0xED, 0xED)
CARD_PURPLE = RGBColor(0xF3, 0xED, 0xFD)
CARD_ORANGE = RGBColor(0xFF, 0xF3, 0xE6)
CARD_GOLD = RGBColor(0xFD, 0xF6, 0xE3)

BLUE = RGBColor(0x3B, 0x6C, 0xD5)
GREEN = RGBColor(0x16, 0xA3, 0x4A)
RED = RGBColor(0xDC, 0x26, 0x26)
PURPLE = RGBColor(0x7C, 0x3A, 0xED)
ORANGE = RGBColor(0xEA, 0x58, 0x0C)
GOLD = RGBColor(0xCA, 0x8A, 0x04)

BLACK = RGBColor(0x1A, 0x1A, 0x2E)
DARK = RGBColor(0x33, 0x33, 0x44)
GRAY = RGBColor(0x66, 0x66, 0x77)
LGRAY = RGBColor(0x99, 0x99, 0xAA)
WHITE = RGBColor(0xFF, 0xFF, 0xFF)


def bg(slide, color=BG_WHITE):
    slide.background.fill.solid()
    slide.background.fill.fore_color.rgb = color

def box(slide, l, t, w, h, txt, sz=18, c=BLACK, b=False, al=PP_ALIGN.LEFT):
    tb = slide.shapes.add_textbox(Inches(l), Inches(t), Inches(w), Inches(h))
    tf = tb.text_frame; tf.word_wrap = True
    p = tf.paragraphs[0]; p.text = txt; p.font.size = Pt(sz)
    p.font.color.rgb = c; p.font.bold = b; p.alignment = al
    return tb

def card(slide, l, t, w, h, fc=CARD_WHITE, bc=None):
    s = slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(l), Inches(t), Inches(w), Inches(h))
    s.fill.solid(); s.fill.fore_color.rgb = fc
    if bc:
        s.line.color.rgb = bc; s.line.width = Pt(1.5)
    else:
        s.line.color.rgb = RGBColor(0xE0, 0xE0, 0xE8); s.line.width = Pt(0.75)
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

def img(slide, l, t, w, h, filename):
    fp = os.path.join(SHOT_DIR, filename)
    if os.path.exists(fp):
        slide.shapes.add_picture(fp, Inches(l), Inches(t), Inches(w), Inches(h))
    else:
        card(slide, l, t, w, h, BG_LIGHT, LGRAY)
        box(slide, l + 0.1, t + h/2 - 0.15, w - 0.2, 0.3, f'[{filename}]', 10, LGRAY, False, PP_ALIGN.CENTER)

def accent_bar(slide, l, t, w, color):
    s = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(l), Inches(t), Inches(w), Inches(0.06))
    s.fill.solid(); s.fill.fore_color.rgb = color
    s.line.fill.background()


# ============================================================
# SLIDE 1: 표지
# ============================================================
s = prs.slides.add_slide(prs.slide_layouts[6]); bg(s)
accent_bar(s, 0, 0, 13.333, BLUE)
card(s, 2.5, 1.5, 8.3, 4.5, CARD_WHITE, BLUE)
accent_bar(s, 2.5, 1.5, 8.3, BLUE)
box(s, 3, 2.2, 7.3, 1, 'WAWA Smart ERP', 52, BLUE, True, PP_ALIGN.CENTER)
box(s, 3, 3.3, 7.3, 0.6, '학원 선생님을 위한 유즈케이스 가이드', 22, DARK, False, PP_ALIGN.CENTER)
mtext(s, 3.3, 4.2, 6.8, 1.5, [
    ('선생님이 학생 관리에 쓰는 시간을 줄여드립니다', 16, GRAY, False),
    ('', 8, GRAY, False),
    ('수업시간 관리  |  성적 평가 & 리포트  |  교재/프린트 관리', 14, DARK, False),
    ('결석 & 보강 일정  |  학생 성장 피드백  |  학원 내 업무 관리', 14, DARK, False),
])
box(s, 2.5, 6.4, 8.3, 0.4, '6개 핵심 기능  |  실제 화면 스크린샷  |  LoL 세계관 데모 데이터', 13, LGRAY, False, PP_ALIGN.CENTER)

# ============================================================
# SLIDE 2: 전체 기능 한눈에 보기
# ============================================================
s = prs.slides.add_slide(prs.slide_layouts[6]); bg(s)
accent_bar(s, 0, 0, 13.333, BLUE)
box(s, 0.5, 0.3, 12, 0.7, '전체 기능 한눈에 보기', 34, BLACK, True)
box(s, 0.5, 0.85, 12, 0.4, '선생님의 하루를 따라가는 6가지 핵심 기능', 14, GRAY, False)

features = [
    ('수업', '수업 시간 관리', '학생별 실시간 타이머\n지각/화장실/외출 등\n순수 수업시간 자동 계산', BLUE, CARD_BLUE),
    ('평가', '성적 & 리포트', '월말평가 성적 입력\n과목별 코멘트 작성\n학부모 리포트 전송', GREEN, CARD_GREEN),
    ('교재', '교재 & 프린트', '학생별 맞춤 프린트\n제작/배부 현황 관리\n여러 학생 동시 관리', PURPLE, CARD_PURPLE),
    ('보강', '결석 & 보강', '결석 사유 기록\n보강 일정 자동 관리\n학생 많아도 빠짐없이', RED, CARD_RED),
    ('학생', '학생 성장 피드백', '학생별 종합 현황\n학부모 주기적 피드백\n출석/성적/프린트 통합', ORANGE, CARD_ORANGE),
    ('보드', '학원 업무 관리', '공지사항 & 할일\n선생님간 업무 공유\n마감일 기반 관리', GOLD, CARD_GOLD),
]

for i, (tab, title, desc, color, card_bg) in enumerate(features):
    col = i % 3; row = i // 3
    x = 0.5 + col * 4.15; y = 1.5 + row * 2.85
    card(s, x, y, 3.95, 2.65, card_bg, color)
    accent_bar(s, x, y, 3.95, color)
    mtext(s, x + 0.2, y + 0.2, 3.55, 2.35, [
        (f'[ {tab} ]  {title}', 16, color, True),
        ('', 4, GRAY, False),
        (desc, 13, DARK, False),
    ])


# ============================================================
# SLIDE 3: 수업 — 타이머 (2장: 기본 + 정지/재개)
# ============================================================
s = prs.slides.add_slide(prs.slide_layouts[6]); bg(s)
accent_bar(s, 0, 0, 13.333, BLUE)
box(s, 0.5, 0.2, 12, 0.6, '[ 수업 ]  실시간 수업 시간 관리', 32, BLUE, True)

# 왼쪽 상단: 문제 상황
card(s, 0.3, 1.0, 4.0, 1.8, CARD_RED, RED)
mtext(s, 0.5, 1.05, 3.6, 1.7, [
    ('이런 상황, 겪어보셨죠?', 13, RED, True),
    ('"야스오가 바람 쐬러 나갔다가 돌아왔는데\n 몇 분이었지? 수업시간에서 빼야 하나?"', 11, DARK, False),
    ('"럭스가 5분 늦게 왔는데 기록이 안 남아"', 11, DARK, False),
])

# 왼쪽 하단: 해결
card(s, 0.3, 2.95, 4.0, 1.6, CARD_GREEN, GREEN)
mtext(s, 0.5, 3.0, 3.6, 1.5, [
    ('WAWA가 자동으로 관리합니다', 13, GREEN, True),
    ('학생 카드 탭 -> 수업 시작 (타이머 자동)', 11, DARK, False),
    ('[정지] -> 사유 선택 (화장실/외출/간식)', 11, DARK, False),
    ('[재개] -> 정지 시간 자동 차감', 11, DARK, False),
    ('[완료] -> 순수 수업시간만 저장', 11, DARK, False),
])

# 좌측 퇴근 설명
card(s, 0.3, 4.7, 4.0, 1.0, CARD_BLUE, BLUE)
mtext(s, 0.5, 4.75, 3.6, 0.9, [
    ('[퇴근] 버튼 = 하루 마감', 13, BLUE, True),
    ('수업 안 온 학생 자동 결석 + 보강 자동 생성', 11, DARK, False),
])

# 오른쪽: 3개 스크린샷 (수업시작, 정지시트, 정지상태)
box(s, 4.5, 1.0, 8.5, 0.3, '수업 시작 -> 정지 사유 선택 -> 정지/재개 -> 완료', 12, BLUE, True)
img(s, 4.5, 1.35, 2.8, 2.1, '01-timer-session-started.png')
img(s, 7.4, 1.35, 2.8, 2.1, '01-timer-pause-sheet.png')
img(s, 10.3, 1.35, 2.8, 2.1, '01-timer-paused.png')

box(s, 4.5, 3.5, 1.5, 0.25, '수업 시작', 10, BLUE, True, PP_ALIGN.CENTER)
box(s, 7.4, 3.5, 1.5, 0.25, '정지 사유 선택', 10, BLUE, True, PP_ALIGN.CENTER)
box(s, 10.3, 3.5, 1.5, 0.25, '일시정지 상태', 10, BLUE, True, PP_ALIGN.CENTER)

# 하단: 재개 + 완료
img(s, 4.5, 3.85, 4.2, 1.85, '01-timer-resumed.png')
img(s, 8.9, 3.85, 4.2, 1.85, '01-timer-session-done.png')
box(s, 4.5, 5.75, 4.2, 0.25, '재개 후 수업 진행', 10, GREEN, True, PP_ALIGN.CENTER)
box(s, 8.9, 5.75, 4.2, 0.25, '수업 완료', 10, GREEN, True, PP_ALIGN.CENTER)


# ============================================================
# SLIDE 4: 평가 — 성적 입력 + 리포트
# ============================================================
s = prs.slides.add_slide(prs.slide_layouts[6]); bg(s)
accent_bar(s, 0, 0, 13.333, GREEN)
box(s, 0.5, 0.2, 12, 0.6, '[ 평가 ]  성적 입력 & 학부모 리포트', 32, GREEN, True)

# 상단: 3단계 흐름
card(s, 0.3, 1.0, 4.0, 1.2, CARD_RED, RED)
mtext(s, 0.5, 1.05, 3.6, 1.1, [
    ('이런 상황, 겪어보셨죠?', 13, RED, True),
    ('"학부모님한테 점수 알려줘야 하는데..."', 11, DARK, False),
    ('"카톡으로 하나하나 보내면 시간이 너무 걸려"', 11, DARK, False),
])

card(s, 0.3, 2.35, 4.0, 1.8, CARD_GREEN, GREEN)
mtext(s, 0.5, 2.4, 3.6, 1.7, [
    ('3단계로 끝!', 13, GREEN, True),
    ('', 4, GRAY, False),
    ('STEP 1: 학생 선택 -> 점수 입력', 12, DARK, False),
    ('     (blur 시 자동 저장, 별도 저장 불필요)', 10, GRAY, False),
    ('STEP 2: 코멘트 작성 or AI 자동 생성', 12, DARK, False),
    ('STEP 3: JPG 다운로드 or 카카오톡 공유', 12, DARK, False),
])

# 스크린샷: 성적 입력, 코멘트, 리포트 PNG
box(s, 4.5, 1.0, 8.5, 0.3, '점수 입력 -> 코멘트 작성 -> 리포트 생성 -> 카카오톡 전송', 12, GREEN, True)
img(s, 4.5, 1.35, 2.8, 2.6, '02-report-score-entered.png')
img(s, 7.4, 1.35, 2.8, 2.6, '02-report-comment-written.png')
img(s, 10.3, 1.35, 2.8, 2.6, '02-report-share.png')

box(s, 4.5, 4.0, 2.8, 0.25, '1. 점수 입력', 10, GREEN, True, PP_ALIGN.CENTER)
box(s, 7.4, 4.0, 2.8, 0.25, '2. 코멘트 작성', 10, GREEN, True, PP_ALIGN.CENTER)
box(s, 10.3, 4.0, 2.8, 0.25, '3. 카카오톡 공유', 10, GREEN, True, PP_ALIGN.CENTER)

# 하단: 실제 리포트 JPG
card(s, 0.3, 4.35, 4.0, 2.9, CARD_GOLD, GOLD)
mtext(s, 0.5, 4.4, 3.6, 0.4, [
    ('실제 생성된 학부모 리포트', 13, GOLD, True),
])
img(s, 0.5, 4.85, 3.6, 2.3, '02-report-downloaded.jpg')

card(s, 4.5, 4.35, 8.5, 2.9, CARD_GREEN, GREEN)
mtext(s, 4.7, 4.4, 8.1, 2.8, [
    ('리포트에 포함되는 정보', 14, GREEN, True),
    ('', 4, GRAY, False),
    ('학원명, 학생명, 월/학기', 12, DARK, False),
    ('과목별 점수 (바 차트 시각화)', 12, DARK, False),
    ('전월 대비 성적 변화 (상승/하락 표시)', 12, DARK, False),
    ('과목별 선생님 코멘트', 12, DARK, False),
    ('AI 총평 (선택)', 12, DARK, False),
    ('', 4, GRAY, False),
    ('전송 방법: JPG 다운로드 → 카카오톡 붙여넣기', 12, DARK, True),
    ('또는: [카카오톡 공유] 버튼 → 메시지 자동 복사 → 학부모에게 전송', 12, DARK, False),
])


# ============================================================
# SLIDE 5: 교재 — 프린트 관리
# ============================================================
s = prs.slides.add_slide(prs.slide_layouts[6]); bg(s)
accent_bar(s, 0, 0, 13.333, PURPLE)
box(s, 0.5, 0.2, 12, 0.6, '[ 교재 ]  프린트 & 교재 제작 관리', 32, PURPLE, True)

card(s, 0.3, 1.0, 4.0, 1.5, CARD_RED, RED)
mtext(s, 0.5, 1.05, 3.6, 1.4, [
    ('이런 상황, 겪어보셨죠?', 13, RED, True),
    ('"야스오한테 방정식 프린트 어디까지 줬더라?"', 11, DARK, False),
    ('"학생 10명, 누구한테 뭘 줘야 하는지 헷갈려"', 11, DARK, False),
    ('"만들었는데 나눠줬는지 안 줬는지 모르겠어"', 11, DARK, False),
])

card(s, 0.3, 2.65, 4.0, 1.5, CARD_GREEN, GREEN)
mtext(s, 0.5, 2.7, 3.6, 1.4, [
    ('WAWA가 해결합니다', 13, GREEN, True),
    ('학생별 맞춤 프린트 등록 -> 상태 추적', 11, DARK, False),
    ('미완료 / 완료 필터로 한눈에', 11, DARK, False),
    ('학생 1명 = 프린트 N장 독립 관리', 11, DARK, False),
])

# 스크린샷 3개
box(s, 4.5, 1.0, 8.5, 0.3, '전체 보기 -> 미완료 필터 -> 완료 필터', 12, PURPLE, True)
img(s, 4.5, 1.35, 2.8, 3.0, '03-materials-home.png')
img(s, 7.4, 1.35, 2.8, 3.0, '03-materials-incomplete.png')
img(s, 10.3, 1.35, 2.8, 3.0, '03-materials-completed.png')

box(s, 4.5, 4.4, 2.8, 0.25, '전체 교재 목록', 10, PURPLE, True, PP_ALIGN.CENTER)
box(s, 7.4, 4.4, 2.8, 0.25, '미완료만 필터', 10, ORANGE, True, PP_ALIGN.CENTER)
box(s, 10.3, 4.4, 2.8, 0.25, '완료된 항목', 10, GREEN, True, PP_ALIGN.CENTER)

card(s, 0.3, 4.35, 12.7, 1.3, CARD_PURPLE, PURPLE)
mtext(s, 0.5, 4.75, 12.3, 0.8, [
    ('핵심: 학생 1명 = 맞춤 프린트 N장  |  학생별 진행상황 독립 관리  |  미완료/완료 필터링으로 빠짐없이', 13, PURPLE, True),
    ('야스오: 방정식 기초(1) 완료 -> 방정식 기초(2) 완료 -> 방정식 심화(3) 대기중  |  에코: 시간관리 프린트 대기중', 11, DARK, False),
])


# ============================================================
# SLIDE 6: 보강 — 결석/보강 관리
# ============================================================
s = prs.slides.add_slide(prs.slide_layouts[6]); bg(s)
accent_bar(s, 0, 0, 13.333, RED)
box(s, 0.5, 0.2, 12, 0.6, '[ 보강 ]  결석 & 보강 일정 관리', 32, RED, True)

card(s, 0.3, 1.0, 4.0, 1.6, CARD_RED, RED)
mtext(s, 0.5, 1.05, 3.6, 1.5, [
    ('이런 상황, 겪어보셨죠?', 13, RED, True),
    ('"야스오가 안 왔는데 보강 언제 잡지?"', 11, DARK, False),
    ('"징크스 보강이 토요일이었나 월요일이었나..."', 11, DARK, False),
    ('"15명인데 누가 보강 밀렸는지 기억 안 돼"', 11, DARK, False),
])

card(s, 0.3, 2.75, 4.0, 2.2, CARD_GREEN, GREEN)
mtext(s, 0.5, 2.8, 3.6, 2.1, [
    ('WAWA가 해결합니다', 13, GREEN, True),
    ('결석 -> 보강 자동 생성', 11, DARK, False),
    ('미보강 / 보강예정 / 완료 필터', 11, DARK, False),
    ('', 4, GRAY, False),
    ('경로 A: 학부모 사전 연락 -> 결석 등록', 11, BLUE, True),
    ('경로 B: 퇴근 -> 자동 결석 감지 -> 보강 생성', 11, RED, True),
    ('', 4, GRAY, False),
    ('보강일 지정 -> 보강 완료 처리', 11, DARK, False),
])

# 스크린샷: 전체 -> 보강일 지정 -> 보강 완료
box(s, 4.5, 1.0, 8.5, 0.3, '보강 목록 -> 미보강 필터 -> 보강일 지정 -> 완료', 12, RED, True)
img(s, 4.5, 1.35, 4.2, 2.4, '04-absence-home.png')
img(s, 8.9, 1.35, 4.2, 2.4, '04-absence-pending.png')

box(s, 4.5, 3.8, 4.2, 0.25, '전체 보강 관리', 10, RED, True, PP_ALIGN.CENTER)
box(s, 8.9, 3.8, 4.2, 0.25, '미보강 필터', 10, ORANGE, True, PP_ALIGN.CENTER)

img(s, 4.5, 4.15, 4.2, 2.4, '04-absence-date-entered.png')
img(s, 8.9, 4.15, 4.2, 2.4, '04-absence-scheduled-done.png')

box(s, 4.5, 6.6, 4.2, 0.25, '보강일 날짜 입력', 10, BLUE, True, PP_ALIGN.CENTER)
box(s, 8.9, 6.6, 4.2, 0.25, '보강일 지정 완료', 10, GREEN, True, PP_ALIGN.CENTER)


# ============================================================
# SLIDE 7: 학생 — 프로필 & 피드백
# ============================================================
s = prs.slides.add_slide(prs.slide_layouts[6]); bg(s)
accent_bar(s, 0, 0, 13.333, ORANGE)
box(s, 0.5, 0.2, 12, 0.6, '[ 학생 ]  학생 프로필 & 학부모 피드백', 32, ORANGE, True)

card(s, 0.3, 1.0, 4.0, 1.4, CARD_RED, RED)
mtext(s, 0.5, 1.05, 3.6, 1.3, [
    ('이런 상황, 겪어보셨죠?', 13, RED, True),
    ('"우리 애 요즘 어떤가요?" 라고 물으면...', 11, DARK, False),
    ('"출석, 성적, 프린트 하나하나 정리해야 해"', 11, DARK, False),
])

card(s, 0.3, 2.55, 4.0, 1.8, CARD_GREEN, GREEN)
mtext(s, 0.5, 2.6, 3.6, 1.7, [
    ('WAWA가 해결합니다', 13, GREEN, True),
    ('학생 프로필 = 모든 정보 한 화면', 11, DARK, False),
    ('', 4, GRAY, False),
    ('성적 추이 차트', 11, DARK, False),
    ('출결 요약 (출석률, 결석, 지각)', 11, DARK, False),
    ('기본 정보 (과목, 담당, 학부모 연락처)', 11, DARK, False),
    ('코멘트 히스토리 (AI 총평 포함)', 11, DARK, False),
])

card(s, 0.3, 4.5, 4.0, 0.7, CARD_ORANGE, ORANGE)
mtext(s, 0.5, 4.55, 3.6, 0.6, [
    ('"우리 애 어때요?" ->', 12, ORANGE, True),
    ('학생 프로필 열어서 보여주면 끝!', 12, DARK, True),
])

# 스크린샷: 학생 목록 -> 야스오 프로필 -> 이즈리얼 프로필
box(s, 4.5, 1.0, 8.5, 0.3, '학생 목록 -> 야스오 프로필 (성적+출결+코멘트) -> 이즈리얼 프로필', 12, ORANGE, True)
img(s, 4.5, 1.35, 2.7, 4.4, '05-student-list.png')
img(s, 7.3, 1.35, 2.9, 4.4, '05-student-profile-yasuo.png')
img(s, 10.3, 1.35, 2.9, 4.4, '05-student-profile-ezreal.png')

box(s, 4.5, 5.8, 2.7, 0.25, '학생 목록', 10, ORANGE, True, PP_ALIGN.CENTER)
box(s, 7.3, 5.8, 2.9, 0.25, '야스오 프로필', 10, ORANGE, True, PP_ALIGN.CENTER)
box(s, 10.3, 5.8, 2.9, 0.25, '이즈리얼 프로필', 10, ORANGE, True, PP_ALIGN.CENTER)


# ============================================================
# SLIDE 8: 보드 — 공지/할일
# ============================================================
s = prs.slides.add_slide(prs.slide_layouts[6]); bg(s)
accent_bar(s, 0, 0, 13.333, GOLD)
box(s, 0.5, 0.2, 12, 0.6, '[ 보드 ]  학원 내 업무 & 일정 관리', 32, GOLD, True)

card(s, 0.3, 1.0, 4.0, 1.4, CARD_RED, RED)
mtext(s, 0.5, 1.05, 3.6, 1.3, [
    ('이런 상황, 겪어보셨죠?', 13, RED, True),
    ('"월말평가 출제 마감이 언제더라?"', 11, DARK, False),
    ('"카톡에서 업무 지시가 묻혀서 까먹었다"', 11, DARK, False),
])

card(s, 0.3, 2.55, 4.0, 2.0, CARD_GREEN, GREEN)
mtext(s, 0.5, 2.6, 3.6, 1.9, [
    ('WAWA가 해결합니다', 13, GREEN, True),
    ('', 4, GRAY, False),
    ('공지사항: 원장 -> 선생님 (핀 고정)', 12, DARK, False),
    ('할일: 담당자 + 마감일 -> 완료 체크', 12, DARK, False),
    ('D-day 표시로 마감일 한눈에', 12, DARK, False),
    ('전체 미완료 현황 확인', 12, DARK, False),
    ('', 4, GRAY, False),
    ('업무 지시 = 공지 | 실행 = 할일', 11, GOLD, True),
])

# 스크린샷: 보드 홈
box(s, 4.5, 1.0, 8.5, 0.3, '고정 공지 + 내 할일 + 전체 미완료 현황', 12, GOLD, True)
img(s, 4.5, 1.35, 8.5, 5.2, '06-board-home.png')

box(s, 4.5, 6.6, 8.5, 0.3, '공지(D-12 월말평가) | 할일(D-5 학부모상담, D-7 출제) | 완료 체크', 11, DARK, False)


# ============================================================
# SLIDE 9: 하루 흐름 총정리
# ============================================================
s = prs.slides.add_slide(prs.slide_layouts[6]); bg(s)
accent_bar(s, 0, 0, 13.333, BLUE)
box(s, 0.5, 0.3, 12, 0.7, '선생님의 하루 — WAWA와 함께', 34, BLACK, True)
box(s, 0.5, 0.85, 12, 0.4, '하이머딩거 선생님의 월요일을 따라가봅니다', 14, GRAY, False)

day_flow = [
    ('15:50', '출근', '보드 확인 -> 오늘 할일 체크  |  "월말평가 출제 D-7"', GOLD, '보드'),
    ('16:00', '1교시', '이즈리얼/럭스 수업 시작  |  럭스 5분 지각 -> 자동 기록', BLUE, '수업'),
    ('17:30', '종료', '수업 완료 -> 출석 자동 저장  |  이즈리얼 90분, 럭스 85분', BLUE, '수업'),
    ('17:40', '교재', '야스오 "방정식 심화(3)" 출력  |  에코 "시간관리 프린트" 배부 체크', PURPLE, '교재'),
    ('18:00', '2교시', '야스오/아리 수업 시작  |  야스오 18:40 외출(5분) -> 자동 차감', BLUE, '수업'),
    ('19:30', '종료', '수업 완료 -> 야스오 순수 83분  |  아리 90분', BLUE, '수업'),
    ('19:35', '보강', '징크스 토요일 보강 확인  |  카타리나 보강 -> 타론에게 연락', RED, '보강'),
    ('20:00', '3교시', '이렐리아 수업 -> 질문 많아 10분 연장', BLUE, '수업'),
    ('21:40', '퇴근', '[퇴근] 버튼 -> 미출석 자동 결석 + 보강 자동 생성', GREEN, '수업'),
    ('21:45', '리포트', '3월 미전송 확인 -> 럭스 리포트 카카오톡 전송', GREEN, '평가'),
]

for i, (time, title, desc, color, tab) in enumerate(day_flow):
    y = 1.4 + i * 0.58
    row_bg = CARD_WHITE if i % 2 == 0 else BG_LIGHT
    card(s, 0.4, y - 0.02, 12.5, 0.52, row_bg)
    box(s, 0.5, y, 0.8, 0.48, time, 13, BLUE, True)
    tab_card = card(s, 1.4, y + 0.06, 0.7, 0.35, color)
    box(s, 1.4, y + 0.06, 0.7, 0.35, tab, 10, WHITE, True, PP_ALIGN.CENTER)
    box(s, 2.2, y, 1.4, 0.48, title, 13, BLACK, True)
    box(s, 3.7, y, 9.0, 0.48, desc, 11, DARK, False)


# ============================================================
# SLIDE 10: 시작하기
# ============================================================
s = prs.slides.add_slide(prs.slide_layouts[6]); bg(s)
accent_bar(s, 0, 0, 13.333, BLUE)
box(s, 1, 0.6, 11.3, 0.8, 'WAWA Smart ERP', 48, BLUE, True, PP_ALIGN.CENTER)
box(s, 1, 1.5, 11.3, 0.5, '지금 바로 체험해보세요', 22, DARK, False, PP_ALIGN.CENTER)

card(s, 2.5, 2.4, 8.3, 2.5, CARD_BLUE, BLUE)
mtext(s, 2.8, 2.5, 7.8, 2.3, [
    ('데모 접속 방법', 20, BLUE, True),
    ('', 6, GRAY, False),
    ('1.  wawa-smart-erp.pages.dev 접속', 15, DARK, False),
    ('2.  학원 선택: (test)협곡점', 15, DARK, False),
    ('3.  로그인 (아래 계정 중 선택)', 15, DARK, False),
    ('', 6, GRAY, False),
    ('협곡원장 / 1234  ->  관리자 (전체 기능)', 14, GOLD, False),
    ('하이머딩거 / 1234  ->  수학 선생님 (담당 학생 7명)', 14, BLUE, False),
    ('소라카 / 1234  ->  영어 선생님 (담당 학생 4명)', 14, GREEN, False),
])

card(s, 2.5, 5.2, 8.3, 2.0, CARD_WHITE, BLUE)
mtext(s, 2.8, 5.3, 7.8, 1.8, [
    ('WAWA가 해결하는 것들', 16, BLUE, True),
    ('', 4, GRAY, False),
    ('수업시간 — 지각/외출/연장 자동 계산, 수기 기록 불필요', 12, DARK, False),
    ('성적/리포트 — 점수 입력 -> 리포트 자동 생성 -> 학부모 원클릭 전송', 12, DARK, False),
    ('교재 — 학생별 맞춤 프린트 배부/진행 추적', 12, DARK, False),
    ('보강 — 결석 -> 보강 자동 생성 -> 일정 관리', 12, DARK, False),
    ('학생 피드백 — 출석/성적/프린트 통합 한 화면', 12, DARK, False),
    ('업무 관리 — 공지/할일 D-day 기반 관리', 12, DARK, False),
])


# 저장
out = '/mnt/g/progress/wawa/wawa_smart_erp/docs/WAWA_ERP_유즈케이스_선생님가이드.pptx'
prs.save(out)
print(f'PPT saved: {out}')
print(f'Slides: {len(prs.slides)}')
