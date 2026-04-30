"""기초 의학용어 Ch.01 30문제 PDF 빌드 (문제지 + 해설지)."""
import json
from pathlib import Path
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.lib.colors import HexColor, black, grey
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, PageBreak, KeepTogether,
    Table, TableStyle, Image
)

ROOT = Path('/mnt/g/vine_academy/wawa_smart_erp/medterm_preprocess')
OUT = ROOT / 'output'

FONT_PATHS = {
    'Nanum':  '/usr/share/fonts/truetype/nanum/NanumGothic.ttf',
    'NanumB': '/usr/share/fonts/truetype/nanum/NanumGothicBold.ttf',
    'NanumM': '/usr/share/fonts/truetype/nanum/NanumGothicCoding.ttf',
}

_fonts_registered = False
def register_fonts():
    global _fonts_registered
    if _fonts_registered:
        return
    for name, path in FONT_PATHS.items():
        if not Path(path).exists():
            raise FileNotFoundError(f'폰트 파일 없음: {path}')
        pdfmetrics.registerFont(TTFont(name, path))
    _fonts_registered = True

C_PRIMARY = HexColor('#8B0000')   # deep red
C_ACCENT = HexColor('#1565C0')    # blue
C_BG = HexColor('#F5F5F5')
C_BORDER = HexColor('#CCCCCC')

def style(name, size=10, font='Nanum', leading=None, **kw):
    return ParagraphStyle(name, fontName=font, fontSize=size,
                          leading=leading or size*1.4, **kw)

ST = {
    'title': style('title', 22, 'NanumB', textColor=C_PRIMARY, alignment=1, spaceAfter=4),
    'subtitle': style('subtitle', 11, 'Nanum', textColor=grey, alignment=1, spaceAfter=14),
    'meta': style('meta', 9, 'Nanum', textColor=grey, alignment=1, spaceAfter=20),
    'qhead': style('qhead', 11, 'NanumB', textColor=C_PRIMARY, spaceBefore=14, spaceAfter=5),
    'qbody': style('qbody', 10.5, 'Nanum', leading=16, spaceAfter=4),
    'choice': style('choice', 10, 'Nanum', leading=15, leftIndent=14, spaceAfter=2),
    'answer': style('answer', 10, 'NanumB', textColor=C_ACCENT, leading=15, spaceAfter=2, leftIndent=8),
    'explain': style('explain', 9.5, 'Nanum', textColor=HexColor('#444'), leading=14, leftIndent=8, spaceAfter=6),
    'tag': style('tag', 8.5, 'Nanum', textColor=HexColor('#666')),
    'small': style('small', 9, 'Nanum', leading=13),
    'section': style('section', 13, 'NanumB', textColor=C_PRIMARY, spaceBefore=12, spaceAfter=8),
}

def esc(s):
    # & 를 먼저 변환하지만, 이미 인코딩된 &nbsp;/&amp; 는 보존하기 위해
    # 호출 측은 esc 통과 후 텍스트만 넣고, 마크업은 직접 조립한다.
    return (str(s)
            .replace('&', '&amp;')
            .replace('<', '&lt;')
            .replace('>', '&gt;')
            .replace('\n', '<br/>'))

def render_question(q, with_answer=False, hide_meta_in_student=True):
    flow = []
    # 학생용 문제지에서는 topic·난이도 숨김 (학습 동기 보호)
    if with_answer or not hide_meta_in_student:
        meta = f"<font color='#666' size='8.5'>[{q['type']} · {q['topic']} · 난이도 {q['difficulty']}]</font>"
    else:
        meta = f"<font color='#666' size='8.5'>[{q['type']}]</font>"
    head = f"<b>문제 {q['no']}.</b> &nbsp;{meta}"
    flow.append(Paragraph(head, ST['qhead']))
    flow.append(Paragraph(esc(q['question']), ST['qbody']))

    # 객관식
    if 'choices' in q:
        for i, c in enumerate(q['choices']):
            flow.append(Paragraph(f"&nbsp;&nbsp;<b>{chr(0x2460+i)}</b> &nbsp;{esc(c)}", ST['choice']))

    # 매칭: items / options
    if q['type'] == '매칭':
        items = q.get('items', {})
        options = q.get('options', {})
        # 두 컬럼 표 — 좌측 ①②③, 우측 Ⓐ Ⓑ Ⓒ
        rows = []
        keys_l = list(items.keys())
        keys_r = list(options.keys())
        max_n = max(len(keys_l), len(keys_r))
        for i in range(max_n):
            if i < len(keys_l):
                l_html = f"{chr(0x2460 + i)}&nbsp;&nbsp;{esc(items[keys_l[i]])}"
            else:
                l_html = ''
            if i < len(keys_r):
                r_html = f"{chr(0x24B6 + i)}&nbsp;&nbsp;{esc(options[keys_r[i]])}"
            else:
                r_html = ''
            rows.append([Paragraph(l_html, ST['small']), Paragraph(r_html, ST['small'])])
        t = Table(rows, colWidths=[80*mm, 80*mm])
        t.setStyle(TableStyle([
            ('FONTNAME', (0,0), (-1,-1), 'Nanum'),
            ('VALIGN', (0,0), (-1,-1), 'TOP'),
            ('BOX', (0,0), (-1,-1), 0.5, C_BORDER),
            ('INNERGRID', (0,0), (-1,-1), 0.3, C_BORDER),
            ('LEFTPADDING', (0,0), (-1,-1), 6),
            ('RIGHTPADDING', (0,0), (-1,-1), 6),
            ('TOPPADDING', (0,0), (-1,-1), 4),
            ('BOTTOMPADDING', (0,0), (-1,-1), 4),
            ('BACKGROUND', (0,0), (-1,0), C_BG),
        ]))
        flow.append(t)
        flow.append(Spacer(1, 4))

    # 답란 (문제지 only)
    if not with_answer:
        if q['type'] == '용어분해':
            # 책 18쪽 가이드: p=접두사, r=어근, cv=결합모음, s=접미사
            flow.append(Paragraph(
                "답:  ______ / ______ / ______ / ______ / ______",
                ST['small']))
            flow.append(Paragraph(
                "<font size='8.5' color='#666'>"
                "&nbsp;&nbsp;&nbsp;&nbsp;(p=접두사, r=어근, cv=결합모음, s=접미사 — 해당 없는 칸은 비워 두세요)"
                "</font>",
                ST['small']))
        elif q['type'] == '단답형':
            flow.append(Paragraph("답: ____________________________________________________", ST['small']))
        elif q['type'] == '빈칸':
            # 본문에 ①, ② 가 이미 등장하므로 답란은 (1), (2) 표기로 차별화
            flow.append(Paragraph(
                "답:&nbsp;&nbsp; (1) ______________________&nbsp;&nbsp;&nbsp; (2) ______________________",
                ST['small']))
        elif q['type'] == 'OX':
            flow.append(Paragraph("답:  □ O&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;□ X&nbsp;&nbsp;&nbsp;<font size='8.5' color='#666'>(해당 칸 안에 ● 표시)</font>", ST['small']))
        elif q['type'] == '매칭':
            n_items = len(q.get('items', {}))
            slots = '  '.join(f"{chr(0x2460+i)} → (   )" for i in range(n_items))
            flow.append(Paragraph(f"답:  {slots}", ST['small']))
        elif q['type'] == '객관식':
            flow.append(Paragraph("답: (   )", ST['small']))

    # 해설지: 정답 + 해설
    if with_answer:
        ans = q.get('answer')
        if q['type'] == '매칭' and isinstance(ans, dict):
            keys_l = list(q.get('items', {}).keys())
            keys_r = list(q.get('options', {}).keys())
            parts_str = []
            for i, lk in enumerate(keys_l):
                rk = ans.get(lk)
                if rk and rk in keys_r:
                    j = keys_r.index(rk)
                    parts_str.append(f"{chr(0x2460+i)} → {chr(0x24B6+j)}")
            # 정답 출력 — esc() 통과 후에도 깨지지 않도록 일반 텍스트로
            flow.append(Paragraph(
                f"<b>정답:</b> &nbsp;" + " &nbsp; ".join(parts_str),
                ST['answer']
            ))
            # 해설은 일반 흐름으로
            if 'explanation' in q:
                flow.append(Paragraph(f"<b>해설:</b> {esc(q['explanation'])}", ST['explain']))
            flow.append(Spacer(1, 4))
            return KeepTogether(flow)
        elif isinstance(ans, dict):
            ans_str = ', '.join(f"{k}={v}" for k, v in ans.items())
        elif q['type'] == '객관식' and isinstance(ans, str) and len(ans) == 1 and ans in 'ABCDE':
            idx = 'ABCDE'.index(ans)
            ans_str = f"{chr(0x2460+idx)} ({q['choices'][idx]})"
        else:
            ans_str = str(ans)
        flow.append(Paragraph(f"<b>정답:</b> {esc(ans_str)}", ST['answer']))

        if 'parts' in q:
            tokens = []
            for part in q['parts']:
                role = part['role']
                val = part['value']
                meaning = part.get('meaning')
                tag = f"<font color='#888' size='8.5'>[{role}]</font>"
                tok = f"<b>{esc(val)}</b>{tag}"
                if meaning:
                    tok += f" <font color='#666' size='9'>({esc(meaning)})</font>"
                tokens.append(tok)
            struct_str = ' &nbsp;/&nbsp; '.join(tokens)
            flow.append(Paragraph(f"<b>구조:</b> {struct_str}", ST['explain']))

        if 'explanation' in q:
            flow.append(Paragraph(f"<b>해설:</b> {esc(q['explanation'])}", ST['explain']))

    flow.append(Spacer(1, 4))
    return KeepTogether(flow)

def make_header_footer(footer_text):
    def _draw(canvas, doc):
        canvas.saveState()
        canvas.setFont('Nanum', 8.5)
        canvas.setFillColor(HexColor('#555555'))
        canvas.drawString(20*mm, 10*mm, footer_text)
        canvas.drawRightString(A4[0] - 20*mm, 10*mm, f'페이지 {doc.page}')
        canvas.setStrokeColor(C_BORDER)
        canvas.line(20*mm, 12*mm, A4[0]-20*mm, 12*mm)
        canvas.restoreState()
    return _draw

def build_pdf(json_path, out_path, *, title, subtitle, with_answer,
              footer_text=None, range_label=None):
    register_fonts()
    data = json.load(open(json_path, encoding='utf-8'))
    if footer_text is None:
        footer_text = data.get('source', {}).get('title', title)
    doc = SimpleDocTemplate(
        str(out_path), pagesize=A4,
        leftMargin=20*mm, rightMargin=20*mm,
        topMargin=18*mm, bottomMargin=18*mm,
        title=title, author='WAWA Academy'
    )
    flow = [
        Paragraph(title, ST['title']),
        Paragraph(subtitle, ST['subtitle']),
    ]
    # 학생용 문제지: 메타 줄 단순화 (총 문항 수 + 범위만), 강사용은 풀 메타
    if with_answer:
        flow.append(Paragraph(
            f"총 {data['source']['total']}문항 &nbsp;|&nbsp; "
            f"{' · '.join(data['source']['types'])} {len(data['source']['types'])}유형"
            + (f" &nbsp;|&nbsp; 출제 범위: {range_label}" if range_label else ""),
            ST['meta']
        ))
    else:
        flow.append(Paragraph(
            f"총 {data['source']['total']}문항"
            + (f" &nbsp;|&nbsp; 출제 범위: {range_label}" if range_label else ""),
            ST['meta']
        ))

    # 학습자 정보 (문제지만)
    if not with_answer:
        info = Table(
            [[
                Paragraph("이름", ST['small']),
                Paragraph("__________________", ST['small']),
                Paragraph("학번/반", ST['small']),
                Paragraph("__________________", ST['small']),
                Paragraph("점수", ST['small']),
                Paragraph("____ / 30", ST['small']),
            ]],
            colWidths=[15*mm, 35*mm, 20*mm, 35*mm, 15*mm, 30*mm]
        )
        info.setStyle(TableStyle([
            ('FONTNAME', (0,0), (-1,-1), 'Nanum'),
            ('FONTSIZE', (0,0), (-1,-1), 9.5),
            ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
            ('BOX', (0,0), (-1,-1), 0.6, black),
            ('INNERGRID', (0,0), (-1,-1), 0.3, C_BORDER),
            ('BACKGROUND', (0,0), (0,0), C_BG),
            ('BACKGROUND', (2,0), (2,0), C_BG),
            ('BACKGROUND', (4,0), (4,0), C_BG),
            ('TOPPADDING', (0,0), (-1,-1), 6),
            ('BOTTOMPADDING', (0,0), (-1,-1), 6),
        ]))
        flow.append(info)
        flow.append(Spacer(1, 14))
        # 응시 안내
        flow.append(Paragraph("■ 응시 안내", ST['section']))
        flow.append(Paragraph(
            "• 각 문제 아래의 답란에 직접 기재합니다.<br/>"
            "• <b>객관식</b>은 보기 번호(①②③④)를, <b>매칭</b>은 ① → Ⓐ 형식으로 답하세요.<br/>"
            "• <b>용어분해</b>는 단어 요소를 ' / ' 로 구분하여 적습니다 — 책 18쪽의 p / r / cv / s 표기 참고.<br/>"
            "• <b>OX</b>는 해당 칸(□) 안에 ●로 표시합니다.",
            ST['small']
        ))
        flow.append(Spacer(1, 14))
        flow.append(PageBreak())

    for q in data['questions']:
        flow.append(render_question(q, with_answer=with_answer))

    drawer = make_header_footer(footer_text)
    doc.build(flow, onFirstPage=drawer, onLaterPages=drawer)
    print(f'  saved {Path(out_path).name}')


if __name__ == '__main__':
    json_path = OUT / 'exam_30q.json'
    build_pdf(
        json_path, OUT / '의학용어_Ch01_문제지.pdf',
        title='기초 의학용어 Chapter 01',
        subtitle='— 단어의 요소와 단어 구성의 이해 · 단원평가 30문항 (문제지) —',
        with_answer=False,
        footer_text='기초 의학용어 Ch.01 — 단어의 요소와 단어 구성의 이해',
        range_label='책 p.1~15 (스캔 1~20페이지)',
    )
    build_pdf(
        json_path, OUT / '의학용어_Ch01_정답해설.pdf',
        title='기초 의학용어 Chapter 01',
        subtitle='— 단어의 요소와 단어 구성의 이해 · 단원평가 30문항 (정답·해설) —',
        with_answer=True,
        footer_text='기초 의학용어 Ch.01 — 정답·해설',
        range_label='책 p.1~15 (스캔 1~20페이지)',
    )
    print('done')
