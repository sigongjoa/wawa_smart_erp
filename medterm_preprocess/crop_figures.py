"""1-20 페이지에서 그림 영역을 비율 좌표로 크롭."""
from PIL import Image
from pathlib import Path

RAW = Path('/mnt/g/vine_academy/wawa_smart_erp/medterm_preprocess/raw')
OUT = Path('/mnt/g/vine_academy/wawa_smart_erp/medterm_preprocess/images')
OUT.mkdir(exist_ok=True)

# (page_num, fig_id, caption, ratio_box=(x1,y1,x2,y2) in 0~1)
FIGS = [
    (8,  'fig_1-1', '조합어/비조합어 일러스트 (4명이 박스·삼각형·공·원기둥을 들고 있는 그림)',
     (0.27, 0.46, 0.83, 0.74)),
    (10, 'fig_1-2', 'construction 분해 다이어그램 (con + struct + ion)',
     (0.27, 0.33, 0.92, 0.45)),
    (12, 'fig_1-3', '인체 해부도 — 결합형 라벨 (Encephal/o, Ocul/o, Ot/o, Trache/o, Bronch/o, Angi/o, Cardi/o, Gastr/o, Muscul/o, Oste/o)',
     (0.22, 0.04, 0.92, 0.72)),
    (20, 'fig_1-4', '히포크라테스 흉상 (그리스 의학의 아버지)',
     (0.25, 0.18, 0.65, 0.55)),
]

for page_num, fig_id, _caption, (x1r, y1r, x2r, y2r) in FIGS:
    src = RAW / f'page_{page_num:03d}.jpg'
    img = Image.open(src)
    w, h = img.size
    box = (int(w*x1r), int(h*y1r), int(w*x2r), int(h*y2r))
    crop = img.crop(box)
    dest = OUT / f'page_{page_num:03d}_{fig_id}.jpg'
    crop.save(dest, quality=92)
    print(f'  saved {dest.name} {crop.size}')

print('done')
