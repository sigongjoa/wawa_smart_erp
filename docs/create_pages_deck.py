"""
페이지별 + 기능별 유즈케이스 덱
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
ACCENT = RGBColor(0x4A, 0x90, 0xE2)

SCR = "/mnt/g/progress/wawa/wawa_smart_erp/docs/screenshots/pages"
OUT = "/mnt/g/progress/wawa/wawa_smart_erp/docs/WAWA_ERP_Pages_UseCases.pptx"

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
         "WAWA ERP — 페이지별 유즈케이스", size=44, bold=True, color=WHITE)
    text(s, Inches(0.8), Inches(3.2), Inches(12), Inches(0.6),
         "11개 페이지 · 23개 기능 시나리오 · Live Production",
         size=20, color=LIGHT)
    text(s, Inches(0.8), Inches(6.6), Inches(12), Inches(0.4),
         "wawa-smart-erp.pages.dev", size=14, color=GRAY)


def section(title, subtitle, count):
    s = prs.slides.add_slide(BLANK)
    rect(s, 0, 0, SW, SH, LIGHT)
    rect(s, 0, Inches(3.3), SW, Inches(0.9), NAVY)
    text(s, Inches(0.8), Inches(3.45), Inches(12), Inches(0.5),
         title, size=32, bold=True, color=WHITE)
    text(s, Inches(0.8), Inches(4.0), Inches(12), Inches(0.4),
         subtitle, size=14, color=LIGHT)
    text(s, Inches(0.8), Inches(5.5), Inches(12), Inches(0.5),
         f"{count}개 유즈케이스", size=18, color=CORAL, bold=True)


USE_CASES = {
    "01-login-form.png":
        "✓ 출근 직후 5초 로그인  ✓ 모바일에서 빠른 출결 확인  ✓ 학원 외부에서 학부모 응대 전 데이터 조회",
    "02-login-academy-selected.png":
        "✓ 한 명이 여러 학원을 운영하는 경우 학원별 분리 접속  ✓ 본사-지점 구조에서 지점별 데이터 격리",
    "03-login-filled.png":
        "✓ PIN 노출 위험 최소화 (4자리)  ✓ 키오스크 PC 공용 사용 가능  ✓ 보안과 사용성 균형",
    "10-timer-main.png":
        "✓ 학생 도착 즉시 자동 출결  ✓ 자습 시간 객관 측정 (학부모 보고용)  ✓ '누가 언제 갔지?' 문의 즉답",
    "20-board-main.png":
        "✓ 매일 아침 학생별 할일 일괄 배포  ✓ 학생이 묻기 전에 '뭐 풀까요?' 해결  ✓ 진도 누락 방지",
    "21-board-add-todo.png":
        "✓ 수업 중 즉석 과제 추가  ✓ 같은 반 학생들에게 일괄 배포  ✓ 다음 수업 예습 과제 예약",
    "30-student-list.png":
        "✓ 본인 담당 학생만 보이는 정보 과부하 차단  ✓ 학년/학교별 빠른 검색  ✓ 학부모 전화 시 즉시 학생 찾기",
    "31-student-profile.png":
        "✓ 학부모 상담 직전 5분 브리핑  ✓ 선생 교체/인수인계 시 단일 페이지 참조  ✓ 학생 상태 종합 판단",
    "40-absence-main.png":
        "✓ 원장 주간 점검 (보강 누락 = 매출 누수 차단)  ✓ 결석/보강 현황 한 화면 파악  ✓ 학원 운영의 핵심 지표",
    "41-absence-filter-1-미보강.png":
        "✓ 보강 일정 미정인 학생 추적  ✓ 학부모와 일정 협의 우선순위 결정  ✓ 미보강 0 = 매출 100% 회수",
    "41-absence-filter-2-보강예정.png":
        "✓ 오늘/이번 주 보강 일정 확인  ✓ 보강 종료 시 1클릭 완료 처리  ✓ 학부모 자동 알림으로 신뢰 구축",
    "42-absence-add.png":
        "✓ 학부모 결석 통보 30초 등록  ✓ 사유 분류로 출결 통계 정확화  ✓ 등록 즉시 학부모 접수 알림",
    "50-materials-main.png":
        "✓ 학원 사용 교재 카탈로그 관리  ✓ 보드 할일 등록 시 교재 자동 연동  ✓ 학생별 진도 추적 기준점",
    "60-meeting-main.png":
        "✓ 주간 선생 회의록 누적  ✓ 액션아이템 흐지부지 방지  ✓ 검색 가능한 조직 지식 축적",
    "61-meeting-create.png":
        "✓ 회의 종료 직후 5분 정리  ✓ 참석자 자동 알림  ✓ 액션아이템 담당자/마감일 즉시 지정",
    "70-report-main.png":
        "✓ 월말 학부모 리포트 30분 → 3분 단축  ✓ Gemini 자동 분석 + 선생 검토  ✓ 알림톡 자동 발송으로 도달률 보장",
    "80-exams-main.png":
        "✓ 정기고사/월말 시험 인스턴스 일괄 생성  ✓ 과목별 자동 분리로 입력 누락 방지  ✓ 성적 즉시 리포트 반영",
    "85-exam-papers.png":
        "✓ 학생별 시험지 PDF 보관 (R2)  ✓ 약점 단원 진단 자료  ✓ AI 리포트가 시험지 데이터 활용",
    "90-gacha-student.png":
        "✓ 학습 동기 부여 (초중등 타겟)  ✓ 자율 학습 유도  ✓ 수업 외 시간에도 학원 앱 접속 유지 = 락인",
    "91-gacha-cards.png":
        "✓ 선생이 직접 문제 출제  ✓ 학년/단원별 분류 배포  ✓ 학원 고유 문제 자산 축적",
    "92-gacha-card-add.png":
        "✓ 텍스트/이미지 카드 빠른 등록  ✓ R2 이미지 업로드 (5MB)  ✓ 학생별 맞춤 출제 가능",
    "93-gacha-proofs.png":
        "✓ 수학 증명 단계별 채점  ✓ 막힌 단계 진단  ✓ 학부모/타 선생 공유 링크",
    "94-gacha-dashboard.png":
        "✓ 학생별 학습 패턴 분석  ✓ 약점 단원 시각화  ✓ 보강 수업 방향을 데이터로 결정",
    "A0-settings.png":
        "✓ 학원 정보/시간대 설정  ✓ 알림톡 발송 설정 (학부모 도달률 핵심)  ✓ 본인 PIN 변경",
}

NOTES = {
    "01-login-form.png":
        "[발표 포인트] WAWA ERP의 첫 진입점. 학원 슬러그 기반 멀티 테넌트 구조로, "
        "학원을 먼저 선택해야 사용자 풀이 결정됨. PIN 4자리는 데스크탑/모바일 어디서든 5초 안에 로그인하기 위한 의도적 단순화. "
        "보안은 PIN 해시 + 실패 5회 잠금 + JWT 7일 세션으로 보완.",
    "02-login-academy-selected.png":
        "[발표 포인트] 학원 선택 = 멀티 테넌트 컨텍스트 결정. 모든 후속 API 호출에 academy_id가 자동 주입되며, "
        "DB 쿼리 레벨에서 학원 데이터가 완전 격리됨. 한 학원의 데이터가 다른 학원에 노출될 수 없는 구조.",
    "03-login-filled.png":
        "[발표 포인트] 입력 완료 → JWT 발급 → 역할(admin/instructor) 정보 포함. "
        "이후 모든 화면이 역할에 따라 다르게 렌더링됨. 예: instructor는 본인 담당 학생만, admin은 학원 전체.",
    "10-timer-main.png":
        "[발표 포인트] 학원의 일상 90%가 여기서 시작. 학생이 본인 카드를 누르면 자동 출석 + 자습 타이머 시작. "
        "선생은 한 화면에서 모든 학생의 자습 상태(공부 중/쉬는 중/하원)를 실시간 모니터링. "
        "이 데이터가 월말 AI 리포트의 '자습 시간' 지표로 자동 누적됨.",
    "20-board-main.png":
        "[발표 포인트] '오늘 무엇을 해야 하는지'를 학생/선생이 공유하는 단일 보드. "
        "선생은 학생별로 할일을 미리 등록해두고, 학생은 도착 즉시 무엇을 풀지 알 수 있음. "
        "타이머와 연동되어 진행률이 자동 집계되고, 미완료 항목은 다음날로 자동 이월.",
    "21-board-add-todo.png":
        "[발표 포인트] 할일 추가는 3초 안에 완료되어야 함. 텍스트/페이지 범위/마감일만 입력. "
        "학생 다중 할당으로 같은 진도를 한번에 여러 명에게 배포 가능.",
    "30-student-list.png":
        "[발표 포인트] 학원 ERP의 가장 큰 차별점 — '선생 중심' 학생 목록. "
        "기존 학원 솔루션은 모든 학생을 보여줘서 정보 과부하. 우리는 본인 담당 학생만 자동 필터링. "
        "admin(원장)은 전체를 볼 수 있지만, instructor(선생)는 본인 책임 학생만. 이게 일상 사용성을 좌우함.",
    "31-student-profile.png":
        "[발표 포인트] 학생 한 명에 대한 모든 정보가 한 페이지에. "
        "출결, 성적, 리포트 히스토리, 학부모 메모, 보강 이력. "
        "이 페이지가 가장 중요한 이유는 '선생 교체 시 인수인계'. 새 선생이 이 페이지만 보면 학생을 즉시 파악 가능.",
    "40-absence-main.png":
        "[★핵심] 학원 매출의 가장 큰 누수 지점이 '결석 후 보강 누락'. "
        "결석은 등록되지만 보강 일정이 안 잡히면 학원은 수업료를 받고 수업을 못 한 셈. "
        "이 화면은 미보강/보강예정/보강완료를 한눈에 보여줘서 누락을 원천 차단. "
        "원장이 매주 한 번만 점검해도 매출 5-10% 보호됨.",
    "41-absence-filter-1-미보강.png":
        "[★핵심] '미보강' 필터가 가장 중요한 화면. "
        "결석은 했는데 아직 보강 일정이 미정인 학생만 모아서 보여줌. "
        "이 리스트가 0이 되는 것이 운영의 KPI. 학부모와 협의해서 보강일을 잡으면 자동으로 '보강예정'으로 이동.",
    "41-absence-filter-2-보강예정.png":
        "[발표 포인트] 보강일이 확정된 학생 목록. "
        "선생은 보강이 끝나면 '완료' 버튼만 누르면 됨 — 그 한 번의 클릭으로 출결 자동 기록 + 학부모 알림톡 발송 + AI 리포트 반영까지 자동.",
    "42-absence-add.png":
        "[발표 포인트] 학부모 결석 통보 시 선생이 30초 안에 등록. "
        "사유 분류(병/사정/기타) + 보강 후보 시간대 자동 제안. "
        "등록 즉시 미보강 큐로 들어가고, 학부모에게 결석 접수 알림톡 자동 발송.",
    "50-materials-main.png":
        "[발표 포인트] 학원에서 사용하는 모든 교재를 카탈로그로 관리. "
        "보드 할일 등록 시 '어떤 교재의 몇 페이지'로 연결되어 진도 추적이 자동화됨. "
        "선생이 '이 학생 OO 교재 어디까지 풀었지?'를 1초 안에 확인 가능.",
    "60-meeting-main.png":
        "[발표 포인트] 선생 회의록과 액션아이템을 한 곳에 누적. "
        "회의에서 결정된 액션은 담당자/마감일과 함께 추적되어 흐지부지되는 회의 방지. "
        "검색 가능한 조직 지식으로 축적됨.",
    "61-meeting-create.png":
        "[발표 포인트] 회의 제목 + 참석자 + 마크다운 회의록 입력. "
        "발행 시 참석자 전원에게 알림. 액션아이템은 별도 컴포넌트로 추출되어 담당자 지정.",
    "70-report-main.png":
        "[발표 포인트] 학원의 월말 가장 큰 시간 소요 작업 — 학부모 리포트 작성 — 을 Gemini로 자동화. "
        "학생별 출결, 성적, 자습시간 데이터를 분석해 자연어 리포트 생성. "
        "선생은 검토 + 약간의 수정만 하면 됨. 리포트 1건당 30분 → 3분으로 단축. "
        "공유 링크 + 알림톡 자동 발송으로 학부모 도달률 보장.",
    "80-exams-main.png":
        "[발표 포인트] 정기고사/월말평가 설정 시 과목별 시험 인스턴스가 자동 생성. "
        "'중1 1학기 중간고사'를 선택하면 국/영/수/사/과 5개 시험이 한번에 생성되어 성적 입력만 하면 됨. "
        "성적 입력 즉시 학생 프로필 + AI 리포트에 반영.",
    "85-exam-papers.png":
        "[발표 포인트] 학생별 시험지 PDF를 R2 스토리지에 업로드 + 점수 기록. "
        "시험지는 단순 채점 도구가 아니라 '학생의 약점을 진단하는 자료'. "
        "AI 리포트가 시험지 데이터를 활용해 약점 단원을 자동 추출.",
    "90-gacha-student.png":
        "[발표 포인트] 학원 차별화 포인트 — 학습 게이미피케이션. "
        "학생이 카드(문제)를 풀어 정답이면 새 카드 획득 → 도감처럼 컬렉션. "
        "초중등 학생의 학습 동기를 자연스럽게 부여. 이게 우리만의 락인 요소.",
    "91-gacha-cards.png":
        "[발표 포인트] 선생이 직접 문제 카드를 출제. "
        "텍스트형 + 이미지형(R2 업로드) 모두 지원. 학년/단원별 분류로 학생 맞춤 배포.",
    "92-gacha-card-add.png":
        "[발표 포인트] 카드 추가 시 입력 검증 + R2 이미지 업로드 (5MB, PNG/JPG/WebP). "
        "학생을 지정하면 그 학생에게만 출제, 미지정 시 학원 공용 카드.",
    "93-gacha-proofs.png":
        "[발표 포인트] 수학 증명 문제는 단계별 채점이 핵심. "
        "도형 첨부 + 단계별 진행 추적으로 '어느 단계에서 막혔는지' 진단 가능. "
        "공유 링크로 학부모/타 선생과 공유.",
    "94-gacha-dashboard.png":
        "[발표 포인트] 학생별 카드 컬렉션 진척도 + 정답률 통계. "
        "'어느 단원에서 정답률이 낮은지'가 시각화되어 선생이 보강 수업 방향을 데이터로 결정.",
    "A0-settings.png":
        "[발표 포인트] 학원 정보, 알림톡 설정, 시간대, 사용자 PIN 변경. "
        "특히 알림톡 설정은 학부모 도달률을 좌우하는 핵심 설정.",
}


def add_notes(slide, note_text):
    notes = slide.notes_slide
    notes.notes_text_frame.text = note_text


def usecase(section_label, uc_title, scenario, features, img, notes=""):
    s = prs.slides.add_slide(BLANK)
    # 헤더
    rect(s, 0, 0, SW, Inches(0.9), NAVY)
    text(s, Inches(0.5), Inches(0.15), Inches(8), Inches(0.35),
         section_label, size=11, color=LIGHT)
    text(s, Inches(0.5), Inches(0.4), Inches(11), Inches(0.45),
         uc_title, size=20, bold=True, color=WHITE)

    # 좌측 캡션
    rect(s, Inches(0.4), Inches(1.15), Inches(3.0), Inches(4.55), LIGHT)
    text(s, Inches(0.6), Inches(1.3), Inches(2.7), Inches(0.35),
         "시나리오", size=11, bold=True, color=CORAL)
    text(s, Inches(0.6), Inches(1.7), Inches(2.7), Inches(1.9),
         scenario, size=10, color=NAVY)
    text(s, Inches(0.6), Inches(3.7), Inches(2.7), Inches(0.35),
         "기능", size=11, bold=True, color=CORAL)
    text(s, Inches(0.6), Inches(4.1), Inches(2.7), Inches(1.5),
         features, size=10, color=NAVY)

    # 스크린샷
    ix, iy, iw, ih = Inches(3.7), Inches(1.15), Inches(9.2), Inches(4.55)
    rect(s, ix, iy, iw, ih, WHITE, line=GRAY)
    fit(s, f"{SCR}/{img}", ix + Emu(40000), iy + Emu(40000),
        iw - Emu(80000), ih - Emu(80000))

    # 하단 사용 케이스 바
    use_case = USE_CASES.get(img, "")
    rect(s, Inches(0.4), Inches(5.85), Inches(12.5), Inches(1.15), CORAL)
    text(s, Inches(0.6), Inches(5.95), Inches(12), Inches(0.35),
         "💡 이럴 때 사용합니다", size=12, bold=True, color=WHITE)
    text(s, Inches(0.6), Inches(6.35), Inches(12), Inches(0.65),
         use_case, size=11, color=WHITE)

    text(s, Inches(0.4), Inches(7.15), Inches(12.5), Inches(0.25),
         f"wawa-smart-erp.pages.dev · {img}", size=8, color=GRAY)

    note = NOTES.get(img)
    if note:
        add_notes(s, note)


cover()

# ─────── 로그인 ───────
section("1. 로그인 / 인증", "학원 선택 → 이름 + PIN 4자리", 3)
usecase("로그인", "UC-1.1 · 로그인 폼 첫 진입",
        "선생/원장이 모바일/데스크탑에서 사이트 접속.\n학원을 선택하지 않으면 진행 불가.",
        "• 학원 슬러그 셀렉트\n• 이름 입력\n• PIN 4자리\n• HTTPS · JWT 7일",
        "01-login-form.png")
usecase("로그인", "UC-1.2 · 학원 선택 후 입력 폼 활성화",
        "테넌트(학원)를 선택하면 해당 학원의 사용자 풀에서 인증이 수행됨.",
        "• 학원별 사용자 격리\n• academy_id 컨텍스트\n• 멀티 테넌트 라우팅",
        "02-login-academy-selected.png")
usecase("로그인", "UC-1.3 · 자격증명 입력 완료",
        "이름 + PIN 입력 후 로그인 버튼 활성화.\n실패 5회 시 잠금 (rate limit).",
        "• PIN 해시 검증\n• 실패 카운터\n• JWT 발급\n• 역할 정보 포함",
        "03-login-filled.png")

# ─────── 타이머 ───────
section("2. 타이머 / 출결", "체크인 → 자습 시간 측정 → 자동 출결", 1)
usecase("타이머", "UC-2.1 · 자습 타이머 메인",
        "학생이 학원 도착 후 본인 카드를 누르면 타이머 시작 + 출석 기록.\n선생은 실시간으로 모든 학생의 자습 상태를 모니터링.",
        "• 원클릭 체크인\n• 실시간 타이머\n• 자동 출결\n• 일/월 학습시간 집계",
        "10-timer-main.png")

# ─────── 보드 ───────
section("3. 보드 / 할일", "학생별 오늘의 할일 + 진행 체크", 2)
usecase("보드", "UC-3.1 · 보드 메인",
        "학생별 카드에 오늘 풀어야 할 문제집·과제가 표시됨.\n드래그로 우선순위 조정.",
        "• 학생별 할일 카드\n• 진행률 자동 집계\n• 모바일 최적화\n• 포모도로 연동",
        "20-board-main.png")
usecase("보드", "UC-3.2 · 할일 추가",
        "선생이 학생별로 새 할일을 즉시 추가.\n반복 일정도 등록 가능.",
        "• 텍스트 / 페이지 / 분량\n• 마감일 지정\n• 학생 다중 할당",
        "21-board-add-todo.png")

# ─────── 학생 ───────
section("4. 학생 관리", "선생 중심 학생 목록 + 통합 프로필", 2)
usecase("학생", "UC-4.1 · 담당 학생 목록",
        "본인이 담당하는 학생만 보임 (admin은 전체).\n학년/학교 검색 + 정렬.",
        "• 담당 학생 자동 필터\n• 학년/학교 검색\n• 학부모 연락처\n• 멀티 테넌트 격리",
        "30-student-list.png")
usecase("학생", "UC-4.2 · 학생 통합 프로필",
        "출결, 성적, 리포트 히스토리, 메모를 한 페이지에서 확인.\n선생 교체 시 인수인계 자료.",
        "• 출결 / 성적 / 리포트 통합\n• 학부모 메모\n• 보강 이력\n• 가챠 학습 기록",
        "31-student-profile.png")

# ─────── 결석/보강 ───────
section("5. 결석 / 보강 관리", "★ 핵심 페인포인트 — 매출 보호의 시작점", 4)
usecase("결석/보강", "UC-5.1 · 보강 관리 메인",
        "결석 → 보강 매칭 → 완료까지 누락 없이 추적되어야 학원 매출과 학부모 신뢰가 유지됨.",
        "• 상태별 카운트\n• 학생별 누적 결석\n• 보강일 즉시 지정\n• 완료 1클릭",
        "40-absence-main.png")
usecase("결석/보강", "UC-5.2 · 미보강 필터",
        "결석은 기록됐지만 보강 일정이 미정인 학생만.\n원장이 매주 점검하는 핵심 화면.",
        "• 미보강 자동 집계\n• 학부모 협의 필요 알림\n• 누락 방지 = 매출 보호",
        "41-absence-filter-1-미보강.png")
usecase("결석/보강", "UC-5.3 · 보강예정 필터",
        "보강일이 확정된 학생.\n선생은 보강 종료 시 완료 버튼만 누르면 출결 + 알림톡 자동 처리.",
        "• 일자별 정렬\n• 학부모 자동 알림\n• 출결 자동 반영",
        "41-absence-filter-2-보강예정.png")
usecase("결석/보강", "UC-5.4 · 결석 등록 다이얼로그",
        "학부모 결석 통보 시 선생이 즉시 등록.\n사유 + 보강 후보 시간대 자동 제안.",
        "• 결석 사유 분류\n• 보강 후보 자동 추천\n• 학부모 알림 자동",
        "42-absence-add.png")

# ─────── 교재 ───────
section("6. 교재 관리", "학원 교재 카탈로그", 1)
usecase("교재", "UC-6.1 · 교재 목록",
        "학원에서 사용하는 모든 교재를 카탈로그로 관리.\n학생별 진도와 연동.",
        "• 과목/학년별 분류\n• 진도 추적\n• 보드 할일과 연동",
        "50-materials-main.png")

# ─────── 회의 ───────
section("7. 회의 / 액션", "회의록 + 액션아이템 트래킹", 2)
usecase("회의", "UC-7.1 · 회의 목록",
        "선생 회의록과 액션아이템을 한 곳에 누적.\n공유 + 검색 가능.",
        "• 회의록 저장\n• 액션 아이템 추출\n• 담당자 지정 / 마감일",
        "60-meeting-main.png")
usecase("회의", "UC-7.2 · 새 회의 생성",
        "회의 제목 + 참석자 + 내용 입력.\n액션아이템은 별도 추적.",
        "• 참석자 다중 선택\n• 마크다운 회의록\n• 발행 시 알림",
        "61-meeting-create.png")

# ─────── 리포트 ───────
section("8. AI 리포트", "Gemini 기반 학부모 리포트 자동 생성", 1)
usecase("리포트", "UC-8.1 · 리포트 메인",
        "월말 학생별 출결·성적·자습시간 데이터를 Gemini로 분석.\n학부모용 자연어 리포트 자동 생성.",
        "• Gemini 1.5 분석\n• 학부모 공유 링크\n• 알림톡 자동 발송\n• 리포트 히스토리",
        "70-report-main.png")

# ─────── 시험 ───────
section("9. 시험 관리", "정기고사 / 월말평가 자동 생성", 2)
usecase("시험", "UC-9.1 · 시험 목록 관리",
        "정기고사·월말평가 설정 시 과목별 시험 인스턴스가 자동 생성.\n성적 입력 시 리포트와 자동 연동.",
        "• 정기 / 월말 / 단원\n• 과목별 자동 분리\n• 성적 입력 즉시 반영",
        "80-exams-main.png")
usecase("시험", "UC-9.2 · 시험지 관리",
        "학생별 시험지 PDF 첨부 + 점수 기록.\n시험지 = 진단 도구.",
        "• 시험지 PDF 업로드\n• 학생별 첨부\n• R2 스토리지",
        "85-exam-papers.png")

# ─────── 가챠 ───────
section("10. 가챠 게이미피케이션", "학습 동기 부여 시스템", 5)
usecase("가챠", "UC-10.1 · 학생 가챠 화면",
        "학생이 카드(문제)를 풀고 정답 시 신규 카드 획득.\n컬렉션 기반 학습 동기.",
        "• 카드 뽑기\n• 정답 시 보상\n• 컬렉션 도감",
        "90-gacha-student.png")
usecase("가챠", "UC-10.2 · 카드 관리 (선생)",
        "선생이 직접 문제 카드를 출제 + R2에 이미지 업로드.\n학생별 / 학년별 배포.",
        "• 텍스트 / 이미지 카드\n• 학년 / 단원 분류\n• 학생별 배포",
        "91-gacha-cards.png")
usecase("가챠", "UC-10.3 · 카드 추가 다이얼로그",
        "문제 + 정답 + 분류 입력.\n이미지 카드는 R2 업로드 (5MB, PNG/JPG/WebP).",
        "• 입력 검증\n• R2 이미지 업로드\n• 학생 매핑",
        "92-gacha-card-add.png")
usecase("가챠", "UC-10.4 · 증명 문제 (proof)",
        "수학 증명 문제 출제 + 단계별 채점.\n도형 + 단계별 진행 추적.",
        "• 단계별 증명\n• 도형 첨부\n• 공유 링크",
        "93-gacha-proofs.png")
usecase("가챠", "UC-10.5 · 가챠 대시보드",
        "학생별 카드 컬렉션 진척도 + 정답률 통계.\n선생이 학습 패턴 분석.",
        "• 컬렉션 진척도\n• 정답률 분석\n• 약점 단원 시각화",
        "94-gacha-dashboard.png")

# ─────── 설정 ───────
section("11. 설정", "학원 / 사용자 환경 설정", 1)
usecase("설정", "UC-11.1 · 설정 페이지",
        "학원 정보, 알림톡, 시간대, 사용자 PIN 변경 등.",
        "• 학원 정보 수정\n• PIN 변경\n• 알림톡 설정\n• 데이터 내보내기",
        "A0-settings.png")


prs.save(OUT)
print(f"✅ {OUT}")
print(f"   슬라이드: {len(prs.slides)}장")
