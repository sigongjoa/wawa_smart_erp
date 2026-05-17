/**
 * AI figure step (points-2d) SVG 렌더러.
 * - eval 없음, 외부 lib 0
 * - 자동 axis (xs/ys 범위 + 5% padding)
 * - 0 축 표시, 라벨 옵션, marker 점
 */
interface Marker { x: number; y: number; label?: string }

export interface Points2DSpec {
  xs: number[];
  ys: number[];
  xlabel?: string;
  ylabel?: string;
  markers?: Marker[];
}

interface Props {
  spec: Points2DSpec;
  caption?: string;
  width?: number;   // viewBox 기준
  height?: number;
}

export function Points2DChart({ spec, caption, width = 320, height = 220 }: Props) {
  const { xs, ys, xlabel, ylabel, markers = [] } = spec;
  if (xs.length < 2 || xs.length !== ys.length) {
    return <div className="points2d-error">그림 데이터 형식 오류</div>;
  }

  const PAD_L = 36, PAD_R = 12, PAD_T = 12, PAD_B = 28;
  const plotW = width - PAD_L - PAD_R;
  const plotH = height - PAD_T - PAD_B;

  // 모든 점 (markers 포함) 으로 범위 계산
  const allX = [...xs, ...markers.map((m) => m.x)];
  const allY = [...ys, ...markers.map((m) => m.y)];
  const xMin = Math.min(...allX), xMax = Math.max(...allX);
  const yMin = Math.min(...allY), yMax = Math.max(...allY);
  const xPad = (xMax - xMin) * 0.05 || 0.5;
  const yPad = (yMax - yMin) * 0.05 || 0.5;
  const xLo = xMin - xPad, xHi = xMax + xPad;
  const yLo = yMin - yPad, yHi = yMax + yPad;

  const sx = (x: number) => PAD_L + ((x - xLo) / (xHi - xLo)) * plotW;
  const sy = (y: number) => PAD_T + (1 - (y - yLo) / (yHi - yLo)) * plotH;

  const path = xs.map((x, i) => `${i === 0 ? 'M' : 'L'} ${sx(x).toFixed(2)} ${sy(ys[i]).toFixed(2)}`).join(' ');

  // 0축 표시 (있으면)
  const showXAxis = yLo <= 0 && yHi >= 0;
  const showYAxis = xLo <= 0 && xHi >= 0;

  // 눈금: 5등분
  const xTicks = Array.from({ length: 5 }, (_, i) => xLo + ((xHi - xLo) * i) / 4);
  const yTicks = Array.from({ length: 5 }, (_, i) => yLo + ((yHi - yLo) * i) / 4);
  const fmt = (n: number) => {
    if (Math.abs(n) >= 100) return n.toFixed(0);
    if (Math.abs(n) >= 10) return n.toFixed(1);
    return n.toFixed(2);
  };

  return (
    <figure className="points2d">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={caption || '그래프'}
        style={{ width: '100%', height: 'auto', display: 'block' }}
      >
        {/* plot 배경 */}
        <rect x={PAD_L} y={PAD_T} width={plotW} height={plotH} fill="#FAFAFA" stroke="#E5E5E5" />

        {/* y 눈금 + 가로 격자 */}
        {yTicks.map((t, i) => (
          <g key={`yt-${i}`}>
            <line x1={PAD_L} y1={sy(t)} x2={PAD_L + plotW} y2={sy(t)} stroke="#EEE" strokeDasharray="2 2" />
            <text x={PAD_L - 4} y={sy(t) + 3} fontSize="9" fill="#666" textAnchor="end">{fmt(t)}</text>
          </g>
        ))}

        {/* x 눈금 */}
        {xTicks.map((t, i) => (
          <g key={`xt-${i}`}>
            <line x1={sx(t)} y1={PAD_T + plotH} x2={sx(t)} y2={PAD_T + plotH + 3} stroke="#666" />
            <text x={sx(t)} y={PAD_T + plotH + 13} fontSize="9" fill="#666" textAnchor="middle">{fmt(t)}</text>
          </g>
        ))}

        {/* 0축 */}
        {showXAxis && <line x1={PAD_L} y1={sy(0)} x2={PAD_L + plotW} y2={sy(0)} stroke="#999" strokeWidth="1" />}
        {showYAxis && <line x1={sx(0)} y1={PAD_T} x2={sx(0)} y2={PAD_T + plotH} stroke="#999" strokeWidth="1" />}

        {/* 곡선 */}
        <path d={path} fill="none" stroke="#3FA129" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />

        {/* markers */}
        {markers.map((m, i) => (
          <g key={`m-${i}`}>
            <circle cx={sx(m.x)} cy={sy(m.y)} r="4" fill="#E62829" />
            {m.label && (
              <text x={sx(m.x) + 6} y={sy(m.y) - 4} fontSize="10" fill="#E62829" fontWeight="700">{m.label}</text>
            )}
          </g>
        ))}

        {/* 축 라벨 */}
        {xlabel && (
          <text x={PAD_L + plotW / 2} y={height - 4} fontSize="10" fill="#333" textAnchor="middle">{xlabel}</text>
        )}
        {ylabel && (
          <text
            x={10}
            y={PAD_T + plotH / 2}
            fontSize="10"
            fill="#333"
            textAnchor="middle"
            transform={`rotate(-90 10 ${PAD_T + plotH / 2})`}
          >
            {ylabel}
          </text>
        )}
      </svg>
      {caption && <figcaption className="points2d-caption">{caption}</figcaption>}
    </figure>
  );
}
