import { useCallback, useEffect, useLayoutEffect, useRef, type PointerEvent } from 'react';
import { configStore } from '../config';
import { useMonitor } from '../hooks';
import { drawOverlay, MODE_TEXT, rectFromDrag, type Drag } from '../monitor/overlay';

// 영역 지정 창: 정지 스냅샷 위에서 드래그로 영역을 고름
export function SetupOverlay() {
  const m = useMonitor(), { mode, still, stillVersion } = m;
  const canvasRef = useRef<HTMLCanvasElement>(null), scrollRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<Drag | null>(null);

  const draw = useCallback(() => {
    if (canvasRef.current && m.mode) drawOverlay(canvasRef.current, m, configStore.get(), dragRef.current);
  }, [m]);

  // 스냅샷을 창 폭에 맞춰 표시 (작은 아이콘을 잡기 쉽도록 원본보다 크게 늘리지는 않음)
  const fit = useCallback(() => {
    const c = canvasRef.current, box = scrollRef.current;
    if (!c || !box || !m.mode || !still.width) return;
    const scale = Math.min(1, box.clientWidth / still.width);
    c.width = Math.round(still.width * scale); c.height = Math.round(still.height * scale);
    draw();
  }, [m, still, draw]);

  useLayoutEffect(() => { dragRef.current = null; }, [mode]);
  useLayoutEffect(() => { fit(); }, [fit, mode, stillVersion]);
  useLayoutEffect(() => { draw(); }); // 감시 루프가 돌 때마다 다시 그림
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') m.closeSetup(); };
    document.addEventListener('keydown', onKey);
    window.addEventListener('resize', fit);
    return () => { document.removeEventListener('keydown', onKey); window.removeEventListener('resize', fit); };
  }, [m, fit]);

  const toVideo = (e: PointerEvent<HTMLCanvasElement>) => {
    const c = e.currentTarget, b = c.getBoundingClientRect(), k = c.width / (still.width || 1);
    return [(e.clientX - b.left) / k, (e.clientY - b.top) / k];
  };
  const onPointerDown = (e: PointerEvent<HTMLCanvasElement>) => {
    if (!mode || mode === 'view') return;
    const [x, y] = toVideo(e);
    dragRef.current = { x0: x, y0: y, x1: x, y1: y }; e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: PointerEvent<HTMLCanvasElement>) => {
    const d = dragRef.current; if (!d) return;
    [d.x1, d.y1] = toVideo(e); draw();
  };
  const onPointerUp = () => {
    const d = dragRef.current;
    if (!d || !mode) return;
    const r = rectFromDrag(d, still); dragRef.current = null;
    if (r.w < 6 || r.h < 6) { draw(); return; }
    if (mode === 'booster') m.setBoosterBox(r);
    else if (mode === 'buffRegion') m.setBuffRegion(r);
    m.closeSetup();
  };

  return (
    <div id="setup" hidden={!mode}>
      <div className="setup-head">
        <span id="banner">{mode ? MODE_TEXT[mode] : ''}</span>
        <button className="btn" onClick={() => m.snapshot()}>다시 찍기</button>
        <button className="btn" onClick={m.closeSetup}>닫기 (Esc)</button>
      </div>
      <div className="setup-scroll" ref={scrollRef}>
        <canvas id="overlay" ref={canvasRef} className={mode && mode !== 'view' ? 'picking' : undefined}
          onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} />
      </div>
    </div>
  );
}
