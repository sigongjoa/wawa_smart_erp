"""
WAWA Smart ERP — 선생님용 유즈케이스 가이드 PPT v4
스크린샷 1장 = 슬라이드 1장, 밝은 배경
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

# ── 색상 ──
BG = RGBColor(0xFA, 0xFA, 0xFC)
CARD_W = RGBColor(0xFF, 0xFF, 0xFF)
CARD_BLUE = RGBColor(0xEE, 0xF3, 0xFF)
CARD_GREEN = RGBColor(0xEC, 0xFA, 0xF0)
CARD_RED = RGBColor(0xFD, 0xED, 0xED)
CARD_PURPLE = RGBColor(0xF3, 0xED, 0xFD)
CARD_ORANGE = RGBColor(0xFF, 0xF3, 0xE6)
CARD_GOLD = RGBColor(0xFD, 0xF6, 0xE3)
BG_LIGHT = RGBColor(0xF0, 0xF2, 0xF7)

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

def bg(slide):
    slide.background.fill.solid()
    slide.background.fill.fore_color.rgb = BG

def bar(slide, color):
    s = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(0), Inches(0), Inches(13.333), Inches(0.06))
    s.fill.solid(); s.fill.fore_color.rgb = color; s.line.fill.background()

def box(slide, l, t, w, h, txt, sz=18, c=BLACK, b=False, al=PP_ALIGN.LEFT):
    tb = slide.shapes.add_textbox(Inches(l), Inches(t), Inches(w), Inches(h))
    tf = tb.text_frame; tf.word_wrap = True
    p = tf.paragraphs[0]; p.text = txt; p.font.size = Pt(sz)
    p.font.color.rgb = c; p.font.bold = b; p.alignment = al

def card(slide, l, t, w, h, fc=CARD_W, bc=None):
    s = slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(l), Inches(t), Inches(w), Inches(h))
    s.fill.solid(); s.fill.fore_color.rgb = fc
    if bc: s.line.color.rgb = bc; s.line.width = Pt(1.5)
    else: s.line.color.rgb = RGBColor(0xE0, 0xE0, 0xE8); s.line.width = Pt(0.75)
    s.shadow.inherit = False

def mtext(slide, l, t, w, h, lines):
    tb = slide.shapes.add_textbox(Inches(l), Inches(t), Inches(w), Inches(h))
    tf = tb.text_frame; tf.word_wrap = True
    for i, (txt, sz, c, b) in enumerate(lines):
        p = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
        p.text = txt; p.font.size = Pt(sz); p.font.color.rgb = c; p.font.bold = b
        p.space_after = Pt(4)

def img(slide, l, t, w, h, filename):
    fp = os.path.join(SHOT_DIR, filename)
    if os.path.exists(fp):
        slide.shapes.add_picture(fp, Inches(l), Inches(t), Inches(w), Inches(h))


def screenshot_slide(section, section_color, title, desc_lines, screenshot, step_label=None):
    """스크린샷 1장 = 슬라이드 1장. 왼쪽 설명, 오른쪽 스크린샷."""
    s = prs.slides.add_slide(prs.slide_layouts[6]); bg(s); bar(s, section_color)

    # 섹션 배지 + 제목
    box(s, 0.5, 0.25, 1.2, 0.45, section, 14, WHITE, True, PP_ALIGN.CENTER)
    badge = s.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(0.4), Inches(0.2), Inches(1.0), Inches(0.45))
    badge.fill.solid(); badge.fill.fore_color.rgb = section_color
    badge.line.fill.background(); badge.shadow.inherit = False
    box(s, 0.45, 0.22, 0.9, 0.4, section, 14, WHITE, True, PP_ALIGN.CENTER)

    box(s, 1.6, 0.2, 5.0, 0.5, title, 24, BLACK, True)

    if step_label:
        box(s, 1.6, 0.65, 5.0, 0.3, step_label, 13, section_color, True)

    # 왼쪽 설명
    mtext(s, 0.5, 1.1, 4.5, 5.5, desc_lines)

    # 오른쪽 스크린샷 (큼직하게)
    card(s, 5.3, 0.8, 7.7, 6.3, CARD_W, section_color)
    img(s, 5.5, 1.0, 7.3, 5.9, screenshot)


# ============================================================
# SLIDE 1: 표지
# ============================================================
s = prs.slides.add_slide(prs.slide_layouts[6]); bg(s); bar(s, BLUE)
card(s, 2.5, 1.2, 8.3, 5.0, CARD_W, BLUE)
box(s, 3, 1.8, 7.3, 1, 'WAWA Smart ERP', 52, BLUE, True, PP_ALIGN.CENTER)
box(s, 3, 3.0, 7.3, 0.6, '학원 선생님을 위한 유즈케이스 가이드', 22, DARK, False, PP_ALIGN.CENTER)
mtext(s, 3.3, 3.8, 6.8, 1.8, [
    ('선생님이 학생 관리에 쓰는 시간을 줄여드립니다', 16, GRAY, False),
    ('', 10, GRAY, False),
    ('수업시간 관리  |  성적 평가 & 리포트  |  교재/프린트 관리', 14, DARK, False),
    ('결석 & 보강 일정  |  학생 성장 피드백  |  학원 내 업무 관리', 14, DARK, False),
])
box(s, 2.5, 6.5, 8.3, 0.4, '실제 화면 스크린샷 포함  |  LoL 세계관 데모 데이터', 13, LGRAY, False, PP_ALIGN.CENTER)


# ============================================================
# SLIDE 2: 6개 기능 한눈에
# ============================================================
s = prs.slides.add_slide(prs.slide_layouts[6]); bg(s); bar(s, BLUE)
box(s, 0.5, 0.3, 12, 0.7, '전체 기능 한눈에 보기', 34, BLACK, True)
box(s, 0.5, 0.9, 12, 0.4, '선생님의 하루를 따라가는 6가지 핵심 기능', 14, GRAY, False)
features = [
    ('수업', '수업 시간 관리', '학생별 실시간 타이머\n지각/화장실/외출 등\n순수 수업시간 자동 계산', BLUE, CARD_BLUE),
    ('평가', '성적 & 리포트', '월말평가 성적 입력\n과목별 코멘트 작성\n학부모 리포트 전송', GREEN, CARD_GREEN),
    ('교재', '교재 & 프린트', '학생별 맞춤 프린트\n제작/배부 현황 관리\n여러 학생 동시 관리', PURPLE, CARD_PURPLE),
    ('보강', '결석 & 보강', '결석 사유 기록\n보강 일정 자동 관리\n학생 많아도 빠짐없이', RED, CARD_RED),
    ('학생', '학생 성장 피드백', '학생별 종합 현황\n학부모 주기적 피드백\n출석/성적/프린트 통합', ORANGE, CARD_ORANGE),
    ('보드', '학원 업무 관리', '공지사항 & 할일\n선생님간 업무 공유\n마감일 기반 관리', GOLD, CARD_GOLD),
]
for i, (tab, title, desc, color, cbg) in enumerate(features):
    col = i % 3; row = i // 3
    x = 0.5 + col * 4.15; y = 1.5 + row * 2.85
    card(s, x, y, 3.95, 2.65, cbg, color)
    mtext(s, x + 0.2, y + 0.15, 3.55, 2.4, [
        (f'[ {tab} ]  {title}', 16, color, True),
        ('', 6, GRAY, False),
        (desc, 13, DARK, False),
    ])


# ============================================================
# 수업 (4슬라이드)
# ============================================================
screenshot_slide('수업', BLUE,
    '학생 카드 탭 → 수업 시작',
    [
        ('학생별 실시간 타이머', 16, BLUE, True),
        ('', 6, GRAY, False),
        ('대기 중인 학생 카드를 탭하면', 14, DARK, False),
        ('수업이 바로 시작됩니다.', 14, DARK, False),
        ('', 8, GRAY, False),
        ('타이머가 자동으로 돌아가며', 14, DARK, False),
        ('순수 수업시간을 측정합니다.', 14, DARK, False),
        ('', 12, GRAY, False),
        ('요일별 필터로', 13, GRAY, False),
        ('해당 요일 수업 학생만 표시', 13, GRAY, False),
    ],
    '01-timer-session-started.png',
    'STEP 1 — 수업 시작'
)

screenshot_slide('수업', BLUE,
    '정지 버튼 → 사유 선택',
    [
        ('수업 중 이탈 시 자동 관리', 16, BLUE, True),
        ('', 6, GRAY, False),
        ('[정지] 버튼을 누르면', 14, DARK, False),
        ('사유 선택 화면이 나타납니다.', 14, DARK, False),
        ('', 8, GRAY, False),
        ('외출 / 휴식 / 화장실 / 기타', 14, DARK, True),
        ('', 8, GRAY, False),
        ('"야스오가 바람 쐬러 나갔다가', 13, GRAY, False),
        (' 5분 뒤에 돌아왔는데...', 13, GRAY, False),
        (' 수업시간에서 빼야 하나?"', 13, GRAY, False),
        ('', 6, GRAY, False),
        ('→ WAWA가 자동으로 빼줍니다', 13, GREEN, True),
    ],
    '01-timer-pause-sheet.png',
    'STEP 2 — 일시정지 사유 선택'
)

screenshot_slide('수업', BLUE,
    '일시정지 상태 → 재개',
    [
        ('정지된 시간은 자동 차감', 16, BLUE, True),
        ('', 6, GRAY, False),
        ('정지 중에는 카드가', 14, DARK, False),
        ('노란색으로 변하고', 14, DARK, False),
        ('"정지" 배지가 표시됩니다.', 14, DARK, False),
        ('', 8, GRAY, False),
        ('[재개] 버튼 → 타이머 다시 시작', 14, DARK, True),
        ('', 8, GRAY, False),
        ('정지된 시간은 순수 수업시간에서', 13, GRAY, False),
        ('자동으로 차감됩니다.', 13, GRAY, False),
        ('', 8, GRAY, False),
        ('화장실 5분, 간식 3분 등', 13, GRAY, False),
        ('모든 이탈 시간이 기록됩니다.', 13, GRAY, False),
    ],
    '01-timer-paused.png',
    'STEP 3 — 일시정지 & 재개'
)

screenshot_slide('수업', BLUE,
    '수업 완료 → 퇴근',
    [
        ('수업 완료 & 하루 마감', 16, BLUE, True),
        ('', 6, GRAY, False),
        ('[완료] 버튼 → 수업 종료', 14, DARK, True),
        ('순수 수업시간이 자동 저장됩니다.', 14, DARK, False),
        ('', 8, GRAY, False),
        ('모든 수업이 끝나면:', 14, DARK, False),
        ('', 4, GRAY, False),
        ('[퇴근] 버튼 클릭', 14, RED, True),
        ('', 4, GRAY, False),
        ('→ 수업 안 온 학생 자동 감지', 13, DARK, False),
        ('→ 일괄 결석 처리', 13, DARK, False),
        ('→ 보강 자동 생성', 13, DARK, False),
        ('', 8, GRAY, False),
        ('하루 끝!', 14, GREEN, True),
    ],
    '01-timer-session-done.png',
    'STEP 4 — 완료 & 퇴근'
)


# ============================================================
# 평가 (4슬라이드)
# ============================================================
screenshot_slide('평가', GREEN,
    '학생 선택 → 성적 입력',
    [
        ('점수만 입력하면 자동 저장', 16, GREEN, True),
        ('', 6, GRAY, False),
        ('왼쪽 목록에서 학생을 선택하면', 14, DARK, False),
        ('오른쪽에 성적 입력 폼이 나타납니다.', 14, DARK, False),
        ('', 8, GRAY, False),
        ('점수를 입력하고 다른 곳을 클릭하면', 14, DARK, False),
        ('자동으로 저장됩니다. (blur 저장)', 14, DARK, True),
        ('', 8, GRAY, False),
        ('별도 [저장] 버튼이 필요 없습니다.', 13, GRAY, False),
        ('', 8, GRAY, False),
        ('과목별 바 차트로', 13, GRAY, False),
        ('점수가 시각적으로 표시됩니다.', 13, GRAY, False),
    ],
    '02-report-score-entered.png',
    'STEP 1 — 성적 입력'
)

screenshot_slide('평가', GREEN,
    '코멘트 작성 (직접 or AI)',
    [
        ('과목별 선생님 코멘트', 16, GREEN, True),
        ('', 6, GRAY, False),
        ('각 과목 아래에 코멘트를', 14, DARK, False),
        ('직접 작성하거나,', 14, DARK, False),
        ('', 4, GRAY, False),
        ('[AI 코멘트 생성] 클릭 →', 14, DARK, True),
        ('출석/성적 기반 자동 코멘트', 14, DARK, False),
        ('', 8, GRAY, False),
        ('총평도 [AI 총평 생성]으로', 13, GRAY, False),
        ('자동 생성 가능합니다.', 13, GRAY, False),
        ('', 8, GRAY, False),
        ('"방정식 기초가 많이 개선되었습니다.', 12, LGRAY, False),
        (' 연립방정식으로 넘어가도 좋을 것', 12, LGRAY, False),
        (' 같습니다."', 12, LGRAY, False),
    ],
    '02-report-comment-written.png',
    'STEP 2 — 코멘트 작성'
)

screenshot_slide('평가', GREEN,
    '카카오톡 공유 → 학부모 전송',
    [
        ('원클릭 학부모 전송', 16, GREEN, True),
        ('', 6, GRAY, False),
        ('[카카오톡 공유] 버튼 클릭 →', 14, DARK, True),
        ('', 4, GRAY, False),
        ('리포트 이미지가 자동 업로드되고', 14, DARK, False),
        ('공유 메시지가 클립보드에 복사됩니다.', 14, DARK, False),
        ('', 8, GRAY, False),
        ('카카오톡에서 붙여넣기만 하면 끝!', 14, GREEN, True),
        ('', 8, GRAY, False),
        ('[JPG 다운로드]로 직접', 13, GRAY, False),
        ('이미지를 저장할 수도 있습니다.', 13, GRAY, False),
        ('', 8, GRAY, False),
        ('전송 현황: 0/7 → 1/7 → ... → 7/7', 13, GRAY, False),
    ],
    '02-report-share.png',
    'STEP 3 — 학부모 전송'
)

screenshot_slide('평가', GREEN,
    '실제 생성된 학부모 리포트',
    [
        ('학부모가 받는 리포트', 16, GREEN, True),
        ('', 6, GRAY, False),
        ('리포트에 포함되는 정보:', 14, DARK, True),
        ('', 4, GRAY, False),
        ('학원명, 학생명, 월/학기', 14, DARK, False),
        ('', 4, GRAY, False),
        ('과목별 점수 (바 차트)', 14, DARK, False),
        ('', 4, GRAY, False),
        ('과목별 선생님 코멘트', 14, DARK, False),
        ('', 4, GRAY, False),
        ('AI 총평 (선택)', 14, DARK, False),
        ('', 12, GRAY, False),
        ('깔끔한 디자인으로', 13, GRAY, False),
        ('학부모님이 한눈에 파악할 수 있습니다.', 13, GRAY, False),
    ],
    '02-report-downloaded.jpg',
    '완성된 리포트 이미지'
)


# ============================================================
# 교재 (2슬라이드)
# ============================================================
screenshot_slide('교재', PURPLE,
    '학생별 맞춤 프린트 관리',
    [
        ('누구한테 뭘 줬는지 한눈에', 16, PURPLE, True),
        ('', 6, GRAY, False),
        ('학생별로 맞춤 프린트를 등록하고', 14, DARK, False),
        ('제작/배부 상태를 추적합니다.', 14, DARK, False),
        ('', 8, GRAY, False),
        ('학생 1명 = 프린트 N장', 14, DARK, True),
        ('각각 독립적으로 관리', 14, DARK, False),
        ('', 8, GRAY, False),
        ('예시:', 13, GRAY, True),
        ('야스오: 방정식 기초(1)(2) 완료,', 13, GRAY, False),
        ('       방정식 심화(3) 대기중', 13, GRAY, False),
        ('에코: 시간관리 프린트 대기중', 13, GRAY, False),
        ('이즈리얼: 연산 집중 훈련 대기중', 13, GRAY, False),
    ],
    '03-materials-home.png',
    '전체 교재 목록'
)

screenshot_slide('교재', PURPLE,
    '미완료 필터 → 오늘 할 일 확인',
    [
        ('미완료만 모아보기', 16, PURPLE, True),
        ('', 6, GRAY, False),
        ('[미완료] 필터를 누르면', 14, DARK, False),
        ('아직 배부하지 않은 프린트만', 14, DARK, False),
        ('한눈에 볼 수 있습니다.', 14, DARK, False),
        ('', 8, GRAY, False),
        ('학생이 많아져도', 14, DARK, False),
        ('빠뜨리는 일이 없습니다.', 14, DARK, True),
        ('', 8, GRAY, False),
        ('[완료] 필터 → 이미 나눠준 것 확인', 13, GRAY, False),
        ('[전체] → 모든 교재 보기', 13, GRAY, False),
        ('', 8, GRAY, False),
        ('"프린트 만들었는데 나눠줬는지', 12, LGRAY, False),
        (' 안 줬는지 모르겠어" → 해결!', 12, LGRAY, False),
    ],
    '03-materials-incomplete.png',
    '미완료 필터'
)


# ============================================================
# 보강 (3슬라이드)
# ============================================================
screenshot_slide('보강', RED,
    '결석 & 보강 전체 현황',
    [
        ('결석 → 보강 자동 생성', 16, RED, True),
        ('', 6, GRAY, False),
        ('결석하면 보강이 자동 생성됩니다.', 14, DARK, False),
        ('', 8, GRAY, False),
        ('두 가지 결석 경로:', 14, DARK, True),
        ('', 4, GRAY, False),
        ('A. 학부모 사전 연락', 13, BLUE, True),
        ('   → 선생님이 결석 등록', 13, DARK, False),
        ('   → 보강 자동 생성', 13, DARK, False),
        ('', 4, GRAY, False),
        ('B. 당일 무단결석', 13, RED, True),
        ('   → [퇴근] 버튼 클릭', 13, DARK, False),
        ('   → 자동 결석 감지 + 보강 생성', 13, DARK, False),
        ('', 8, GRAY, False),
        ('미보강 / 보강예정 / 완료', 13, GRAY, False),
        ('필터로 상태별 확인', 13, GRAY, False),
    ],
    '04-absence-home.png',
    '보강 관리 전체 화면'
)

screenshot_slide('보강', RED,
    '보강일 날짜 입력 → 지정',
    [
        ('보강 일정 잡기', 16, RED, True),
        ('', 6, GRAY, False),
        ('미보강 항목에서', 14, DARK, False),
        ('날짜를 선택하고 [지정]을 누르면', 14, DARK, False),
        ('보강 일정이 확정됩니다.', 14, DARK, False),
        ('', 8, GRAY, False),
        ('학부모와 조율한 날짜를', 14, DARK, False),
        ('바로 입력하면 됩니다.', 14, DARK, False),
        ('', 12, GRAY, False),
        ('"징크스 보강이 토요일이었나', 12, LGRAY, False),
        (' 월요일이었나..." → 해결!', 12, LGRAY, False),
    ],
    '04-absence-date-entered.png',
    '보강일 지정'
)

screenshot_slide('보강', RED,
    '보강 일정 확정 완료',
    [
        ('보강예정 → 완료', 16, RED, True),
        ('', 6, GRAY, False),
        ('보강일이 지정되면', 14, DARK, False),
        ('상태가 "보강예정"으로 변경됩니다.', 14, DARK, False),
        ('', 8, GRAY, False),
        ('보강 수업 후 [완료] 버튼으로', 14, DARK, False),
        ('최종 완료 처리.', 14, DARK, True),
        ('', 12, GRAY, False),
        ('학생이 15명이어도', 13, GRAY, False),
        ('누가 보강이 밀려있는지', 13, GRAY, False),
        ('한눈에 파악할 수 있습니다.', 13, GRAY, False),
    ],
    '04-absence-scheduled-done.png',
    '보강 확정 완료'
)


# ============================================================
# 학생 (2슬라이드)
# ============================================================
screenshot_slide('학생', ORANGE,
    '학생 프로필 — 모든 정보 한 화면',
    [
        ('"우리 애 어때요?" → 이 화면!', 16, ORANGE, True),
        ('', 6, GRAY, False),
        ('야스오 프로필 예시:', 14, DARK, True),
        ('', 4, GRAY, False),
        ('성적 추이 차트 (6개월/12개월)', 14, DARK, False),
        ('', 4, GRAY, False),
        ('출결 요약 (출석률, 결석, 지각)', 14, DARK, False),
        ('  → 최근 결석: 바람따라 어디론가...', 12, LGRAY, False),
        ('', 4, GRAY, False),
        ('기본 정보 (과목, 담당, 학부모 연락처)', 14, DARK, False),
        ('', 4, GRAY, False),
        ('코멘트 히스토리', 14, DARK, False),
        ('  → 3월: "재능은 있으나 결석과 지각이', 12, LGRAY, False),
        ('    잦아 진도가 밀림"', 12, LGRAY, False),
        ('', 8, GRAY, False),
        ('학부모 상담 시 열어서 보여주면 끝!', 13, GREEN, True),
    ],
    '05-student-profile-yasuo.png',
    '야스오 — 학생 프로필'
)

screenshot_slide('학생', ORANGE,
    '학생별 성적/출결/코멘트 통합',
    [
        ('이즈리얼 프로필 예시', 16, ORANGE, True),
        ('', 6, GRAY, False),
        ('학생마다 독립적인 프로필 페이지', 14, DARK, False),
        ('', 8, GRAY, False),
        ('성적 추이, 출결, 코멘트가', 14, DARK, False),
        ('한 페이지에 통합되어 있어', 14, DARK, False),
        ('여러 시스템을 돌아다닐 필요가 없습니다.', 14, DARK, False),
        ('', 12, GRAY, False),
        ('"출석은 어떤지, 성적은 어떤지,', 12, LGRAY, False),
        (' 프린트는 잘 하고 있는지', 12, LGRAY, False),
        (' 이걸 학생마다 정리하려면', 12, LGRAY, False),
        (' 시간이 너무 걸려"', 12, LGRAY, False),
        ('', 6, GRAY, False),
        ('→ WAWA가 자동으로 모아줍니다', 13, GREEN, True),
    ],
    '05-student-profile-ezreal.png',
    '이즈리얼 — 학생 프로필'
)


# ============================================================
# 보드 (1슬라이드)
# ============================================================
screenshot_slide('보드', GOLD,
    '공지 + 할일 + D-day 관리',
    [
        ('카톡에서 안 묻히는 업무 관리', 16, GOLD, True),
        ('', 6, GRAY, False),
        ('고정 공지:', 14, DARK, True),
        ('  4월 월말평가 안내 (D-12)', 13, DARK, False),
        ('', 4, GRAY, False),
        ('최근 공지:', 14, DARK, True),
        ('  학부모 상담 주간 (4/21~25)', 13, DARK, False),
        ('  중2 수학 교재 변경', 13, DARK, False),
        ('', 4, GRAY, False),
        ('내 할일:', 14, DARK, True),
        ('  학부모 상담 일정 (D-5)', 13, DARK, False),
        ('  수학 월말평가 출제 (D-7)', 13, DARK, False),
        ('  야스오 보충 프린트 (완료 ✓)', 13, GREEN, False),
        ('', 8, GRAY, False),
        ('업무 지시 = 공지 | 실행 = 할일', 13, GOLD, True),
        ('마감일(D-day) 기반으로 관리', 13, GRAY, False),
    ],
    '06-board-home.png',
    '보드 — 공지/할일 전체 화면'
)


# ============================================================
# 하루 타임라인
# ============================================================
s = prs.slides.add_slide(prs.slide_layouts[6]); bg(s); bar(s, BLUE)
box(s, 0.5, 0.3, 12, 0.7, '선생님의 하루 — WAWA와 함께', 34, BLACK, True)
box(s, 0.5, 0.9, 12, 0.4, '하이머딩거 선생님의 월요일을 따라가봅니다', 14, GRAY, False)

day_flow = [
    ('15:50', '출근', '보드 확인 → 오늘 할일 체크  |  "월말평가 출제 D-7"', GOLD, '보드'),
    ('16:00', '1교시', '이즈리얼/럭스 수업 시작  |  럭스 5분 지각 → 자동 기록', BLUE, '수업'),
    ('17:30', '종료', '수업 완료 → 출석 자동 저장  |  이즈리얼 90분, 럭스 85분', BLUE, '수업'),
    ('17:40', '교재', '야스오 "방정식 심화(3)" 출력  |  에코 "시간관리 프린트" 배부', PURPLE, '교재'),
    ('18:00', '2교시', '야스오/아리 수업 시작  |  야스오 18:40 외출(5분) → 자동 차감', BLUE, '수업'),
    ('19:30', '종료', '수업 완료 → 야스오 순수 83분  |  아리 90분', BLUE, '수업'),
    ('19:35', '보강', '징크스 토요일 보강 확인  |  카타리나 보강 → 타론에게 연락', RED, '보강'),
    ('20:00', '3교시', '이렐리아 수업 → 질문 많아 10분 연장', BLUE, '수업'),
    ('21:40', '퇴근', '[퇴근] 버튼 → 미출석 자동 결석 + 보강 자동 생성', GREEN, '수업'),
    ('21:45', '리포트', '3월 미전송 확인 → 럭스 리포트 카톡 전송', GREEN, '평가'),
]
for i, (time, title, desc, color, tab) in enumerate(day_flow):
    y = 1.5 + i * 0.56
    row_bg = CARD_W if i % 2 == 0 else BG_LIGHT
    card(s, 0.4, y - 0.02, 12.5, 0.5, row_bg)
    box(s, 0.5, y, 0.8, 0.46, time, 13, BLUE, True)
    badge = s.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(1.4), Inches(y + 0.06), Inches(0.7), Inches(0.32))
    badge.fill.solid(); badge.fill.fore_color.rgb = color; badge.line.fill.background(); badge.shadow.inherit = False
    box(s, 1.42, y + 0.05, 0.66, 0.33, tab, 10, WHITE, True, PP_ALIGN.CENTER)
    box(s, 2.2, y, 1.4, 0.46, title, 13, BLACK, True)
    box(s, 3.7, y, 9.0, 0.46, desc, 11, DARK, False)


# ============================================================
# 시작하기
# ============================================================
s = prs.slides.add_slide(prs.slide_layouts[6]); bg(s); bar(s, BLUE)
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
    ('협곡원장 / 1234  →  관리자 (전체 기능)', 14, GOLD, False),
    ('하이머딩거 / 1234  →  수학 선생님 (담당 학생 7명)', 14, BLUE, False),
    ('소라카 / 1234  →  영어 선생님 (담당 학생 4명)', 14, GREEN, False),
])

card(s, 2.5, 5.2, 8.3, 2.0, CARD_W, BLUE)
mtext(s, 2.8, 5.3, 7.8, 1.8, [
    ('WAWA가 해결하는 것들', 16, BLUE, True),
    ('', 4, GRAY, False),
    ('수업시간 — 지각/외출/연장 자동 계산, 수기 기록 불필요', 12, DARK, False),
    ('성적/리포트 — 점수 입력 → 리포트 자동 생성 → 학부모 원클릭 전송', 12, DARK, False),
    ('교재 — 학생별 맞춤 프린트 배부/진행 추적', 12, DARK, False),
    ('보강 — 결석 → 보강 자동 생성 → 일정 관리', 12, DARK, False),
    ('학생 피드백 — 출석/성적/프린트 통합 한 화면', 12, DARK, False),
    ('업무 관리 — 공지/할일 D-day 기반 관리', 12, DARK, False),
])


# 저장
out = '/mnt/g/progress/wawa/wawa_smart_erp/docs/WAWA_ERP_Usecase_Guide.pptx'
prs.save(out)
print(f'PPT saved: {out}')
print(f'Slides: {len(prs.slides)}')
