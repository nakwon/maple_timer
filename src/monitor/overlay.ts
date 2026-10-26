import type { Config } from '../config';
import { autoBuffRegion, BUFF_ROW } from '../vision/buffGrid';
import type { Rect } from '../vision/geometry';
import { boosterSearchRegion } from '../vision/sevenSeg';
import type { Monitor, SetupMode } from './Monitor';

export interface Drag { x0: number; y0: number; x1: number; y1: number }

export const MODE_TEXT: Record<SetupMode, string> = {
  view: '현재 인식 영역 (보라: 미니맵, 주황: 부스터 타이머, 하늘: 찾은 화살표, 파랑: 감시하는 버프 줄, 초록: 읽은 숫자)',
  booster: '부스터 타이머 숫자를 드래그하세요 (숫자보다 조금 넉넉하게)',
  buffRegion: '감시할 버프 줄(아이콘 한 줄)을 드래그하세요',
};

export function rectFromDrag(d: Drag, still: HTMLCanvasElement): Rect {
  const x = Math.round(Math.max(0, Math.min(d.x0, d.x1))), y = Math.round(Math.max(0, Math.min(d.y0, d.y1)));
  const w = Math.round(Math.min(still.width - x, Math.abs(d.x1 - d.x0))), h = Math.round(Math.min(still.height - y, Math.abs(d.y1 - d.y0)));
  return { x, y, w, h };
}

// 정지 스냅샷 위에 지금 인식 중인 영역들을 그림
export function drawOverlay(overlay: HTMLCanvasElement, m: Monitor, cfg: Config, drag: Drag | null) {
  const octx = overlay.getContext('2d')!, { still, frame, rune, booster, buffs } = m;
  const s = overlay.width / (still.width || 1); // 원본 픽셀 → 표시 픽셀
  octx.drawImage(still, 0, 0, overlay.width, overlay.height);
  const box = (r: Rect | null, color: string, label: string, width = 2) => {
    if (!r) return;
    octx.lineWidth = width; octx.strokeStyle = color; octx.strokeRect(r.x * s, r.y * s, r.w * s, r.h * s);
    if (label) { octx.fillStyle = color; octx.font = 'bold 12px system-ui'; octx.fillText(label, r.x * s + 2, r.y * s - 4 < 10 ? r.y * s + r.h * s + 14 : r.y * s - 4); }
  };
  box(rune.mm, rune.present ? '#e5484d' : '#8e4ec6', rune.present ? '룬 감지!' : '미니맵');
  if (rune.centroid) { octx.strokeStyle = '#e5484d'; octx.lineWidth = 2; octx.beginPath(); octx.arc(rune.centroid[0] * s, rune.centroid[1] * s, 10, 0, 7); octx.stroke(); }
  if (frame.width) {
    for (const a of buffs.arrows) box(a, '#5ac8fa', '', 1.5);
    const row = cfg.buffRegion || buffs.row;
    box(row || autoBuffRegion(frame.width, frame.height), '#2f6fed', cfg.buffRegion ? '감시 줄(직접 지정)' : row ? `감시 줄(${BUFF_ROW}번째 화살표)` : `${BUFF_ROW}번째 화살표를 찾는 범위`, row ? 2 : 1);
    const bb = cfg.boosterBox || booster.box;
    box(bb || boosterSearchRegion(frame.width, frame.height), '#f08c1a', bb ? '부스터 타이머' : '부스터 타이머 찾는 범위', bb ? 2 : 1);
  }
  for (const t of buffs.timers) box(t.box, '#2f9e5b', '', 1.5);
  if (drag) { octx.setLineDash([5, 4]); box(rectFromDrag(drag, still), '#fff', '', 1.5); octx.setLineDash([]); }
}
