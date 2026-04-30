"""스캔 페이지에서 그림 영역을 자동 검출 — OpenCV 기반.

전략:
1. 그레이스케일 변환 → 텍스트는 작고 균일한 stroke, 그림은 큰 채도 영역
2. 채도(saturation) 평균이 낮은 행/열을 텍스트로 가정, 채도 큰 박스를 후보로
3. 작은 박스 병합 후 면적·종횡비 임계값으로 필터

수동 좌표(crop_figures.py)에 비해:
- (+) 페이지 추가 시 자동 동작
- (-) 텍스트가 컬러 강조된 페이지에서 false positive 가능 → 임계값 튜닝 필요
"""
import cv2
import numpy as np
from pathlib import Path
from dataclasses import dataclass


@dataclass
class FigureBox:
    page: int
    x: int
    y: int
    w: int
    h: int
    area_ratio: float  # 페이지 대비 박스 면적 비율


def detect_figures(image_path: Path, *,
                   min_area_ratio: float = 0.04,   # 페이지의 4% 이상
                   max_area_ratio: float = 0.65,   # 페이지의 65% 미만 (전체 page 제외)
                   sat_threshold: int = 25,        # 채도 임계
                   dilate_iter: int = 8) -> list[FigureBox]:
    """단일 페이지 이미지에서 그림 박스 후보 반환."""
    img = cv2.imread(str(image_path))
    if img is None:
        return []
    h, w = img.shape[:2]
    page_area = h * w

    # HSV 변환 — saturation으로 컬러 그림 검출
    hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
    sat = hsv[:, :, 1]

    # 임계 처리 후 dilation으로 인접 영역 병합
    _, mask = cv2.threshold(sat, sat_threshold, 255, cv2.THRESH_BINARY)
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (15, 15))
    mask = cv2.dilate(mask, kernel, iterations=dilate_iter)

    contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    boxes: list[FigureBox] = []
    page_no = int(image_path.stem.split('_')[-1]) if '_' in image_path.stem else 0
    for c in contours:
        x, y, bw, bh = cv2.boundingRect(c)
        area = bw * bh
        ratio = area / page_area
        if not (min_area_ratio <= ratio <= max_area_ratio):
            continue
        # 너무 가늘고 긴 영역(헤더 라인 등) 제외
        if bw < 100 or bh < 100:
            continue
        if max(bw, bh) / max(min(bw, bh), 1) > 8:
            continue
        boxes.append(FigureBox(page_no, x, y, bw, bh, ratio))

    # 면적 큰 순으로 정렬, 상위 3개만 (페이지당 그림 ≤ 3 가정)
    boxes.sort(key=lambda b: -b.area_ratio)
    return boxes[:3]


def crop_and_save(image_path: Path, box: FigureBox, out_path: Path,
                  pad: int = 12) -> None:
    img = cv2.imread(str(image_path))
    h, w = img.shape[:2]
    x1 = max(0, box.x - pad)
    y1 = max(0, box.y - pad)
    x2 = min(w, box.x + box.w + pad)
    y2 = min(h, box.y + box.h + pad)
    crop = img[y1:y2, x1:x2]
    cv2.imwrite(str(out_path), crop, [cv2.IMWRITE_JPEG_QUALITY, 92])


def process_pages(raw_dir: Path, out_dir: Path,
                  page_range: tuple[int, int]) -> dict[int, list[FigureBox]]:
    """raw_dir/page_NNN.jpg 들에서 그림 검출·크롭 → out_dir."""
    out_dir.mkdir(exist_ok=True)
    results: dict[int, list[FigureBox]] = {}
    for n in range(page_range[0], page_range[1] + 1):
        src = raw_dir / f'page_{n:03d}.jpg'
        if not src.exists():
            continue
        try:
            boxes = detect_figures(src)
        except Exception as e:
            print(f'  [skip] page {n}: {e}')
            continue
        results[n] = boxes
        for i, box in enumerate(boxes, 1):
            dest = out_dir / f'page_{n:03d}_auto_{i}.jpg'
            crop_and_save(src, box, dest)
            print(f'  detected page {n} fig{i}: {box.w}x{box.h} '
                  f'({box.area_ratio*100:.1f}%) → {dest.name}')
    return results


if __name__ == '__main__':
    import sys
    root = Path('/mnt/g/vine_academy/wawa_smart_erp/medterm_preprocess')
    args = sys.argv[1:]
    start = int(args[0]) if args else 1
    end = int(args[1]) if len(args) > 1 else 20
    print(f'auto-detect figures in pages {start}~{end}')
    process_pages(root / 'raw', root / 'images_auto', (start, end))
    print('done')
