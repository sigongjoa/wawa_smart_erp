import { useEffect, useRef, useState } from 'react';
import type { LiveStroke } from '../api';

interface Props {
  width?: number;
  height?: number;
  strokes: LiveStroke[];
  onChange?: (strokes: LiveStroke[]) => void;
  readOnly?: boolean;
  background?: string | null;
  toolbar?: boolean;
}

const COLORS = ['#000000', '#dc2626', '#2563eb', '#16a34a'];

export default function SimpleCanvas({
  width = 800,
  height = 500,
  strokes,
  onChange,
  readOnly = false,
  background,
  toolbar = true,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawingRef = useRef(false);
  const currentStrokeRef = useRef<LiveStroke | null>(null);
  const bgImgRef = useRef<HTMLImageElement | null>(null);

  const [color, setColor] = useState('#000000');
  const [size, setSize] = useState(2);
  const [erasing, setErasing] = useState(false);

  useEffect(() => {
    redraw();
  }, [strokes, background, width, height]);

  useEffect(() => {
    if (!background) {
      bgImgRef.current = null;
      redraw();
      return;
    }
    const img = new Image();
    img.onload = () => { bgImgRef.current = img; redraw(); };
    img.src = background;
  }, [background]);

  function redraw() {
    const cvs = canvasRef.current;
    if (!cvs) return;
    const ctx = cvs.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, cvs.width, cvs.height);
    if (bgImgRef.current) {
      const img = bgImgRef.current;
      const ratio = Math.min(cvs.width / img.width, cvs.height / img.height);
      const w = img.width * ratio;
      const h = img.height * ratio;
      ctx.drawImage(img, (cvs.width - w) / 2, (cvs.height - h) / 2, w, h);
    }
    for (const s of strokes) drawStroke(ctx, s);
  }

  function drawStroke(ctx: CanvasRenderingContext2D, s: LiveStroke) {
    if (!s.points || s.points.length === 0) return;
    ctx.beginPath();
    ctx.strokeStyle = s.color;
    ctx.lineWidth = s.width;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.moveTo(s.points[0][0], s.points[0][1]);
    for (let i = 1; i < s.points.length; i++) ctx.lineTo(s.points[i][0], s.points[i][1]);
    ctx.stroke();
  }

  function getPos(e: React.PointerEvent<HTMLCanvasElement>): [number, number] {
    const cvs = canvasRef.current!;
    const rect = cvs.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * cvs.width;
    const y = ((e.clientY - rect.top) / rect.height) * cvs.height;
    return [Math.round(x), Math.round(y)];
  }

  function onDown(e: React.PointerEvent<HTMLCanvasElement>) {
    if (readOnly) return;
    e.preventDefault();
    canvasRef.current?.setPointerCapture(e.pointerId);
    drawingRef.current = true;
    currentStrokeRef.current = {
      color: erasing ? '#ffffff' : color,
      width: erasing ? 18 : size,
      points: [getPos(e)],
    };
  }
  function onMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current || readOnly) return;
    const p = getPos(e);
    const s = currentStrokeRef.current;
    if (!s) return;
    s.points.push(p);
    const ctx = canvasRef.current?.getContext('2d');
    if (ctx && s.points.length >= 2) {
      ctx.beginPath();
      ctx.strokeStyle = s.color;
      ctx.lineWidth = s.width;
      ctx.lineCap = 'round';
      const a = s.points[s.points.length - 2];
      const b = s.points[s.points.length - 1];
      ctx.moveTo(a[0], a[1]);
      ctx.lineTo(b[0], b[1]);
      ctx.stroke();
    }
  }
  function onUp(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    canvasRef.current?.releasePointerCapture(e.pointerId);
    const s = currentStrokeRef.current;
    currentStrokeRef.current = null;
    if (!s || s.points.length === 0) return;
    onChange && onChange([...strokes, s]);
  }

  function clearAll() { onChange && onChange([]); }
  function undo() { onChange && onChange(strokes.slice(0, -1)); }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {!readOnly && toolbar && (
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
          {COLORS.map((c) => (
            <button
              key={c} type="button"
              onClick={() => { setColor(c); setErasing(false); }}
              style={{
                width: 28, height: 28, borderRadius: '50%',
                background: c,
                border: color === c && !erasing ? '2px solid #f59e0b' : '1px solid #94a3b8',
              }}
            />
          ))}
          <select
            value={size}
            onChange={(e) => { setSize(parseInt(e.target.value, 10)); setErasing(false); }}
            style={{ padding: '4px 6px' }}
          >
            <option value={1}>얇게</option>
            <option value={2}>보통</option>
            <option value={4}>굵게</option>
            <option value={8}>매우</option>
          </select>
          <button
            type="button"
            onClick={() => setErasing((v) => !v)}
            style={{ padding: '4px 8px', background: erasing ? 'var(--warning-surface)' : 'var(--bg-secondary)', border: '1px solid var(--border-primary)', borderRadius: 4 }}
          >지우개</button>
          <button type="button" onClick={undo} style={{ padding: '4px 8px' }}>↶</button>
          <button type="button" onClick={clearAll} style={{ padding: '4px 8px' }}>전체지움</button>
        </div>
      )}
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        style={{
          width: '100%',
          maxWidth: width,
          aspectRatio: `${width}/${height}`,
          background: '#fff',
          border: '1px solid #cbd5e1',
          borderRadius: 6,
          touchAction: 'none',
          cursor: readOnly ? 'default' : (erasing ? 'cell' : 'crosshair'),
        }}
      />
    </div>
  );
}
