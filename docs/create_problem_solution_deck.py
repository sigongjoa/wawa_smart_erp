"""
선생/원장 페인포인트 → 솔루션 PPT
"""
from pptx import Presentation
from pptx.util import Inches, Pt, Emu
from pptx.dml.color import RGBColor
from pptx.enum.shapes import MSO_SHAPE
from pptx.enum.text import PP_ALIGN
from PIL import Image
import os

NAVY = RGBColor(0x0A, 0x1F, 0x44)
CORAL = RGBColor(0xFF, 0x6B, 0x6B)
LIGHT = RGBColor(0xF5, 0xF7, 0xFA)
GRAY = RGBColor(0x6B, 0x72, 0x80)
WHITE = RGBColor(0xFF, 0xFF, 0xFF)
GREEN = RGBColor(0x2E, 0xB8, 0x7C)
RED = RGBColor(0xE5, 0x3E, 0x3E)
YELLOW = RGBColor(0xFF, 0xC1, 0x07)

SCR = "/mnt/g/progress/wawa/wawa_smart_erp/docs/screenshots/pages"
OUT = "/mnt/g/progress/wawa/wawa_smart_erp/docs/WAWA_ERP_Problem_Solution.pptx"

prs = Presentation()
prs.slide_width = Inches(13.333)
prs.slide_height = Inches(7.5)
SW, SH = prs.slide_width, prs.slide_height
BLANK = prs.slide_layouts[6]


def text(slide, x, y, w, h, t, size=18, bold=False, color=NAVY, align=PP_ALIGN.LEFT):
    tb = slide.shapes.add_textbox(x, y, w, h)
    tf = tb.text_frame
    tf.word_wrap = True
    p = tf.paragraphs[0]
    p.alignment = align
    r = p.add_run()
    r.text = t
    r.font.size = Pt(size)
    r.font.bold = bold
    r.font.color.rgb = color
    r.font.name = "Pretendard"
    return tb


def rect(slide, x, y, w, h, fill, line=None):
    s = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, x, y, w, h)
    s.fill.solid()
    s.fill.fore_color.rgb = fill
    if line is None:
        s.line.fill.background()
    else:
        s.line.color.rgb = line
    s.shadow.inherit = False
    return s


def fit(slide, path, x, y, max_w, max_h):
    if not os.path.exists(path):
        return
    with Image.open(path) as im:
        iw, ih = im.size
    r = min(max_w / iw, max_h / ih)
    nw, nh = int(iw * r), int(ih * r)
    cx = x + (max_w - nw) // 2
    cy = y + (max_h - nh) // 2
    slide.shapes.add_picture(path, cx, cy, width=nw, height=nh)


def cover():
    s = prs.slides.add_slide(BLANK)
    rect(s, 0, 0, SW, SH, NAVY)
    rect(s, 0, Inches(3.0), SW, Inches(0.05), CORAL)
    text(s, Inches(0.8), Inches(2.0), Inches(12), Inches(1),
         "WAWA ERP — 문제와 해결", size=42, bold=True, color=WHITE)
    text(s, Inches(0.8), Inches(3.2), Inches(12), Inches(0.6),
         "선생과 원장의 매일을 어떻게 바꾸는가", size=20, color=LIGHT)
    text(s, Inches(0.8), Inches(6.6), Inches(12), Inches(0.4),
         "Problem → Solution · 12개 페인포인트", size=14, color=GRAY)


def divider(role, title, subtitle, color):
    s = prs.slides.add_slide(BLANK)
    rect(s, 0, 0, SW, SH, LIGHT)
    rect(s, 0, Inches(3.0), SW, Inches(1.5), color)
    text(s, Inches(0.8), Inches(3.15), Inches(12), Inches(0.45),
         role, size=14, color=WHITE, bold=True)
    text(s, Inches(0.8), Inches(3.55), Inches(12), Inches(0.7),
         title, size=36, bold=True, color=WHITE)
    text(s, Inches(0.8), Inches(5.0), Inches(12), Inches(0.5),
         subtitle, size=16, color=NAVY)


def problem_solution(role, problem_title, problem_body, solution_title, solution_body, screen, kpi=""):
    s = prs.slides.add_slide(BLANK)
    role_color = CORAL if role == "선생" else NAVY

    # 헤더
    rect(s, 0, 0, SW, Inches(0.85), NAVY)
    rect(s, 0, 0, Inches(1.5), Inches(0.85), role_color)
    text(s, Inches(0.2), Inches(0.22), Inches(1.3), Inches(0.45),
         f"👤 {role}", size=16, bold=True, color=WHITE, align=PP_ALIGN.CENTER)
    text(s, Inches(1.7), Inches(0.25), Inches(11), Inches(0.5),
         problem_title, size=20, bold=True, color=WHITE)

    # 문제 카드 (좌)
    rect(s, Inches(0.4), Inches(1.1), Inches(4.0), Inches(5.7), WHITE, line=RED)
    rect(s, Inches(0.4), Inches(1.1), Inches(4.0), Inches(0.55), RED)
    text(s, Inches(0.6), Inches(1.22), Inches(3.7), Inches(0.4),
         "❌ 기존 문제", size=13, bold=True, color=WHITE)
    text(s, Inches(0.6), Inches(1.85), Inches(3.7), Inches(4.8),
         problem_body, size=11, color=NAVY)

    # 화살표
    arrow = s.shapes.add_shape(MSO_SHAPE.RIGHT_ARROW,
                                Inches(4.55), Inches(3.4), Inches(0.5), Inches(0.7))
    arrow.fill.solid()
    arrow.fill.fore_color.rgb = GREEN
    arrow.line.fill.background()

    # 솔루션 카드 (중)
    rect(s, Inches(5.2), Inches(1.1), Inches(4.0), Inches(5.7), WHITE, line=GREEN)
    rect(s, Inches(5.2), Inches(1.1), Inches(4.0), Inches(0.55), GREEN)
    text(s, Inches(5.4), Inches(1.22), Inches(3.7), Inches(0.4),
         "✓ WAWA 해결", size=13, bold=True, color=WHITE)
    text(s, Inches(5.4), Inches(1.85), Inches(3.7), Inches(0.4),
         solution_title, size=12, bold=True, color=GREEN)
    text(s, Inches(5.4), Inches(2.3), Inches(3.7), Inches(4.4),
         solution_body, size=11, color=NAVY)

    # 화면 (우)
    rect(s, Inches(9.4), Inches(1.1), Inches(3.55), Inches(5.7), WHITE, line=GRAY)
    rect(s, Inches(9.4), Inches(1.1), Inches(3.55), Inches(0.5), NAVY)
    text(s, Inches(9.55), Inches(1.18), Inches(3.4), Inches(0.4),
         "📱 실제 화면", size=11, bold=True, color=WHITE)
    if screen:
        fit(s, f"{SCR}/{screen}", Inches(9.45), Inches(1.7),
            Inches(3.45), Inches(5.0))

    # KPI 바
    if kpi:
        rect(s, 0, Inches(7.0), SW, Inches(0.5), YELLOW)
        text(s, Inches(0.5), Inches(7.05), Inches(12.5), Inches(0.4),
             f"📊 효과: {kpi}", size=12, bold=True, color=NAVY)


cover()

# ───────────────────────────────────────
# 선생 (Instructor) 섹션
# ───────────────────────────────────────
divider("Part 1", "선생의 하루", "수업 외 시간을 잡아먹는 6가지 페인포인트", CORAL)

problem_solution(
    "선생",
    "P1 · 학생별 진도 파악에 매번 시간 소요",
    "• 어제 어디까지 풀었는지 노트/엑셀 뒤져야 함\n"
    "• 학생마다 다른 교재, 다른 진도\n"
    "• 수업 시작 5분이 이걸로 날아감\n"
    "• 다른 선생이 본 학생이면 더 깜깜\n\n"
    "→ 결국 학생에게 '어디까지 했지?' 묻고 시작",
    "보드 + 학생 프로필 통합",
    "• 학생 카드 클릭 → 어제 진도 즉시 표시\n"
    "• 보드에 오늘 할일 미리 등록\n"
    "• 교재 페이지 단위 추적\n"
    "• 다른 선생의 기록도 동일 화면",
    "31-student-profile.png",
    "수업 준비 시간 5분 → 30초"
)

problem_solution(
    "선생",
    "P2 · 자습 시간을 객관적으로 측정 못 함",
    "• '몇 시간 공부했지?'를 학생 자기 신고\n"
    "• 학부모가 '얼마나 했어요?' 물으면 두루뭉술\n"
    "• 공부 안 하고 폰만 본 학생도 구분 안 됨\n\n"
    "→ 학부모 신뢰 = 선생 신뢰 = 수업료 정당성",
    "원클릭 체크인 + 자동 타이머",
    "• 학생 본인 카드 클릭 → 타이머 시작\n"
    "• 자습 시간 자동 누적 (일/주/월)\n"
    "• 실시간 자습 상태 모니터링\n"
    "• AI 리포트에 자동 반영",
    "10-timer-main.png",
    "학부모 신뢰도 ↑ · 학생별 학습량 객관 데이터"
)

problem_solution(
    "선생",
    "P3 · 매일 학생별 할일 배포가 번거로움",
    "• '오늘 뭐 풀어요?' 매번 같은 질문\n"
    "• 칠판/노트에 적으면 학생이 잊어버림\n"
    "• 카톡으로 보내면 흩어짐\n"
    "• 진행 여부 확인이 또 일",
    "보드 시스템",
    "• 학생별 할일 카드 사전 등록\n"
    "• 학생이 도착 즉시 본인 보드 확인\n"
    "• 완료 체크 → 진행률 자동 집계\n"
    "• 미완료는 다음날 자동 이월",
    "20-board-main.png",
    "'뭐 풀어요?' 질문 사라짐 · 진도 누락 0"
)

problem_solution(
    "선생",
    "P4 · 학부모 상담 준비에 30분",
    "• 출결 노트, 성적 엑셀, 카톡 메모 다 뒤짐\n"
    "• 5분 상담 위해 30분 준비\n"
    "• 상담 중 데이터 빠뜨리면 신뢰 추락",
    "학생 통합 프로필 1페이지",
    "• 출결, 성적, 리포트, 메모 한 화면\n"
    "• 학부모 도착 직전 5분이면 충분\n"
    "• 가챠 학습 기록까지 통합\n"
    "• 보강 이력 자동 표시",
    "31-student-profile.png",
    "상담 준비 30분 → 5분 (월 평균 10시간 절감)"
)

problem_solution(
    "선생",
    "P5 · 월말 학부모 리포트 작성이 지옥",
    "• 학생 1명당 30분 × 60명 = 30시간\n"
    "• 월말마다 야근 확정\n"
    "• 비슷한 문구 복붙되어 학부모도 식상\n"
    "• 데이터 일일이 찾아 적기",
    "Gemini AI 리포트 자동 생성",
    "• 출결/성적/자습시간 자동 분석\n"
    "• 학생별 자연어 코멘트 생성\n"
    "• 선생은 검토 + 약간 수정만\n"
    "• 알림톡 자동 발송",
    "70-report-main.png",
    "리포트 1건 30분 → 3분 · 월 27시간 절감"
)

problem_solution(
    "선생",
    "P6 · 결석 학생 보강 일정 까먹음",
    "• 결석은 메모해도 보강 일정은 흐지부지\n"
    "• 학부모가 항의해야 그제야 인지\n"
    "• 보강 안 했는데 진도는 나가 있음\n"
    "• 학원/학부모 갈등 원인 1순위",
    "보강 자동 트래킹",
    "• 결석 등록 즉시 미보강 큐 진입\n"
    "• 보강일 지정 → 보강예정 자동 전환\n"
    "• 완료 1클릭 → 출결 + 알림톡 자동\n"
    "• 미보강 리스트가 매일 보임",
    "41-absence-filter-1-미보강.png",
    "보강 누락 0건 · 학부모 컴플레인 ↓"
)

# ───────────────────────────────────────
# 원장 (Director) 섹션
# ───────────────────────────────────────
divider("Part 2", "원장의 고민", "운영과 매출을 위협하는 6가지 페인포인트", NAVY)

problem_solution(
    "원장",
    "D1 · 보강 누락 = 매출 누수, 인지 못 함",
    "• 결석은 봤는데 보강 됐는지 모름\n"
    "• 월 20-30건 보강 누락 = 수업료는 받았는데 수업 안 함\n"
    "• 학생 60명 × 5% 누수 = 월 60만원 손실\n"
    "• 학부모가 따져야 알게 됨",
    "보강 관리 KPI 화면",
    "• 미보강/예정/완료 한눈에\n"
    "• 매주 한 번 점검만 해도 누락 0\n"
    "• 학부모 알림톡 자동 = 신뢰 구축\n"
    "• 누가 누락시켰는지 트래킹",
    "40-absence-main.png",
    "월 매출 5-10% 보호 (학원당 30-100만원/월)"
)

problem_solution(
    "원장",
    "D2 · 선생 교체 시 학생 인수인계 공백",
    "• 선생이 그만두면 해당 학생들 정보 증발\n"
    "• 새 선생은 처음부터 학생 파악\n"
    "• 학부모는 '왜 우리 애를 모르세요?' 불만\n"
    "• 학생 이탈 위험 급증",
    "학생 통합 프로필 + 메모 히스토리",
    "• 모든 선생의 학생 메모 누적\n"
    "• 새 선생이 프로필만 봐도 즉시 파악\n"
    "• 출결/성적/리포트 자동 인계\n"
    "• 선생 교체 마찰 최소화",
    "31-student-profile.png",
    "선생 교체 후 학생 이탈률 ↓"
)

problem_solution(
    "원장",
    "D3 · 학원 전체 출결 현황을 모름",
    "• 어제 결석 몇 명? 보강 몇 명?\n"
    "• 자습 시간 학원 평균은?\n"
    "• 데이터가 선생 노트에 흩어져 있음\n"
    "• 운영 의사결정에 데이터가 없음",
    "원장 대시보드 + 통합 데이터",
    "• 학원 전체 출결/보강/매출 한 화면\n"
    "• admin 권한으로 전 학생 조회 가능\n"
    "• 자습 시간 평균/순위\n"
    "• 데이터 기반 운영 결정",
    "40-absence-main.png",
    "운영 의사결정 속도 ↑ · 데이터 기반 경영"
)

problem_solution(
    "원장",
    "D4 · 학부모 알림톡을 일일이 보내야 함",
    "• 결석/보강/리포트/공지 매번 수동 발송\n"
    "• 누구한테 보냈는지 추적 불가\n"
    "• 발송 빠진 학부모는 컴플레인\n"
    "• 카톡 채널 운영도 일",
    "이벤트 기반 자동 알림톡",
    "• 결석 등록 → 자동 알림\n"
    "• 보강 확정 → 자동 알림\n"
    "• 리포트 발행 → 자동 알림\n"
    "• 학원 단위 일괄 설정",
    "A0-settings.png",
    "알림톡 발송 시간 0 · 도달률 100%"
)

problem_solution(
    "원장",
    "D5 · 학부모 신뢰를 객관 데이터로 입증 못 함",
    "• '우리 애 잘하고 있어요?' 답이 두루뭉술\n"
    "• 경쟁 학원 옮기면 막을 명분 없음\n"
    "• 수업료 인상 정당화 어려움\n"
    "• 신규 학부모 설득 자료도 부족",
    "AI 리포트 + 학습 데이터 시각화",
    "• 출결/자습시간/성적 추이 자연어 리포트\n"
    "• 가챠 학습 기록까지 포함\n"
    "• 공유 링크로 학부모가 직접 조회\n"
    "• 데이터로 신뢰 구축",
    "70-report-main.png",
    "학부모 이탈률 ↓ · 수업료 인상 명분 확보"
)

problem_solution(
    "원장",
    "D6 · 시험 관리가 종이/엑셀로 흩어져 있음",
    "• 정기고사 5과목 × 학년별 = 폭발\n"
    "• 성적 엑셀 입력 후 또 리포트에 옮김\n"
    "• 시험지 PDF는 USB/카톡으로 흩어짐\n"
    "• 학부모 요청 시 즉시 못 보여줌",
    "시험 자동 생성 + R2 시험지 보관",
    "• 정기고사 설정 → 과목별 자동 생성\n"
    "• 성적 입력 즉시 리포트 반영\n"
    "• 시험지 PDF는 R2에 학생별 보관\n"
    "• AI가 시험지로 약점 분석",
    "80-exams-main.png",
    "시험 관리 시간 80% 단축 · 데이터 손실 0"
)

# ───────────────────────────────────────
# 마무리
# ───────────────────────────────────────
s = prs.slides.add_slide(BLANK)
rect(s, 0, 0, SW, SH, NAVY)
rect(s, 0, Inches(3.0), SW, Inches(0.05), CORAL)
text(s, Inches(0.8), Inches(1.2), Inches(12), Inches(0.6),
     "정리 — 매일을 어떻게 바꾸는가", size=28, bold=True, color=WHITE)

# 선생 박스
rect(s, Inches(0.8), Inches(3.4), Inches(5.8), Inches(3.5), WHITE)
rect(s, Inches(0.8), Inches(3.4), Inches(5.8), Inches(0.7), CORAL)
text(s, Inches(1.0), Inches(3.55), Inches(5.5), Inches(0.4),
     "👤 선생", size=18, bold=True, color=WHITE)
text(s, Inches(1.0), Inches(4.3), Inches(5.5), Inches(2.5),
     "✓ 수업 준비 5분 → 30초\n"
     "✓ 학부모 상담 준비 30분 → 5분\n"
     "✓ 월말 리포트 30시간 → 3시간\n"
     "✓ 보강 누락 0건\n"
     "✓ 자습 시간 객관 측정",
     size=13, color=NAVY)

# 원장 박스
rect(s, Inches(6.7), Inches(3.4), Inches(5.8), Inches(3.5), WHITE)
rect(s, Inches(6.7), Inches(3.4), Inches(5.8), Inches(0.7), NAVY)
text(s, Inches(6.9), Inches(3.55), Inches(5.5), Inches(0.4),
     "🏫 원장", size=18, bold=True, color=WHITE)
text(s, Inches(6.9), Inches(4.3), Inches(5.5), Inches(2.5),
     "✓ 매출 누수 5-10% 차단\n"
     "✓ 학생 이탈률 ↓\n"
     "✓ 학부모 신뢰 객관 데이터화\n"
     "✓ 알림톡 발송 자동화\n"
     "✓ 데이터 기반 운영 결정",
     size=13, color=NAVY)

text(s, Inches(0.8), Inches(7.0), Inches(12), Inches(0.4),
     "월 2만원 / 학원 · 학생 60명 규모",
     size=12, color=GRAY, align=PP_ALIGN.CENTER)


prs.save(OUT)
print(f"✅ {OUT}")
print(f"   슬라이드: {len(prs.slides)}장")
