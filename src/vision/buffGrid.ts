import { components, type Rect } from './geometry';
import { digitGroups, digitsToTime, readCornerDigits, type TimeRead } from './glyphs';

export const BUFF_ROW = 3;   // 오른쪽 끝 ">" 화살표 기준으로 위에서 몇 번째 줄을 감시할지
export const MAX_SLOTS = 12; // 한 줄에 들어가는 아이콘 칸 수(넉넉히). 이보다 왼쪽은 게임 화면이라 읽지 않음

// 자동 영역: 버프는 화면 오른쪽 위
export const autoBuffRegion = (W: number, H: number): Rect => { const x = Math.round(W * 0.55); return { x, y: 0, w: W - x, h: Math.round(H * 0.3) }; };

export interface BuffRow extends Rect {
  manual?: boolean;
  pitchX?: number; pitchY?: number; iconRight?: number; bounded?: boolean;
}

// 줄 끝 화살표 탭의 흰색 ">" 꺾쇠를 찾음: 세로로 긴 작은 흰 덩어리가 같은 x에 세로로 늘어선 것
export function findArrows(ctx: CanvasRenderingContext2D, area: Rect): Rect[] {
  const d = ctx.getImageData(area.x, area.y, area.w, area.h).data, mask = new Uint8Array(area.w * area.h);
  for (let i = 0, p = 0; p < mask.length; i += 4, p++) if (d[i] > 170 && d[i + 1] > 185 && d[i + 2] > 195) mask[p] = 1;
  const marks = components(mask, area.w, area.h).filter(c => {
    const w = c.x1 - c.x0 + 1, h = c.y1 - c.y0 + 1, fill = c.n / (w * h);
    return h >= 7 && h <= 30 && w >= 3 && w <= 16 && h >= w * 1.2 && fill >= 0.2 && fill <= 0.75;
  }).map(c => ({ x: area.x + c.x0, y: area.y + c.y0, w: c.x1 - c.x0 + 1, h: c.y1 - c.y0 + 1 }));
  // 화살표는 버프칸 맨 오른쪽에 같은 x, 같은 크기로 정확히 세로로 늘어서 있음.
  // 같은 세로줄(x 차이 2px 이내)·거의 같은 크기로 2개 이상 모인 무리 중 가장 오른쪽 무리를 고름
  // (가장 많이 모인 무리를 고르면 "11" 같은 숫자의 "1" 조각들이 화살표보다 많아서 잘못 고르는 경우 확인)
  let best: Rect[] = [];
  for (const m of marks) {
    const col = marks.filter(o => Math.abs(o.x + o.w / 2 - (m.x + m.w / 2)) <= 2 && Math.abs(o.h - m.h) <= 2 && Math.abs(o.w - m.w) <= 1);
    if (col.length >= 2 && (!best.length || m.x > best[0].x || m.x === best[0].x && col.length > best.length)) best = col;
  }
  return best.length >= 2 ? best.sort((a, b) => a.y - b.y) : [];
}

// 감시할 영역: 직접 지정했으면 그 영역, 아니면 BUFF_ROW번째 화살표 묶음.
// 버프가 많으면 묶음이 화살표 없는 줄로 넘쳐 내려가므로(전체 줄 수가 3~4줄로 바뀜),
// 화살표 줄부터 다음 화살표 직전까지를 한 묶음으로 봄. 다음 화살표가 없으면 최대 2줄 더.
export function locateBuffRow(ctx: CanvasRenderingContext2D, manual: Rect | null): { row: BuffRow | null; arrows: Rect[] } {
  if (manual) return { row: { ...manual, manual: true }, arrows: [] };
  const { width, height } = ctx.canvas;
  const area = autoBuffRegion(width, height), arrows = findArrows(ctx, area);
  const a = arrows[BUFF_ROW - 1];
  if (!a) return { row: null, arrows };
  // 화살표 꺾쇠 높이(기본 화면에서 16px)를 기준으로 줄 위치를 계산: 줄 간격 약 37px
  const half = a.h * 1.15, cy = a.y + a.h / 2;
  const gaps = arrows.slice(1).map((b, i) => b.y - arrows[i].y).filter(g => g > a.h * 1.8);
  const pitchY = gaps.length ? Math.min(...gaps) : half * 2;
  const next = arrows[BUFF_ROW];
  const top = Math.max(0, Math.round(cy - half));
  // 칸 가로 위치는 아이콘 사이 어두운 틈을 실제 화면에서 찾아 맞춤 (기본 화면: 32px 간격)
  const { pitchX, iconRight } = alignSlots(ctx, a, top, pitchY, area.x);
  const bottom = Math.min(height, Math.round(next ? next.y + next.h / 2 - half : cy + half + pitchY * 2));
  const left = Math.max(area.x, Math.round(iconRight - MAX_SLOTS * pitchX));
  return {
    row: { x: left, y: top, w: Math.max(1, iconRight - left), h: Math.max(1, bottom - top), pitchX, pitchY, iconRight, bounded: !!next },
    arrows,
  };
}

// 아이콘 사이 틈(세로로 어두운 선)이 같은 간격으로 늘어선 위치를 찾음.
// iconRight = 마지막 아이콘 오른쪽의 틈, pitchX = 칸 가로 간격. 칸 k는 (iconRight-(k+1)·pitchX, iconRight-k·pitchX)
function alignSlots(ctx: CanvasRenderingContext2D, a: Rect, top: number, pitchY: number, minX: number) {
  const y0 = top + 4, h = Math.max(4, Math.round(pitchY) - 8);
  const x0 = Math.max(minX, Math.round(a.x - a.h * 2.2 * 6)), w = Math.max(1, a.x - x0);
  const d = ctx.getImageData(x0, y0, w, h).data, prof = new Float32Array(w);
  for (let x = 0; x < w; x++) { let s = 0; for (let y = 0; y < h; y++) { const i = (y * w + x) * 4; s += d[i] + d[i + 1] + d[i + 2]; } prof[x] = s / h / 3; }
  const at = (x: number) => { const i = Math.round(x) - x0; return i >= 0 && i < w ? prof[i] : 255; };
  let best = { score: Infinity, pitchX: a.h * 2, iconRight: Math.round(a.x - a.w * 1.3) };
  for (let p = a.h * 1.8; p <= a.h * 2.2; p += 0.25) {
    for (let g = a.x - a.w * 2.5; g <= a.x; g++) {
      let s = 0; for (let k = 0; k < 5; k++) s += Math.min(at(g - k * p), at(g - k * p - 1)); // 틈은 1~2px 폭
      if (s < best.score) best = { score: s, pitchX: p, iconRight: g };
    }
  }
  return best;
}

// 이 줄에 아이콘이 몇 칸 있는지: 아이콘은 오른쪽부터 빈틈없이 붙어 있고 칸마다 왼쪽 경계에 어두운 틈이 있으므로,
// 오른쪽부터 그 틈이 이어지는 데까지만 아이콘으로 봄 (그보다 왼쪽은 게임 화면이라 숫자를 읽지 않음)
export function iconCount(ctx: CanvasRenderingContext2D, row: BuffRow, line: number, cols: number) {
  const y0 = Math.round(row.y + line * row.pitchY! + 4), h = Math.max(4, Math.round(row.pitchY!) - 8);
  if (y0 + h > ctx.canvas.height) return 0;
  const d = ctx.getImageData(row.x, y0, row.w + 2, h).data, W = row.w + 2;
  const col = (x: number) => { // x열의 평균 밝기
    const i0 = Math.round(x) - row.x; if (i0 < 0 || i0 >= W) return 255;
    let s = 0; for (let y = 0; y < h; y++) { const i = (y * W + i0) * 4; s += d[i] + d[i + 1] + d[i + 2]; }
    return s / h / 3;
  };
  let n = 0;
  while (n < cols) {
    const edge = row.iconRight! - (n + 1) * row.pitchX!; // n번째 칸의 왼쪽 경계
    // 경계는 어둡고 바로 오른쪽(아이콘 안)은 밝아야 함. 배경이 통째로 어두운 곳은 밝기 차이가 없어서 걸러짐
    const gap = Math.min(col(edge - 1), col(edge)), inside = Math.max(col(edge + 1), col(edge + 2));
    if (gap > 70 || inside - gap < 40) break;
    n++;
  }
  return n;
}

export interface SlotRead extends TimeRead { text: string; k: number; line: number; box: Rect }
export interface SlotDebug { line: number; k: number; box: Rect; groups: string[]; center: string | null; read: string | null }

// 아이콘 칸(오른쪽 화살표 기준 격자)마다 숫자를 찾아 게임 숫자 모양과 대조
// dbg: 배열을 넘기면 칸마다 무엇을 찾았는지 기록 (진단 저장용)
export function readSlots(ctx: CanvasRenderingContext2D, row: BuffRow, ocrThresh: number, dbg: SlotDebug[] | null = null): SlotRead[] {
  const pitchX = row.pitchX!, pitchY = row.pitchY!, iconRight = row.iconRight!;
  const lines = Math.max(1, Math.round(row.h / pitchY)), cols = Math.min(MAX_SLOTS, Math.floor(row.w / pitchX));
  const out: SlotRead[] = [];
  for (let line = 0; line < lines; line++) for (let k = 0, n = iconCount(ctx, row, line, cols); k < n; k++) {
    const box = { x: Math.round(iconRight - (k + 1) * pitchX), y: Math.round(row.y + line * pitchY), w: Math.round(pitchX), h: Math.round(pitchY) };
    if (box.x < 0 || box.y + box.h > ctx.canvas.height) continue;
    // 오른쪽 아래 작은 숫자는 남은 시간이 아니라(겹친 개수 등) 제외. 칸에 숫자가 여러 개면 가운데 숫자 우선
    const nums = digitGroups(ctx, box, box.h * 0.243, ocrThresh).filter(r => !(r.x > box.w * 0.5 && r.y > box.h * 0.55));
    const center = nums.find(r => r.y <= box.h * 0.55);
    // 가운데 숫자가 없으면 왼쪽 아래 작은 숫자(남은 분). 아이콘 그림과 붙은 글자는 떼어 낸 결과에서 빠지므로
    // ("25"가 "5"로 읽힘) 모양을 직접 대 보는 방식을 먼저 쓰고, 못 찾을 때만 떼어 낸 글자 사용
    let text: string | null | undefined = center ? center.text : readCornerDigits(ctx, box, ocrThresh) || nums.find(r => r.x < box.w * 0.5)?.text;
    // 10분 미만은 가운데 M:SS로 바뀌므로 왼쪽 아래 분 표시는 항상 두 자리 이상. 한 자리만 읽혔다면
    // 아직 모르는 모양의 숫자가 있다는 뜻("24"가 "2"로 읽힘)이라 잘못된 분으로 잡지 않게 버림
    if (!center && text && text.length < 2) text = null;
    dbg?.push({ line, k, box, groups: nums.map(r => `${r.text}@${r.x},${r.y}`), center: center?.text || null, read: text || null });
    if (!text) continue;
    const t = digitsToTime(text, !center);
    if (t.sec > 0) out.push({ text, ...t, k, line, box });
  }
  // 화살표 없는 넘친 줄은 첫 줄이 꽉 찼을 때만 생김. 다음 화살표가 없어 아래를 넉넉히 읽은 경우,
  // 첫 줄 왼쪽 끝 근처 칸까지 숫자가 있지 않으면 아래 줄 숫자는 게임 화면 것으로 보고 버림
  const firstFull = out.some(r => r.line === 0 && r.k >= MAX_SLOTS - 3);
  return out.filter(r => r.line === 0 || row.bounded || firstFull);
}
