"""WAWA ERP IR Deck Generator — 투자자용 피치덱 (15 slides)"""
from pptx import Presentation
from pptx.util import Inches, Pt, Emu
from pptx.dml.color import RGBColor
from pptx.enum.shapes import MSO_SHAPE
from pptx.enum.text import PP_ALIGN

# 색상 팔레트 (tech-startup 톤: 네이비 + 코랄 + 라이트 그레이)
NAVY = RGBColor(0x0A, 0x1F, 0x44)
CORAL = RGBColor(0xFF, 0x6B, 0x6B)
LIGHT = RGBColor(0xF5, 0xF7, 0xFA)
GRAY = RGBColor(0x6B, 0x72, 0x80)
WHITE = RGBColor(0xFF, 0xFF, 0xFF)
ACCENT = RGBColor(0x4A, 0x90, 0xE2)

prs = Presentation()
prs.slide_width = Inches(13.333)
prs.slide_height = Inches(7.5)

SW, SH = prs.slide_width, prs.slide_height
BLANK = prs.slide_layouts[6]


def set_fill(shape, color):
    shape.fill.solid()
    shape.fill.fore_color.rgb = color
    shape.line.fill.background()


def add_text(slide, x, y, w, h, text, *, size=18, bold=False, color=NAVY, align=PP_ALIGN.LEFT, font='Pretendard'):
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


def add_bullets(slide, x, y, w, h, items, *, size=16, color=NAVY, font='Pretendard'):
    tb = slide.shapes.add_textbox(x, y, w, h)
    tf = tb.text_frame
    tf.word_wrap = True
    for i, item in enumerate(items):
        p = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
        p.alignment = PP_ALIGN.LEFT
        p.space_after = Pt(8)
        run = p.add_run()
        run.text = f"•  {item}"
        run.font.name = font
        run.font.size = Pt(size)
        run.font.color.rgb = color
    return tb


def add_rect(slide, x, y, w, h, color):
    r = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, x, y, w, h)
    set_fill(r, color)
    return r


def add_header_bar(slide, title, subtitle=None):
    add_rect(slide, 0, 0, SW, Inches(0.08), CORAL)
    add_text(slide, Inches(0.6), Inches(0.3), Inches(12), Inches(0.7), title, size=28, bold=True, color=NAVY)
    if subtitle:
        add_text(slide, Inches(0.6), Inches(0.95), Inches(12), Inches(0.4), subtitle, size=14, color=GRAY)
    add_rect(slide, Inches(0.6), Inches(1.4), Inches(0.6), Inches(0.04), CORAL)


def add_page_num(slide, n, total=15):
    add_text(slide, Inches(12.5), Inches(7.1), Inches(0.6), Inches(0.3), f"{n:02d} / {total:02d}", size=10, color=GRAY, align=PP_ALIGN.RIGHT)


# ==============================================================
# Slide 1 — Cover
# ==============================================================
s = prs.slides.add_slide(BLANK)
add_rect(s, 0, 0, SW, SH, NAVY)
add_rect(s, 0, Inches(3.0), SW, Inches(0.06), CORAL)

add_text(s, Inches(0.8), Inches(2.0), Inches(12), Inches(0.7), "WAWA ERP", size=64, bold=True, color=WHITE)
add_text(s, Inches(0.8), Inches(3.3), Inches(12), Inches(0.6), "선생 중심 학원 운영 OS", size=28, color=WHITE)
add_text(s, Inches(0.8), Inches(4.1), Inches(12), Inches(0.5), "AI 리포트 · 가챠 학습 · 멀티테넌트 SaaS  |  월 2만원", size=16, color=CORAL)

add_text(s, Inches(0.8), Inches(6.5), Inches(8), Inches(0.4), "Investor Pitch  ·  2026.04", size=12, color=WHITE)
add_text(s, Inches(10), Inches(6.5), Inches(2.8), Inches(0.4), "CONFIDENTIAL", size=12, color=CORAL, align=PP_ALIGN.RIGHT)

# ==============================================================
# Slide 2 — Problem
# ==============================================================
s = prs.slides.add_slide(BLANK)
add_header_bar(s, "Problem", "학원 운영, 여전히 엑셀과 카톡으로 돌아간다")

problems = [
    ("선생 교체 = 학생 맥락 증발",
     "인수인계는 카톡·수첩. '엄마 예민함, 수학 약함' 같은 핵심 맥락 유실"),
    ("숙제 워크플로우 부재",
     "배포→제출→채점이 종이·사진·카톡에 흩어짐. 진도 추적 불가"),
    ("학부모 소통 파편화",
     "리포트는 PDF, 결석은 카톡, 성적은 엑셀. 학부모 앱 없음"),
    ("리포트 작성 = 선생 주 5시간",
     "손으로 써서 PDF 변환. 월말평가 시즌엔 수업보다 리포트가 더 오래"),
]
y = Inches(1.8)
for title, desc in problems:
    add_rect(s, Inches(0.6), y, Inches(0.12), Inches(1.1), CORAL)
    add_text(s, Inches(0.95), y + Inches(0.05), Inches(12), Inches(0.5), title, size=20, bold=True, color=NAVY)
    add_text(s, Inches(0.95), y + Inches(0.6), Inches(12), Inches(0.5), desc, size=14, color=GRAY)
    y += Inches(1.3)

add_page_num(s, 2)

# ==============================================================
# Slide 3 — Solution
# ==============================================================
s = prs.slides.add_slide(BLANK)
add_header_bar(s, "Solution", "선생이 한 화면에서 다 끝낸다")

cards = [
    ("AI 리포트", "Gemini 기반\n월말평가 자동 생성\n선생 5시간 → 15분", CORAL),
    ("가챠 학습", "학생 몰입도 3x\n개념 카드 + 보상 루프\n게이미피케이션", ACCENT),
    ("선생 중심", "본인 담당 학생만\n권한 격리\n담당 스코프 자동"),
    ("멀티테넌트", "학원별 데이터 격리\nCloudflare 엣지\n원가 구조 혁신", NAVY),
]
card_w, card_h, gap = Inches(2.9), Inches(3.8), Inches(0.25)
start_x = Inches(0.6)
for i, (title, desc, *rest) in enumerate(cards):
    color = rest[0] if rest else NAVY
    x = start_x + (card_w + gap) * i
    add_rect(s, x, Inches(1.9), card_w, Inches(0.15), color)
    bg = add_rect(s, x, Inches(2.05), card_w, card_h, LIGHT)
    add_text(s, x + Inches(0.3), Inches(2.3), card_w - Inches(0.6), Inches(0.6), title, size=22, bold=True, color=NAVY)
    add_text(s, x + Inches(0.3), Inches(3.0), card_w - Inches(0.6), Inches(2.5), desc, size=13, color=GRAY)

add_text(s, Inches(0.6), Inches(6.4), Inches(12), Inches(0.5),
         "→ 학원 운영의 모든 마찰을 한 제품에서 해결", size=16, bold=True, color=CORAL)
add_page_num(s, 3)

# ==============================================================
# Slide 4 — Product Demo
# ==============================================================
s = prs.slides.add_slide(BLANK)
add_header_bar(s, "Product", "실제 구현되어 운영 중인 기능")

features = [
    ("📋 보드 & 할일", "공지·액션아이템 중앙 관리", Inches(0.6), Inches(1.9)),
    ("🎴 가챠 학습", "개념 카드 · 학생별 컬렉션", Inches(4.75), Inches(1.9)),
    ("📊 AI 월말 리포트", "Gemini 자동 생성 · 이미지 렌더", Inches(8.9), Inches(1.9)),
    ("⏱️ 실시간 타이머", "출결 · 수업 시간 자동 기록", Inches(0.6), Inches(4.3)),
    ("📝 시험 관리", "정기고사 · 월말평가 · 성적", Inches(4.75), Inches(4.3)),
    ("🏫 학원 관리", "초대 코드 · PIN 로그인", Inches(8.9), Inches(4.3)),
]
for title, desc, x, y in features:
    add_rect(s, x, y, Inches(3.9), Inches(2.15), LIGHT)
    add_rect(s, x, y, Inches(3.9), Inches(0.08), CORAL)
    add_text(s, x + Inches(0.3), y + Inches(0.3), Inches(3.6), Inches(0.6), title, size=20, bold=True, color=NAVY)
    add_text(s, x + Inches(0.3), y + Inches(1.0), Inches(3.6), Inches(1.0), desc, size=13, color=GRAY)

add_page_num(s, 4)

# ==============================================================
# Slide 5 — Market Size
# ==============================================================
s = prs.slides.add_slide(BLANK)
add_header_bar(s, "Market", "국내 학원 시장, 디지털 전환은 이제 시작")

# TAM/SAM/SOM 동심원 대신 3단 막대
levels = [
    ("TAM", "전국 학원 7.5만 개", "연 2,500억원 (월 2만원 × 10.4개월)", Inches(11), NAVY),
    ("SAM", "중소 학원 4.5만 개", "연 1,500억원 (학생 200명 이하)", Inches(7.5), ACCENT),
    ("SOM", "초기 타겟 5,000 개", "연 120억원 (3년 차 진입 목표)", Inches(4), CORAL),
]
y = Inches(2.0)
for label, title, note, w, color in levels:
    add_rect(s, Inches(0.8), y, w, Inches(1.0), color)
    add_text(s, Inches(1.1), y + Inches(0.1), Inches(1.2), Inches(0.4), label, size=22, bold=True, color=WHITE)
    add_text(s, Inches(1.1), y + Inches(0.55), Inches(w.emu / 914400 - 0.4), Inches(0.4), title, size=14, bold=True, color=WHITE)
    add_text(s, w + Inches(1.0), y + Inches(0.3), Inches(4.5), Inches(0.5), note, size=12, color=GRAY)
    y += Inches(1.4)

add_rect(s, Inches(0.6), Inches(6.3), Inches(12), Inches(0.8), LIGHT)
add_text(s, Inches(0.9), Inches(6.45), Inches(12), Inches(0.5),
         "Why Now  ·  AI 비용 90% 하락 · 학부모 디지털 기대치 급상승 · Cloudflare 엣지로 원가 0 수준",
         size=13, color=NAVY)
add_page_num(s, 5)

# ==============================================================
# Slide 6 — Business Model
# ==============================================================
s = prs.slides.add_slide(BLANK)
add_header_bar(s, "Business Model", "학원당 월 2만원, 학생 수 무관한 단일 요금")

# 좌: 단위경제
add_text(s, Inches(0.6), Inches(1.9), Inches(6), Inches(0.5), "단위 경제 (학원 1곳)", size=18, bold=True, color=NAVY)
unit = [
    ("ARPU", "₩20,000 / 월"),
    ("Cloudflare 원가", "~₩200 / 월 (D1+KV+R2+Workers)"),
    ("Gemini API", "~₩800 / 월 (학생 60명 리포트)"),
    ("Gross Margin", "95%+"),
    ("CAC 가정", "₩30,000 (소개 · 바이럴 중심)"),
    ("Payback", "1.5개월"),
    ("LTV (24M)", "₩480,000"),
]
y = Inches(2.5)
for k, v in unit:
    add_text(s, Inches(0.8), y, Inches(2.5), Inches(0.35), k, size=13, color=GRAY)
    add_text(s, Inches(3.3), y, Inches(3.5), Inches(0.35), v, size=13, bold=True, color=NAVY)
    y += Inches(0.42)

# 우: 수익 구조
add_text(s, Inches(7.2), Inches(1.9), Inches(6), Inches(0.5), "확장 레버", size=18, bold=True, color=NAVY)
levers = [
    "① 학원당 월 2만원 (기본)",
    "② 학부모 알림톡 번들 (+₩5,000/월)",
    "③ AI 리포트 고급 플랜 (+₩10,000/월)",
    "④ 전사 결제 시스템 연동 (수수료)",
    "⑤ 교재·콘텐츠 마켓플레이스 (GMV%)",
]
add_bullets(s, Inches(7.2), Inches(2.5), Inches(5.8), Inches(4.5), levers, size=14)

add_page_num(s, 6)

# ==============================================================
# Slide 7 — Moat
# ==============================================================
s = prs.slides.add_slide(BLANK)
add_header_bar(s, "Moat", "경쟁자가 따라오기 어려운 3가지")

moats = [
    ("원가 구조",
     "Cloudflare Workers + D1 + KV + R2.\n학원당 월 인프라 비용 ~₩200.\n월 2만원에도 95%+ 마진.",
     "💰"),
    ("AI 리포트 파이프라인",
     "학생 성적→타이머→가챠 데이터를 Gemini에 통합 투입.\n선생 5시간 → 15분.\n단순 챗봇이 아닌 도메인 파이프라인.",
     "🤖"),
    ("가챠 × 학습",
     "개념 카드 + 학생별 컬렉션.\n학원 브랜드별 카드 디자인 잠금.\n학생이 가져가는 '내 카드' 심리 구축.",
     "🎴"),
]
card_w, gap = Inches(4.0), Inches(0.2)
for i, (title, desc, icon) in enumerate(moats):
    x = Inches(0.6) + (card_w + gap) * i
    add_rect(s, x, Inches(1.9), card_w, Inches(4.8), LIGHT)
    add_rect(s, x, Inches(1.9), card_w, Inches(0.12), CORAL)
    add_text(s, x + Inches(0.3), Inches(2.2), card_w - Inches(0.6), Inches(0.8), icon, size=40)
    add_text(s, x + Inches(0.3), Inches(3.2), card_w - Inches(0.6), Inches(0.5), title, size=20, bold=True, color=NAVY)
    add_text(s, x + Inches(0.3), Inches(3.9), card_w - Inches(0.6), Inches(2.5), desc, size=13, color=GRAY)

add_page_num(s, 7)

# ==============================================================
# Slide 8 — Traction (placeholder 수치)
# ==============================================================
s = prs.slides.add_slide(BLANK)
add_header_bar(s, "Traction", "초기 지표 · 숫자는 IR 미팅 시점으로 업데이트")

metrics = [
    ("활성 학원", "TBD", "파일럿 3곳 진행 중"),
    ("등록 학생", "TBD", "학원당 평균 60명"),
    ("MRR", "TBD", "월 2만원 × 학원 수"),
    ("NRR (예상)", "110%+", "번들·고급 플랜 upsell"),
]
card_w, gap = Inches(3.0), Inches(0.15)
for i, (label, val, sub) in enumerate(metrics):
    x = Inches(0.6) + (card_w + gap) * i
    add_rect(s, x, Inches(1.9), card_w, Inches(2.2), NAVY)
    add_text(s, x + Inches(0.3), Inches(2.1), card_w - Inches(0.6), Inches(0.4), label, size=13, color=CORAL, bold=True)
    add_text(s, x + Inches(0.3), Inches(2.6), card_w - Inches(0.6), Inches(0.9), val, size=36, bold=True, color=WHITE)
    add_text(s, x + Inches(0.3), Inches(3.6), card_w - Inches(0.6), Inches(0.5), sub, size=11, color=WHITE)

# 정성 quote
add_rect(s, Inches(0.6), Inches(4.6), Inches(12.1), Inches(2.3), LIGHT)
add_text(s, Inches(0.9), Inches(4.8), Inches(1), Inches(1), '"', size=80, bold=True, color=CORAL)
add_text(s, Inches(2), Inches(5.0), Inches(10), Inches(1.2),
         "월말 리포트가 선생 5시간에서 15분으로 줄었어요.\n학부모가 받자마자 '이런 건 처음 본다'는 반응입니다.",
         size=16, color=NAVY)
add_text(s, Inches(2), Inches(6.35), Inches(10), Inches(0.4),
         "— 협곡점 원장 (파일럿 학원)", size=12, color=GRAY)
add_page_num(s, 8)

# ==============================================================
# Slide 9 — Roadmap
# ==============================================================
s = prs.slides.add_slide(BLANK)
add_header_bar(s, "Roadmap", "남은 4개 페인포인트, 12개월 안에")

phases = [
    ("Q2 2026", "숙제 관리", "배포→제출→채점 워크플로우. 가챠는 학습용, 숙제는 별도 트랙."),
    ("Q3 2026", "상담 메모", "학생별 히스토리. 선생 교체 시 인수인계 자동화."),
    ("Q4 2026", "학부모 앱", "전용 대시보드 + 알림톡 번들. 번들 플랜 출시."),
    ("Q1 2027", "운영 안정성", "SLA 99.9%, 멀티 리전, 모니터링 · KV/R2 한도 자동 관리."),
]
y = Inches(2.0)
for label, title, desc in phases:
    add_rect(s, Inches(0.6), y, Inches(1.7), Inches(1.0), CORAL)
    add_text(s, Inches(0.75), y + Inches(0.3), Inches(1.5), Inches(0.5), label, size=16, bold=True, color=WHITE)
    add_rect(s, Inches(2.4), y, Inches(10.3), Inches(1.0), LIGHT)
    add_text(s, Inches(2.6), y + Inches(0.15), Inches(10), Inches(0.4), title, size=16, bold=True, color=NAVY)
    add_text(s, Inches(2.6), y + Inches(0.55), Inches(10), Inches(0.45), desc, size=12, color=GRAY)
    y += Inches(1.15)

add_page_num(s, 9)

# ==============================================================
# Slide 10 — Competition
# ==============================================================
s = prs.slides.add_slide(BLANK)
add_header_bar(s, "Competition", "대형 LMS가 놓친 중소 학원의 공백")

# 2x2 매트릭스: 가격(세로) × 선생 중심도(가로)
cx, cy, cw, ch = Inches(1.5), Inches(2.0), Inches(10), Inches(4.8)
add_rect(s, cx, cy, cw, ch, LIGHT)
# 축
add_rect(s, cx + cw/2, cy, Emu(10000), ch, GRAY)
add_rect(s, cx, cy + ch/2, cw, Emu(10000), GRAY)

add_text(s, cx, cy - Inches(0.4), cw, Inches(0.3), "← 저가                                                              고가 →", size=11, color=GRAY, align=PP_ALIGN.CENTER)
add_text(s, cx - Inches(1.4), cy + ch/2 - Inches(0.15), Inches(1.2), Inches(0.3), "선생 중심 ↑", size=11, color=GRAY, align=PP_ALIGN.RIGHT)
add_text(s, cx - Inches(1.4), cy + ch - Inches(0.15), Inches(1.2), Inches(0.3), "관리자 중심 ↓", size=11, color=GRAY, align=PP_ALIGN.RIGHT)

# 포지션
positions = [
    ("우리", Inches(2.5), Inches(2.5), CORAL, WHITE, 16),
    ("클래스팅", Inches(8.5), Inches(5.5), NAVY, WHITE, 12),
    ("아이엠스쿨", Inches(9.5), Inches(4.3), NAVY, WHITE, 12),
    ("마이비스쿨", Inches(7.5), Inches(5.8), NAVY, WHITE, 12),
    ("엑셀+카톡", Inches(2.2), Inches(5.8), GRAY, WHITE, 12),
]
for name, px, py, bg, fg, sz in positions:
    r = sz * 6
    d = Emu(r * 9525)
    add_rect(s, px, py, d, d, bg)
    add_text(s, px - Inches(0.5), py + d + Emu(50000), Inches(r * 0.03), Inches(0.3), name, size=11, bold=True, color=NAVY, align=PP_ALIGN.CENTER)

add_page_num(s, 10)

# ==============================================================
# Slide 11 — Team
# ==============================================================
s = prs.slides.add_slide(BLANK)
add_header_bar(s, "Team", "학원 도메인 × 엔지니어링")

members = [
    ("대표", "학원 운영 10년", "수학 학원 운영자 출신.\n현장 페인을 직접 겪은 도메인 오너."),
    ("CTO", "풀스택 엔지니어", "Cloudflare Workers · React · AI.\n단독으로 제품 전체 구축."),
    ("자문", "교육 업계 네트워크", "대형 프랜차이즈 학원 · 교재 출판사 연결."),
]
card_w, gap = Inches(4.0), Inches(0.15)
for i, (role, name, desc) in enumerate(members):
    x = Inches(0.6) + (card_w + gap) * i
    add_rect(s, x, Inches(1.9), card_w, Inches(4.8), LIGHT)
    # 프로필 원
    avatar = s.shapes.add_shape(MSO_SHAPE.OVAL, x + Inches(1.3), Inches(2.2), Inches(1.4), Inches(1.4))
    set_fill(avatar, NAVY)
    add_text(s, x, Inches(3.8), card_w, Inches(0.4), role, size=14, bold=True, color=CORAL, align=PP_ALIGN.CENTER)
    add_text(s, x, Inches(4.3), card_w, Inches(0.5), name, size=20, bold=True, color=NAVY, align=PP_ALIGN.CENTER)
    add_text(s, x + Inches(0.3), Inches(5.0), card_w - Inches(0.6), Inches(1.6), desc, size=12, color=GRAY, align=PP_ALIGN.CENTER)

add_page_num(s, 11)

# ==============================================================
# Slide 12 — Financials
# ==============================================================
s = prs.slides.add_slide(BLANK)
add_header_bar(s, "Financials", "24개월 ARR 예상 — 학원 수 기반")

# 표
headers = ["구분", "Y1 말", "Y2 말", "Y3 말"]
rows = [
    ["활성 학원 수", "200", "1,000", "3,000"],
    ["MRR", "₩4M", "₩20M", "₩60M"],
    ["ARR", "₩48M", "₩240M", "₩720M"],
    ["Gross Margin", "93%", "95%", "96%"],
    ["Burn / 월", "₩25M", "₩40M", "₩30M"],
    ["Runway 필요", "18M", "12M", "+"],
]
col_w = [Inches(3.2), Inches(3.0), Inches(3.0), Inches(3.0)]
x0, y0 = Inches(0.7), Inches(2.0)

# header
x = x0
for i, h in enumerate(headers):
    add_rect(s, x, y0, col_w[i], Inches(0.6), NAVY)
    add_text(s, x, y0 + Inches(0.12), col_w[i], Inches(0.5), h, size=14, bold=True, color=WHITE, align=PP_ALIGN.CENTER)
    x += col_w[i]
# rows
y = y0 + Inches(0.6)
for ri, row in enumerate(rows):
    x = x0
    bg = LIGHT if ri % 2 == 0 else WHITE
    for i, cell in enumerate(row):
        add_rect(s, x, y, col_w[i], Inches(0.55), bg)
        add_text(s, x, y + Inches(0.12), col_w[i], Inches(0.5), cell,
                 size=13, bold=(i == 0), color=NAVY, align=PP_ALIGN.CENTER)
        x += col_w[i]
    y += Inches(0.55)

add_text(s, Inches(0.7), Inches(6.7), Inches(12), Inches(0.4),
         "* 월 2만원 기본 요금 기준. 번들/고급 플랜 upsell 미반영 (보수적 추정).",
         size=11, color=GRAY)
add_page_num(s, 12)

# ==============================================================
# Slide 13 — Ask
# ==============================================================
s = prs.slides.add_slide(BLANK)
add_header_bar(s, "The Ask", "Seed 라운드 · 18개월 Runway")

# 조달액
add_rect(s, Inches(0.6), Inches(1.9), Inches(5.8), Inches(2.5), NAVY)
add_text(s, Inches(1.0), Inches(2.1), Inches(5), Inches(0.4), "조달 목표", size=14, color=CORAL, bold=True)
add_text(s, Inches(1.0), Inches(2.6), Inches(5), Inches(1.2), "₩500M", size=60, bold=True, color=WHITE)
add_text(s, Inches(1.0), Inches(3.8), Inches(5), Inches(0.4), "Pre-money 밸류 ₩3B 범위", size=13, color=WHITE)

# 사용처
add_text(s, Inches(7.0), Inches(1.9), Inches(6), Inches(0.5), "사용처", size=18, bold=True, color=NAVY)
usages = [
    ("영업·마케팅", "40%", "₩200M", CORAL),
    ("제품 개발", "40%", "₩200M", ACCENT),
    ("운영·인프라", "20%", "₩100M", NAVY),
]
y = Inches(2.6)
for label, pct, amt, color in usages:
    add_rect(s, Inches(7.0), y, Inches(5.5), Inches(0.6), LIGHT)
    add_rect(s, Inches(7.0), y, Inches(0.12), Inches(0.6), color)
    add_text(s, Inches(7.3), y + Inches(0.12), Inches(2.5), Inches(0.4), label, size=14, bold=True, color=NAVY)
    add_text(s, Inches(9.8), y + Inches(0.12), Inches(1), Inches(0.4), pct, size=14, bold=True, color=color, align=PP_ALIGN.RIGHT)
    add_text(s, Inches(11.0), y + Inches(0.12), Inches(1.5), Inches(0.4), amt, size=14, color=GRAY, align=PP_ALIGN.RIGHT)
    y += Inches(0.75)

# 마일스톤
add_text(s, Inches(0.6), Inches(5.2), Inches(12), Inches(0.5), "18개월 마일스톤", size=16, bold=True, color=NAVY)
milestones = [
    "학원 수 1,000 달성 · ARR ₩240M",
    "학부모 앱 출시 · 번들 플랜 정식 런칭",
    "Series A 진입 지표 확보 (NRR 115%+)",
]
add_bullets(s, Inches(0.6), Inches(5.7), Inches(12), Inches(1.5), milestones, size=14)
add_page_num(s, 13)

# ==============================================================
# Slide 14 — Closing
# ==============================================================
s = prs.slides.add_slide(BLANK)
add_rect(s, 0, 0, SW, SH, NAVY)
add_rect(s, 0, Inches(3.5), SW, Inches(0.06), CORAL)

add_text(s, Inches(0.8), Inches(2.4), Inches(12), Inches(1.0),
         "학원 운영의 마지막 마찰을 지운다.", size=40, bold=True, color=WHITE)
add_text(s, Inches(0.8), Inches(3.8), Inches(12), Inches(0.6),
         "월 2만원, 학생 60명, 선생 5시간을 돌려드립니다.", size=20, color=CORAL)

add_text(s, Inches(0.8), Inches(5.8), Inches(12), Inches(0.4), "Contact", size=14, bold=True, color=CORAL)
add_text(s, Inches(0.8), Inches(6.2), Inches(12), Inches(0.4), "founder@wawa.app  ·  wawa.app", size=16, color=WHITE)

# ==============================================================
# Slide 15 — Appendix: Architecture
# ==============================================================
s = prs.slides.add_slide(BLANK)
add_header_bar(s, "Appendix · Architecture", "학원당 원가 ₩200 구현의 비밀")

# 아키텍처 다이어그램
layers = [
    ("Client", "React · Vite · PWA", Inches(1.9), LIGHT, NAVY),
    ("Edge", "Cloudflare Workers (글로벌 280+ POP)", Inches(2.9), ACCENT, WHITE),
    ("Data", "D1 (SQLite) · KV · R2 · Vectorize", Inches(3.9), NAVY, WHITE),
    ("AI", "Gemini API · 학원 데이터 파이프라인", Inches(4.9), CORAL, WHITE),
]
for label, desc, y, bg, fg in layers:
    add_rect(s, Inches(2.0), y, Inches(9.3), Inches(0.85), bg)
    add_text(s, Inches(2.3), y + Inches(0.1), Inches(2), Inches(0.3), label, size=14, bold=True, color=fg)
    add_text(s, Inches(2.3), y + Inches(0.45), Inches(9), Inches(0.35), desc, size=12, color=fg)

add_rect(s, Inches(0.6), Inches(6.1), Inches(12), Inches(1.0), LIGHT)
add_text(s, Inches(0.9), Inches(6.25), Inches(12), Inches(0.4),
         "🛡  멀티테넌트 격리  ·  academy_id 컬럼 + teacher 소유권 이중 방어",
         size=13, bold=True, color=NAVY)
add_text(s, Inches(0.9), Inches(6.65), Inches(12), Inches(0.4),
         "⚡  서버리스 엣지  ·  cold start 없음, 학원당 인프라 비용 월 ₩200 수준",
         size=13, color=GRAY)
add_page_num(s, 15)

# ==============================================================
out = '/mnt/g/progress/wawa/wawa_smart_erp/docs/WAWA_ERP_IR_Deck.pptx'
prs.save(out)
print(f"✅ Saved: {out}")
print(f"   Slides: {len(prs.slides)}")
