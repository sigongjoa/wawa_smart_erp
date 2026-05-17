"""
WAWA Smart ERP — (test)협곡점 유즈케이스 PPT 생성
LoL 세계관 데모 데이터 기반
"""
from pptx import Presentation
from pptx.util import Inches, Pt, Emu
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN, MSO_ANCHOR
from pptx.enum.shapes import MSO_SHAPE

prs = Presentation()
prs.slide_width = Inches(13.333)
prs.slide_height = Inches(7.5)

# ── 색상 팔레트 ──
BG_DARK = RGBColor(0x1A, 0x1A, 0x2E)
BG_CARD = RGBColor(0x25, 0x25, 0x3D)
ACCENT_BLUE = RGBColor(0x4A, 0x90, 0xD9)
ACCENT_GOLD = RGBColor(0xF0, 0xB9, 0x0B)
ACCENT_GREEN = RGBColor(0x22, 0xC5, 0x5E)
ACCENT_RED = RGBColor(0xE5, 0x3E, 0x3E)
ACCENT_PURPLE = RGBColor(0x9B, 0x59, 0xB6)
WHITE = RGBColor(0xFF, 0xFF, 0xFF)
GRAY = RGBColor(0xAA, 0xAA, 0xAA)
LIGHT_GRAY = RGBColor(0xDD, 0xDD, 0xDD)

def set_slide_bg(slide, color):
    bg = slide.background
    fill = bg.fill
    fill.solid()
    fill.fore_color.rgb = color

def add_text_box(slide, left, top, width, height, text, font_size=18, color=WHITE, bold=False, align=PP_ALIGN.LEFT):
    txBox = slide.shapes.add_textbox(Inches(left), Inches(top), Inches(width), Inches(height))
    tf = txBox.text_frame
    tf.word_wrap = True
    p = tf.paragraphs[0]
    p.text = text
    p.font.size = Pt(font_size)
    p.font.color.rgb = color
    p.font.bold = bold
    p.alignment = align
    return txBox

def add_card(slide, left, top, width, height, fill_color=BG_CARD, border_color=None):
    shape = slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(left), Inches(top), Inches(width), Inches(height))
    shape.fill.solid()
    shape.fill.fore_color.rgb = fill_color
    if border_color:
        shape.line.color.rgb = border_color
        shape.line.width = Pt(1.5)
    else:
        shape.line.fill.background()
    shape.shadow.inherit = False
    return shape

def add_multi_text(slide, left, top, width, height, lines, base_size=14):
    """lines: list of (text, font_size, color, bold)"""
    txBox = slide.shapes.add_textbox(Inches(left), Inches(top), Inches(width), Inches(height))
    tf = txBox.text_frame
    tf.word_wrap = True
    for i, (text, size, color, bold) in enumerate(lines):
        if i == 0:
            p = tf.paragraphs[0]
        else:
            p = tf.add_paragraph()
        p.text = text
        p.font.size = Pt(size)
        p.font.color.rgb = color
        p.font.bold = bold
        p.space_after = Pt(4)
    return txBox

# ============================================
# SLIDE 1: 표지
# ============================================
slide = prs.slides.add_slide(prs.slide_layouts[6])  # blank
set_slide_bg(slide, BG_DARK)

add_text_box(slide, 1, 0.8, 11.3, 1, 'WAWA Smart ERP', 48, ACCENT_GOLD, True, PP_ALIGN.CENTER)
add_text_box(slide, 1, 1.8, 11.3, 0.6, '학원 학습 관리 시스템  |  유즈케이스 가이드', 22, GRAY, False, PP_ALIGN.CENTER)

add_card(slide, 3.5, 3, 6.3, 2.8, RGBColor(0x20, 0x20, 0x38), ACCENT_BLUE)
add_multi_text(slide, 3.8, 3.2, 5.8, 2.5, [
    ('(test)협곡점  데모', 28, ACCENT_GOLD, True),
    ('', 8, GRAY, False),
    ('리그 오브 레전드 세계관 기반 데모 데이터', 16, LIGHT_GRAY, False),
    ('학생 8명 · 선생님 2명 · 원장 1명', 16, LIGHT_GRAY, False),
    ('', 8, GRAY, False),
    ('접속: wawa-smart-erp.pages.dev', 14, ACCENT_BLUE, False),
    ('학원: (test)협곡점 → 협곡원장 / PIN: 1234', 14, ACCENT_BLUE, False),
])

add_text_box(slide, 1, 6.5, 11.3, 0.5, '© 2026 WAWA Education Technology', 12, GRAY, False, PP_ALIGN.CENTER)

# ============================================
# SLIDE 2: 등장인물 소개
# ============================================
slide = prs.slides.add_slide(prs.slide_layouts[6])
set_slide_bg(slide, BG_DARK)

add_text_box(slide, 0.5, 0.3, 12, 0.8, '등장인물 소개', 36, ACCENT_GOLD, True)
add_text_box(slide, 0.5, 0.95, 12, 0.4, '협곡점의 선생님과 학생들 (LoL 세계관)', 16, GRAY, False)

# 선생님 카드
add_card(slide, 0.5, 1.6, 6, 1.5, RGBColor(0x1E, 0x3A, 0x5F), ACCENT_BLUE)
add_multi_text(slide, 0.8, 1.7, 5.5, 1.3, [
    ('선생님', 20, ACCENT_BLUE, True),
    ('하이머딩거  —  수학 담당  |  "지식이야말로 최고의 무기지!"', 13, WHITE, False),
    ('소라카  —  영어 담당  |  "치유(교육)는 천천히, 확실하게"', 13, WHITE, False),
    ('협곡원장  —  관리자  |  학원 전체 운영', 13, ACCENT_GOLD, False),
])

# 학생 카드들 (4열 2행)
students = [
    ('이즈리얼', '중1 · 수학', '필토버 탐험가 집안', '보호자: 이즈리얼 아버지', '호기심 ↑ 집중력 ↓', ACCENT_BLUE),
    ('럭스', '중1 · 수학/영어', '데마시아 크라운가드', '보호자: 가렌 (오빠)', '전과목 최상위', ACCENT_GOLD),
    ('야스오', '중2 · 수학', '아이오니아 방랑자', '보호자: 요네 (형)', '재능有 출석不', ACCENT_RED),
    ('아리', '중2 · 수학/영어', '아이오니아', '보호자: 아리 어머니', '응용력 뛰어남', ACCENT_PURPLE),
    ('징크스', '중3 · 수학', '자운 출신 천재', '보호자: 바이 (언니)', '속도↑ 차분함↓', ACCENT_RED),
    ('카타리나', '중3 · 영어', '녹서스 명문가', '보호자: 타론 (의형제)', '칼날같은 문법', ACCENT_GREEN),
    ('이렐리아', '고1 · 수학/영어', '아이오니아 무희 가문', '보호자: 이렐리아 어머니', '전교 1등', ACCENT_GOLD),
    ('에코', '고1 · 수학', '자운 천재소년', '보호자: 에코 어머니', '똑똑 but 시간관리↓', ACCENT_BLUE),
]

for i, (name, info, lore, guardian, trait, color) in enumerate(students):
    col = i % 4
    row = i // 4
    x = 0.5 + col * 3.1
    y = 3.4 + row * 2.1
    add_card(slide, x, y, 2.9, 1.9, BG_CARD, color)
    add_multi_text(slide, x + 0.15, y + 0.1, 2.6, 1.7, [
        (name, 20, color, True),
        (info, 11, LIGHT_GRAY, False),
        (lore, 10, GRAY, False),
        (guardian, 10, GRAY, False),
        ('', 4, GRAY, False),
        (f'특징: {trait}', 11, WHITE, False),
    ])

# ============================================
# SLIDE 3: 유즈케이스 1 — 수업 타이머
# ============================================
slide = prs.slides.add_slide(prs.slide_layouts[6])
set_slide_bg(slide, BG_DARK)

add_text_box(slide, 0.5, 0.3, 12, 0.8, 'USE CASE 1: 수업 타이머', 36, ACCENT_BLUE, True)
add_text_box(slide, 0.5, 0.95, 12, 0.4, '"수업" 탭 — 실시간 출석 관리와 수업 시간 기록', 16, GRAY, False)

# 시나리오 카드
add_card(slide, 0.5, 1.6, 12.3, 2.2, RGBColor(0x1E, 0x2D, 0x3D))
add_multi_text(slide, 0.8, 1.7, 11.8, 2.0, [
    ('시나리오: 하이머딩거 선생님의 월요일 수업', 18, ACCENT_GOLD, True),
    ('', 6, GRAY, False),
    ('16:00  이즈리얼 수업 시작 → [시작] 버튼 클릭 → 타이머 가동', 14, WHITE, False),
    ('16:05  럭스 도착 (5분 지각) → "가렌 오빠가 늦게 데려다줌" 메모 → 지각 자동 기록', 14, ACCENT_RED, False),
    ('17:30  이즈리얼, 럭스 수업 종료 → [종료] 버튼 → 출석 기록 자동 저장', 14, WHITE, False),
    ('18:00  야스오 수업 시작 → 18:40 [일시정지] "바람 쐬고 옴" → 18:45 [재개]', 14, WHITE, False),
    ('20:00  이렐리아 수업 → 질문이 많아 21:40까지 10분 연장 → 초과 시간 자동 기록', 14, ACCENT_BLUE, False),
])

# 핵심 기능 카드
features = [
    ('실시간 타이머', '수업 시작/종료\n시간 자동 기록', ACCENT_BLUE),
    ('일시정지', '화장실, 간식 등\n순수 수업시간 계산', ACCENT_PURPLE),
    ('지각/연장 감지', '예정 시간 대비\n자동 판별 & 기록', ACCENT_RED),
    ('메모', '특이사항 즉시 기록\n학부모 상담 시 활용', ACCENT_GREEN),
]
for i, (title, desc, color) in enumerate(features):
    x = 0.5 + i * 3.1
    add_card(slide, x, 4.2, 2.9, 1.6, BG_CARD, color)
    add_multi_text(slide, x + 0.2, 4.3, 2.5, 1.4, [
        (title, 18, color, True),
        ('', 4, GRAY, False),
        (desc, 13, LIGHT_GRAY, False),
    ])

# 하단 요약
add_card(slide, 0.5, 6.1, 12.3, 1.0, RGBColor(0x15, 0x25, 0x15), ACCENT_GREEN)
add_multi_text(slide, 0.8, 6.2, 11.8, 0.8, [
    ('결과: 월요일 하루 동안 5명의 출석 기록이 자동으로 생성됩니다', 15, ACCENT_GREEN, True),
    ('이즈리얼 90분 정상 | 럭스 85분(지각 5분) | 야스오 83분(정지 5분) | 아리 90분 정상 | 이렐리아 95분(연장 10분)', 12, LIGHT_GRAY, False),
])

# ============================================
# SLIDE 4: 유즈케이스 2 — 성적 평가
# ============================================
slide = prs.slides.add_slide(prs.slide_layouts[6])
set_slide_bg(slide, BG_DARK)

add_text_box(slide, 0.5, 0.3, 12, 0.8, 'USE CASE 2: 성적 평가', 36, ACCENT_BLUE, True)
add_text_box(slide, 0.5, 0.95, 12, 0.4, '"평가" 탭 — 월말평가 성적 입력, 성장 추이 확인', 16, GRAY, False)

# 성적표
add_card(slide, 0.5, 1.6, 8.5, 4.5, RGBColor(0x1E, 0x2D, 0x3D))
add_text_box(slide, 0.8, 1.7, 8, 0.5, '3월 월말평가 성적표', 20, ACCENT_GOLD, True)

grade_data = [
    ('학생',       '수학',  '영어',  '총평'),
    ('이즈리얼',   '72',    '—',     '탐험 정신은 좋으나 계산 실수 多'),
    ('럭스',       '94',    '97',    '빛나는 성적. 전과목 최상위'),
    ('야스오',     '58',    '—',     '재능은 있으나 출결 불안정'),
    ('아리',       '89',    '91',    '매력적인 풀이. 응용력 우수'),
    ('징크스',     '81',    '—',     '빠른 속도, 서술형 감점 주의'),
    ('카타리나',   '—',     '88',    '칼날같은 문법. 독해 속도↑ 필요'),
    ('이렐리아',   '96',    '93',    '전교 1등. 흠잡을 데 없음'),
    ('에코',       '85',    '—',     '시간관리 연습 필요'),
]

for row_i, row in enumerate(grade_data):
    y = 2.25 + row_i * 0.42
    for col_i, cell in enumerate(row):
        if col_i == 0: x, w = 0.8, 2.0
        elif col_i == 1: x, w = 2.8, 1.0
        elif col_i == 2: x, w = 3.8, 1.0
        else: x, w = 4.8, 4.0

        if row_i == 0:
            color, bold, size = ACCENT_BLUE, True, 12
        else:
            # 점수 색상
            if col_i in (1, 2) and cell != '—':
                score = int(cell)
                if score >= 90: color = ACCENT_GREEN
                elif score >= 80: color = ACCENT_BLUE
                elif score >= 70: color = ACCENT_GOLD
                else: color = ACCENT_RED
            else:
                color = LIGHT_GRAY
            bold, size = False, 12

        add_text_box(slide, x, y, w, 0.4, cell, size, color, bold)

# 오른쪽: 핵심 기능
add_card(slide, 9.3, 1.6, 3.5, 4.5, BG_CARD, ACCENT_BLUE)
add_multi_text(slide, 9.5, 1.7, 3.1, 4.3, [
    ('평가 기능', 20, ACCENT_BLUE, True),
    ('', 8, GRAY, False),
    ('월말평가 생성', 14, WHITE, True),
    ('과목별 시험 생성 →\n활성 월 설정 → 성적 입력', 11, GRAY, False),
    ('', 6, GRAY, False),
    ('성적 입력', 14, WHITE, True),
    ('학생별 점수 + 코멘트\n한 화면에서 일괄 입력', 11, GRAY, False),
    ('', 6, GRAY, False),
    ('성장 차트', 14, WHITE, True),
    ('월별 추이 그래프\n학부모 리포트에 자동 반영', 11, GRAY, False),
    ('', 6, GRAY, False),
    ('활성 월 제어', 14, WHITE, True),
    ('설정에서 입력 가능한 월\n관리 → 실수 방지', 11, GRAY, False),
])

# 하단: 관리 포인트
add_card(slide, 0.5, 6.3, 12.3, 0.9, RGBColor(0x2D, 0x1E, 0x15), ACCENT_GOLD)
add_multi_text(slide, 0.8, 6.35, 11.8, 0.8, [
    ('관리 포인트', 14, ACCENT_GOLD, True),
    ('야스오(58점) → 방정식 보충 프린트 진행 중  |  이즈리얼(72점) → 연산 집중 훈련 시작  |  에코(85점) → 시간관리 연습 프린트 배정', 12, LIGHT_GRAY, False),
])

# ============================================
# SLIDE 5: 유즈케이스 3 — 결석/보강
# ============================================
slide = prs.slides.add_slide(prs.slide_layouts[6])
set_slide_bg(slide, BG_DARK)

add_text_box(slide, 0.5, 0.3, 12, 0.8, 'USE CASE 3: 결석 & 보강 관리', 36, ACCENT_BLUE, True)
add_text_box(slide, 0.5, 0.95, 12, 0.4, '"보강" 탭 — 결석 사유 기록, 보강 일정 관리', 16, GRAY, False)

# 결석 사례 3개
cases = [
    ('야스오 — 4/9(수) 결석', '바람따라 어디론가...', '요네(형) 전화 연락', '4/14(월) 보강 예정', '요네 형이 꼭 데려온다고 약속', 'scheduled', ACCENT_RED),
    ('카타리나 — 4/8(화) 결석', '녹서스 가문 행사', '타론 카톡', '미정', '가문 행사 끝나면 연락 준다고 함', 'pending', ACCENT_GOLD),
    ('징크스 — 4/10(목) 결석', '실험 사고(경미)', '바이(언니) 전화', '4/12(토) 14시 보강', '바이 언니가 데려다주기로 함', 'scheduled', ACCENT_BLUE),
]

for i, (title, reason, notified, makeup, note, status, color) in enumerate(cases):
    y = 1.6 + i * 1.7
    add_card(slide, 0.5, y, 7.5, 1.5, BG_CARD, color)
    add_multi_text(slide, 0.8, y + 0.1, 7, 1.3, [
        (title, 17, color, True),
        (f'사유: {reason}  |  통보: {notified}', 12, LIGHT_GRAY, False),
        (f'보강: {makeup}', 13, ACCENT_GREEN if status == 'scheduled' else ACCENT_GOLD, True),
        (f'메모: {note}', 11, GRAY, False),
    ])

# 오른쪽: 흐름도
add_card(slide, 8.3, 1.6, 4.5, 5.1, RGBColor(0x1E, 0x2D, 0x3D), ACCENT_BLUE)
add_multi_text(slide, 8.5, 1.7, 4.1, 5.0, [
    ('결석 → 보강 흐름', 20, ACCENT_BLUE, True),
    ('', 8, GRAY, False),
    ('① 결석 등록', 15, WHITE, True),
    ('날짜 + 사유 + 통보자 기록', 12, GRAY, False),
    ('', 6, GRAY, False),
    ('② 보강 생성', 15, WHITE, True),
    ('자동으로 "대기중" 보강 생성', 12, GRAY, False),
    ('', 6, GRAY, False),
    ('③ 보강 일정 확정', 15, WHITE, True),
    ('보호자와 조율 후 날짜 확정', 12, GRAY, False),
    ('', 6, GRAY, False),
    ('④ 보강 완료', 15, WHITE, True),
    ('실제 수업 후 완료 처리', 12, GRAY, False),
    ('', 6, GRAY, False),
    ('한눈에 파악', 15, ACCENT_GOLD, True),
    ('대기중 / 예정 / 완료 상태별\n필터링으로 빠짐없이 관리', 12, GRAY, False),
])

# ============================================
# SLIDE 6: 유즈케이스 4 — 학부모 리포트
# ============================================
slide = prs.slides.add_slide(prs.slide_layouts[6])
set_slide_bg(slide, BG_DARK)

add_text_box(slide, 0.5, 0.3, 12, 0.8, 'USE CASE 4: 학부모 리포트', 36, ACCENT_BLUE, True)
add_text_box(slide, 0.5, 0.95, 12, 0.4, '"학생" → 학생 프로필 — 월별 종합 리포트 생성 및 발송', 16, GRAY, False)

# 리포트 예시 2개
reports = [
    ('야스오 — 3월 리포트 (보호자: 요네)',
     '수학 58점. 야스오는 분명히 재능이 있는 학생이지만 출결이 불안정합니다.\n3월 한 달간 지각 4회, 결석 2회로 진도가 많이 밀렸습니다.\n요네 보호자님과의 상담이 시급합니다.\n방정식 기초부터 다시 잡아가고 있으며, 보충 프린트를 진행 중입니다.',
     ACCENT_RED),
    ('럭스 — 3월 리포트 (보호자: 가렌)',
     '수학 94점, 영어 97점. 럭스는 이름처럼 빛나는 학생입니다.\n두 과목 모두 최상위권이며 특히 영어 문법 이해도가 뛰어납니다.\n가렌 보호자님께서 학습 환경을 잘 잡아주신 덕분입니다.\n4월에는 수학 심화 과정에 도전시킬 예정입니다.',
     ACCENT_GOLD),
]

for i, (title, content, color) in enumerate(reports):
    y = 1.5 + i * 2.7
    add_card(slide, 0.5, y, 8, 2.5, BG_CARD, color)
    add_multi_text(slide, 0.8, y + 0.15, 7.5, 2.2, [
        (title, 16, color, True),
        ('', 4, GRAY, False),
        (content, 13, LIGHT_GRAY, False),
    ])

# 오른쪽: 리포트 구성
add_card(slide, 8.8, 1.5, 4, 5.5, RGBColor(0x1E, 0x2D, 0x3D), ACCENT_BLUE)
add_multi_text(slide, 9.0, 1.6, 3.6, 5.3, [
    ('리포트 구성', 20, ACCENT_BLUE, True),
    ('', 8, GRAY, False),
    ('출석 현황', 14, WHITE, True),
    ('출석률, 지각/결석 횟수\n총 수업시간 집계', 11, GRAY, False),
    ('', 6, GRAY, False),
    ('성적 추이', 14, WHITE, True),
    ('월별 점수 변화 차트\n과목별 강점/약점 분석', 11, GRAY, False),
    ('', 6, GRAY, False),
    ('선생님 코멘트', 14, WHITE, True),
    ('과목별 담당 선생님의\n맞춤 학습 소견', 11, GRAY, False),
    ('', 6, GRAY, False),
    ('다음달 계획', 14, WHITE, True),
    ('보충 프린트 현황\n학습 방향 안내', 11, GRAY, False),
    ('', 8, GRAY, False),
    ('학부모 발송', 14, ACCENT_GREEN, True),
    ('카카오톡/문자 연동으로\n원클릭 발송 (준비중)', 11, GRAY, False),
])

# ============================================
# SLIDE 7: 유즈케이스 5 — 공지 & 할일 (보드)
# ============================================
slide = prs.slides.add_slide(prs.slide_layouts[6])
set_slide_bg(slide, BG_DARK)

add_text_box(slide, 0.5, 0.3, 12, 0.8, 'USE CASE 5: 공지 & 할일 보드', 36, ACCENT_BLUE, True)
add_text_box(slide, 0.5, 0.95, 12, 0.4, '"보드" 탭 — 원장 ↔ 선생님 간 업무 공유 & 할일 관리', 16, GRAY, False)

# 공지 카드
notices = [
    ('📌 4월 월말평가 안내', '협곡원장', '4/25까지',
     '수학/영어 월말평가 실시\n특히 야스오는 시험 당일 반드시 출석하도록\n요네 형에게도 연락 부탁', True),
    ('학부모 상담 주간 (4/21~25)', '협곡원장', '4/21까지',
     '야스오 → 요네 형 상담 필수\n징크스 → 바이 언니 상담\n이즈리얼 → 아버지 상담', False),
    ('중2 수학 교재 변경', '하이머딩거', '—',
     '개념원리 RPM → 쎈 수학\n사유: 야스오 학생에게 더 많은 연습 문제 필요', False),
]

for i, (title, author, due, content, pinned) in enumerate(notices):
    x = 0.5 + i * 4.15
    border = ACCENT_GOLD if pinned else RGBColor(0x44, 0x44, 0x66)
    add_card(slide, x, 1.5, 3.95, 2.7, BG_CARD, border)
    add_multi_text(slide, x + 0.15, 1.6, 3.65, 2.5, [
        (title, 14, ACCENT_GOLD if pinned else WHITE, True),
        (f'{author}  |  마감: {due}', 10, GRAY, False),
        ('', 4, GRAY, False),
        (content, 11, LIGHT_GRAY, False),
    ])

# 할일 목록
add_card(slide, 0.5, 4.5, 12.3, 2.7, RGBColor(0x1E, 0x2D, 0x3D))
add_text_box(slide, 0.8, 4.6, 11.5, 0.4, '할일 (Action Items)', 18, ACCENT_BLUE, True)

todos = [
    ('수학 월말평가 출제', '하이머딩거', '4/20', 'pending', '⏳'),
    ('영어 월말평가 출제', '소라카', '4/20', 'pending', '⏳'),
    ('학부모 상담 일정 (수학반)', '하이머딩거', '4/18', 'pending', '⏳'),
    ('학부모 상담 일정 (영어반)', '소라카', '4/18', 'pending', '⏳'),
    ('야스오 방정식 보충 프린트', '하이머딩거', '4/14', 'completed', '✅'),
]

for i, (title, assignee, due, status, icon) in enumerate(todos):
    y = 5.1 + i * 0.38
    color = ACCENT_GREEN if status == 'completed' else LIGHT_GRAY
    strike = status == 'completed'
    add_text_box(slide, 0.8, y, 0.4, 0.35, icon, 13, color, False)
    add_text_box(slide, 1.3, y, 4.5, 0.35, title, 13, color, False)
    add_text_box(slide, 5.8, y, 2.5, 0.35, f'담당: {assignee}', 12, GRAY, False)
    add_text_box(slide, 8.5, y, 1.5, 0.35, f'마감: {due}', 12, GRAY, False)
    status_text = '완료' if status == 'completed' else '진행중'
    status_color = ACCENT_GREEN if status == 'completed' else ACCENT_GOLD
    add_text_box(slide, 10.2, y, 1.5, 0.35, status_text, 12, status_color, True)

# ============================================
# SLIDE 8: 유즈케이스 6 — 교재/프린트 관리
# ============================================
slide = prs.slides.add_slide(prs.slide_layouts[6])
set_slide_bg(slide, BG_DARK)

add_text_box(slide, 0.5, 0.3, 12, 0.8, 'USE CASE 6: 교재 & 프린트 관리', 36, ACCENT_BLUE, True)
add_text_box(slide, 0.5, 0.95, 12, 0.4, '"교재" 탭 — 학생별 맞춤 프린트 배정 & 진행상황 추적', 16, GRAY, False)

# 학생별 프린트 현황
print_groups = [
    ('야스오 — 방정식 보충 시리즈', ACCENT_RED, [
        ('방정식 기초 (1) - 바람을 잡아라', '일차방정식 기본', '완료 ✅'),
        ('방정식 기초 (2) - 폭풍의 길', '연립방정식', '완료 ✅'),
        ('방정식 심화 (3) - 최후의 숨결', '이차방정식 입문', '대기 ⏳'),
    ]),
    ('에코 — 시간관리 훈련', ACCENT_BLUE, [
        ('시간관리 연습 프린트', '제한시간 내 문제풀이. 시간은 되돌릴 수 없다', '대기 ⏳'),
    ]),
    ('이즈리얼 — 기초 강화', ACCENT_GOLD, [
        ('연산 집중 훈련', '계산 실수 방지용. 탐험 전에 기초부터!', '대기 ⏳'),
    ]),
    ('징크스 — 서술형 특훈', ACCENT_PURPLE, [
        ('서술형 풀이 가이드', '흥분하지 말고 차분하게 쓰기 연습', '대기 ⏳'),
    ]),
]

y_pos = 1.6
for group_name, color, items in print_groups:
    h = 0.5 + len(items) * 0.38
    add_card(slide, 0.5, y_pos, 8, h, BG_CARD, color)
    add_text_box(slide, 0.8, y_pos + 0.05, 7.5, 0.4, group_name, 15, color, True)
    for j, (title, memo, status) in enumerate(items):
        iy = y_pos + 0.45 + j * 0.38
        s_color = ACCENT_GREEN if '완료' in status else ACCENT_GOLD
        add_text_box(slide, 1.0, iy, 3.5, 0.35, title, 12, WHITE, False)
        add_text_box(slide, 4.5, iy, 2.5, 0.35, memo, 10, GRAY, False)
        add_text_box(slide, 7.2, iy, 1.2, 0.35, status, 11, s_color, True)
    y_pos += h + 0.2

# 오른쪽: 영어반
add_card(slide, 8.8, 1.6, 4, 2.5, BG_CARD, ACCENT_GREEN)
add_multi_text(slide, 9.0, 1.7, 3.6, 2.3, [
    ('소라카 선생님 교재', 16, ACCENT_GREEN, True),
    ('', 6, GRAY, False),
    ('카타리나', 13, WHITE, True),
    ('영어 독해 심화 — 완료 ✅', 11, ACCENT_GREEN, False),
    ('', 4, GRAY, False),
    ('이렐리아', 13, WHITE, True),
    ('영어 어휘 100제 — 대기 ⏳', 11, ACCENT_GOLD, False),
])

# 하단 요약
add_card(slide, 0.5, 6.2, 12.3, 0.9, RGBColor(0x15, 0x25, 0x15), ACCENT_GREEN)
add_multi_text(slide, 0.8, 6.25, 11.8, 0.8, [
    ('프린트 관리 요약: 총 8건  |  완료 3건  |  대기 5건', 14, ACCENT_GREEN, True),
    ('선생님이 학생별로 프린트를 배정하면 → 진행상황 실시간 추적 → 완료 체크 → 다음 프린트 배정', 12, LIGHT_GRAY, False),
])

# ============================================
# SLIDE 9: 학생 프로필 — 이즈리얼 예시
# ============================================
slide = prs.slides.add_slide(prs.slide_layouts[6])
set_slide_bg(slide, BG_DARK)

add_text_box(slide, 0.5, 0.3, 12, 0.8, 'USE CASE 7: 학생 성장 대시보드', 36, ACCENT_BLUE, True)
add_text_box(slide, 0.5, 0.95, 12, 0.4, '"학생" → 프로필 — 학생 한 명의 전체 학습 현황을 한눈에', 16, GRAY, False)

# 프로필 헤더
add_card(slide, 0.5, 1.5, 12.3, 1.3, RGBColor(0x1E, 0x3A, 0x5F), ACCENT_BLUE)
add_multi_text(slide, 0.8, 1.55, 11.8, 1.2, [
    ('이즈리얼  |  중1  |  수학', 24, ACCENT_BLUE, True),
    ('보호자: 이즈리얼 아버지 (010-2222-0001)  |  등원일: 2026-03-02  |  담당: 하이머딩거 선생님', 13, LIGHT_GRAY, False),
    ('필토버 탐험가 집안. 호기심은 넘치지만 기본기를 다져야 할 시기.', 12, GRAY, False),
])

# 4개 카드
cards_data = [
    ('출석 현황', ACCENT_GREEN, [
        ('4월 출석률', 18, ACCENT_GREEN, True),
        ('100%  (2/2 수업)', 14, WHITE, False),
        ('', 4, GRAY, False),
        ('지각: 0회', 12, LIGHT_GRAY, False),
        ('결석: 0회', 12, LIGHT_GRAY, False),
        ('총 수업시간: 180분', 12, LIGHT_GRAY, False),
    ]),
    ('성적 추이', ACCENT_BLUE, [
        ('수학 성적', 18, ACCENT_BLUE, True),
        ('3월: 72점', 14, ACCENT_GOLD, False),
        ('', 4, GRAY, False),
        ('목표: 80점 이상', 12, LIGHT_GRAY, False),
        ('약점: 연산 실수', 12, ACCENT_RED, False),
        ('강점: 응용문제 도전', 12, ACCENT_GREEN, False),
    ]),
    ('프린트 현황', ACCENT_PURPLE, [
        ('교재/프린트', 18, ACCENT_PURPLE, True),
        ('대기 1건', 14, ACCENT_GOLD, False),
        ('', 4, GRAY, False),
        ('연산 집중 훈련', 12, LIGHT_GRAY, False),
        ('"탐험 전에 기초부터!"', 12, GRAY, False),
        ('', 4, GRAY, False),
    ]),
    ('학부모 리포트', ACCENT_GOLD, [
        ('최근 리포트', 18, ACCENT_GOLD, True),
        ('3월 발송 완료', 14, ACCENT_GREEN, False),
        ('', 4, GRAY, False),
        ('기본 연산 실수 잦음', 12, LIGHT_GRAY, False),
        ('4월 연산 훈련 병행', 12, LIGHT_GRAY, False),
        ('다음 리포트: 4월말', 12, GRAY, False),
    ]),
]

for i, (title, color, lines) in enumerate(cards_data):
    x = 0.5 + i * 3.1
    add_card(slide, x, 3.1, 2.9, 2.8, BG_CARD, color)
    add_multi_text(slide, x + 0.15, 3.2, 2.6, 2.6, lines)

# 하단: 선생님 메모
add_card(slide, 0.5, 6.2, 12.3, 1.0, RGBColor(0x2D, 0x1E, 0x15), ACCENT_GOLD)
add_multi_text(slide, 0.8, 6.25, 11.8, 0.9, [
    ('하이머딩거 선생님 메모', 14, ACCENT_GOLD, True),
    ('"이즈리얼은 탐험하듯 문제를 풀지만 계산 실수가 잦습니다. 4월 연산 집중 훈련 프린트를 시작했으며, 학부모 상담에서 가정 학습 루틴을 논의할 예정입니다."', 12, LIGHT_GRAY, False),
])

# ============================================
# SLIDE 10: 마무리 — 시작하기
# ============================================
slide = prs.slides.add_slide(prs.slide_layouts[6])
set_slide_bg(slide, BG_DARK)

add_text_box(slide, 1, 1.0, 11.3, 1, 'WAWA Smart ERP', 48, ACCENT_GOLD, True, PP_ALIGN.CENTER)
add_text_box(slide, 1, 2.0, 11.3, 0.6, '지금 바로 시작하세요', 28, WHITE, False, PP_ALIGN.CENTER)

# 3 스텝 카드
steps = [
    ('1', '학원 등록', '새 학원 등록에서\n학원코드 생성\n(30초 완료)', ACCENT_BLUE),
    ('2', '선생님 초대', '설정 → 초대 코드 생성\n→ 선생님에게 전달\n→ 코드로 가입', ACCENT_GREEN),
    ('3', '학생 등록 & 수업 시작', '학생 등록 → 시간표 설정\n→ 수업 타이머 시작\n→ 자동 출석 기록', ACCENT_GOLD),
]

for i, (num, title, desc, color) in enumerate(steps):
    x = 1.5 + i * 3.8
    add_card(slide, x, 3.0, 3.3, 2.5, BG_CARD, color)
    add_multi_text(slide, x + 0.2, 3.1, 2.9, 2.3, [
        (f'STEP {num}', 14, color, True),
        (title, 20, WHITE, True),
        ('', 4, GRAY, False),
        (desc, 13, LIGHT_GRAY, False),
    ])

# 데모 접속 정보
add_card(slide, 3, 5.8, 7.3, 1.3, RGBColor(0x20, 0x20, 0x38), ACCENT_BLUE)
add_multi_text(slide, 3.3, 5.85, 6.8, 1.2, [
    ('데모 체험', 18, ACCENT_BLUE, True),
    ('접속: wawa-smart-erp.pages.dev  →  학원: (test)협곡점  →  이름: 협곡원장  →  PIN: 1234', 14, LIGHT_GRAY, False),
    ('LoL 세계관의 8명의 학생 데이터로 전체 기능을 체험해보세요!', 13, GRAY, False),
])

# 저장
output_path = '/mnt/g/progress/wawa/wawa_smart_erp/docs/WAWA_ERP_유즈케이스_협곡점.pptx'
prs.save(output_path)
print(f'PPT saved: {output_path}')
print(f'Slides: {len(prs.slides)}')
