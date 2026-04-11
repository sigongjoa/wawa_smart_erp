import { useRef, useEffect } from 'react';

interface ScoreChartProps {
  months: string[];
  subjects: Record<string, (number | null)[]>;
}

const COLORS = ['#e8884a', '#1a73e8', '#2e7d32', '#9c27b0', '#d32f2f', '#00897b'];

function formatMonth(ym: string): string {
  const parts = ym.split('-');
  return `${parseInt(parts[1])}월`;
}

export default function ScoreChart({ months, subjects }: ScoreChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const tooltipRef = useRef<{ x: number; y: number; text: string } | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const W = rect.width;
    const H = rect.height;
    const PAD = { top: 20, right: 20, bottom: 40, left: 40 };
    const chartW = W - PAD.left - PAD.right;
    const chartH = H - PAD.top - PAD.bottom;

    // Clear
    ctx.clearRect(0, 0, W, H);

    // Grid lines & Y labels
    ctx.strokeStyle = '#e0dbd4';
    ctx.lineWidth = 0.5;
    ctx.font = '11px Pretendard, sans-serif';
    ctx.fillStyle = '#7a756e';
    ctx.textAlign = 'right';

    for (let score = 0; score <= 100; score += 20) {
      const y = PAD.top + chartH - (score / 100) * chartH;
      ctx.beginPath();
      ctx.moveTo(PAD.left, y);
      ctx.lineTo(W - PAD.right, y);
      ctx.stroke();
      ctx.fillText(String(score), PAD.left - 6, y + 4);
    }

    // X labels
    ctx.textAlign = 'center';
    const stepX = months.length > 1 ? chartW / (months.length - 1) : chartW / 2;
    months.forEach((m, i) => {
      const x = PAD.left + (months.length > 1 ? i * stepX : chartW / 2);
      ctx.fillText(formatMonth(m), x, H - PAD.bottom + 20);
    });

    // Draw lines per subject
    const subjectNames = Object.keys(subjects);
    subjectNames.forEach((name, si) => {
      const data = subjects[name];
      const color = COLORS[si % COLORS.length];

      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.lineJoin = 'round';
      ctx.beginPath();

      let started = false;
      data.forEach((val, i) => {
        if (val === null) return;
        const x = PAD.left + (months.length > 1 ? i * stepX : chartW / 2);
        const y = PAD.top + chartH - (val / 100) * chartH;
        if (!started) {
          ctx.moveTo(x, y);
          started = true;
        } else {
          ctx.lineTo(x, y);
        }
      });
      ctx.stroke();

      // Data points
      data.forEach((val, i) => {
        if (val === null) return;
        const x = PAD.left + (months.length > 1 ? i * stepX : chartW / 2);
        const y = PAD.top + chartH - (val / 100) * chartH;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(x, y, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.stroke();
      });
    });

    // Legend
    const legendY = H - 10;
    let legendX = PAD.left;
    ctx.font = '11px Pretendard, sans-serif';
    subjectNames.forEach((name, si) => {
      const color = COLORS[si % COLORS.length];
      ctx.fillStyle = color;
      ctx.fillRect(legendX, legendY - 8, 12, 3);
      ctx.fillStyle = '#5c564e';
      ctx.textAlign = 'left';
      ctx.fillText(name, legendX + 16, legendY - 3);
      legendX += ctx.measureText(name).width + 32;
    });
  }, [months, subjects]);

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    const PAD = { top: 20, right: 20, bottom: 40, left: 40 };
    const chartW = rect.width - PAD.left - PAD.right;
    const chartH = rect.height - PAD.top - PAD.bottom;
    const stepX = months.length > 1 ? chartW / (months.length - 1) : chartW / 2;

    let closest: { dist: number; text: string } | null = null;

    Object.entries(subjects).forEach(([name, data]) => {
      data.forEach((val, i) => {
        if (val === null) return;
        const x = PAD.left + (months.length > 1 ? i * stepX : chartW / 2);
        const y = PAD.top + chartH - (val / 100) * chartH;
        const dist = Math.sqrt((mx - x) ** 2 + (my - y) ** 2);
        if (dist < 20 && (!closest || dist < closest.dist)) {
          closest = { dist, text: `${name} ${formatMonth(months[i])}: ${val}점` };
        }
      });
    });

    canvas.title = closest ? closest.text : '';
  };

  return (
    <canvas
      ref={canvasRef}
      className="score-chart-canvas"
      onMouseMove={handleMouseMove}
      style={{ width: '100%', height: 260 }}
    />
  );
}
