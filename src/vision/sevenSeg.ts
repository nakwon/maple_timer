import { components, type Rect } from './geometry';

// ---------- 부스터: 화면 위쪽 가운데 "남은시간 92.79 초" 타이머 ----------
// 숫자가 7개의 막대(세그먼트)로 그려지는 전광판 글꼴이라, 막대 위치마다 켜졌는지만 보면 숫자를 정확히 알 수 있음
//   막대 순서: 위, 왼쪽위, 오른쪽위, 가운데, 왼쪽아래, 오른쪽아래, 아래 (1 = 켜짐)
const SEVEN_SEG: Record<string, number> = { '1110111': 0, '0010010': 1, '1011101': 2, '1011011': 3, '0111010': 4, '1101011': 5, '1101111': 6, '1010010': 7, '1111111': 8, '1111011': 9, '1110010': 7 };
// 타이머 숫자 색: 진한 노랑~주황(빨강 200 이상, 파랑 < 빨강). 겹쳐 지나가는 퀘스트 알림 글자(빨강 160~185)는 빠짐
const isDigitPx = (d: Uint8ClampedArray, i: number) => d[i] >= 200 && d[i + 1] > 110 && d[i + 2] < d[i];

// 부스터 타이머를 찾는 범위: 화면 위쪽 가운데
export const boosterSearchRegion = (W: number, H: number): Rect => ({ x: Math.round(W * 0.25), y: 0, w: Math.round(W * 0.5), h: Math.round(H * 0.3) });

// 영역 안 타이머 숫자 색 픽셀 수 (숫자를 못 읽어도 타이머가 아직 화면에 있는지 확인용)
export function digitPixels(ctx: CanvasRenderingContext2D, b: Rect) {
  const d = ctx.getImageData(b.x, b.y, b.w, b.h).data; let n = 0;
  for (let i = 0; i < d.length; i += 4) if (isDigitPx(d, i)) n++;
  return n;
}

export interface SevenSegRead { sec: number; text: string; box: Rect }

// 영역 r에서 노랑·주황 막대들을 찾아 "92.79" 같은 숫자로 읽음 → { sec, text, box } 또는 null
export function readSevenSeg(ctx: CanvasRenderingContext2D, r: Rect): SevenSegRead | null {
  const d = ctx.getImageData(r.x, r.y, r.w, r.h).data, m = new Uint8Array(r.w * r.h);
  for (let i = 0, p = 0; p < m.length; i += 4, p++) if (isDigitPx(d, i)) m[p] = 1;
  const parts = components(m, r.w, r.h).filter(c => c.n >= 4).map(c => ({ x: c.x0, y: c.y0, w: c.x1 - c.x0 + 1, h: c.y1 - c.y0 + 1 }));
  // 가늘고 긴 세로 막대 = 숫자의 세로 획 후보
  const vbars = parts.filter(c => c.w >= 2 && c.w <= 7 && c.h >= 8 && c.h <= 60 && c.h >= c.w * 2.5);
  if (vbars.length < 2) return null;
  // 7세그먼트는 모든 숫자의 위쪽 세로 획이 같은 줄에서 시작함 → 윗끝이 맞는 세로 획이 가장 많은 무리 = 타이머 숫자 줄
  // (위·아래 세로 획이 둘 다 켜지면 한 덩어리로 붙어 길이가 2배가 되지만 윗끝은 같음)
  let group: Rect[] = [];
  for (const v of vbars) {
    const g = vbars.filter(o => Math.abs(o.y - v.y) <= 2 && Math.abs(o.x - v.x) <= 150);
    if (g.length > group.length) group = g;
  }
  if (group.length < 2) return null;
  const minH = Math.min(...group.map(v => v.h)), seg = minH > 20 ? minH / 2 : minH; // 세로 획 하나 ≈ 숫자 높이의 절반
  if (seg < 7) return null; // 버프 아이콘 위 작은 숫자 등은 타이머가 아님
  const top = Math.min(...group.map(v => v.y));
  const gx0 = Math.min(...group.map(v => v.x)) - seg * 2, gx1 = Math.max(...group.map(v => v.x + v.w)) + seg * 2;
  const gy0 = top - seg * 0.5, gy1 = top + seg * 2.5;
  const band = parts.filter(c => c.x >= gx0 && c.x + c.w <= gx1 && c.y >= gy0 && c.y + c.h <= gy1);
  const bars = band.filter(c => Math.max(c.w, c.h) >= seg * 0.6);
  if (!bars.length) return null;
  const Y0 = Math.min(...bars.map(b => b.y)), Y1 = Math.max(...bars.map(b => b.y + b.h - 1)), h = Y1 - Y0;
  if (h < seg * 1.6) return null; // 위아래 획이 다 있는 높이가 아니면 숫자 줄이 아님
  // 막대들을 가로로 겹치는 것끼리 묶어 숫자 한 칸씩
  const cells: { x0: number; x1: number }[] = [];
  for (const b of bars.slice().sort((a, c) => a.x - c.x)) {
    const last = cells[cells.length - 1];
    if (last && b.x <= last.x1 + 1) last.x1 = Math.max(last.x1, b.x + b.w - 1); else cells.push({ x0: b.x, x1: b.x + b.w - 1 });
  }
  const W = Math.max(...cells.map(c => c.x1 - c.x0 + 1));
  if (W < h * 0.35) return null;
  const lit = (x: number, y: number) => { for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const xx = Math.round(x + dx), yy = Math.round(y + dy); if (xx >= 0 && yy >= 0 && xx < r.w && yy < r.h && m[yy * r.w + xx]) return 1; } return 0; };
  // 소수점: 숫자 아래쪽에 있는 작은 네모
  const dots = band.filter(c => Math.max(c.w, c.h) < seg * 0.6 && c.w >= 2 && c.h >= 2 && c.y > Y0 + h * 0.7);
  let text = '';
  for (const c of cells) {
    if (dots.some(dt => dt.x + dt.w <= c.x0 && !text.includes('.') && text)) text += '.';
    const x1 = c.x1, x0 = x1 - W + 1; // "1"처럼 좁은 숫자는 오른쪽 정렬로 보고 칸을 넓힘
    // 획마다 세 군데를 찍어 하나라도 켜져 있으면 켜진 획 (글자가 지나가며 획 일부를 가려도 읽히게)
    const any = (pts: number[][]) => pts.some(([x, y]) => lit(x, y)) ? 1 : 0;
    const vert = (x: number, a: number, b: number) => any([0.25, 0.5, 0.75].map(t => [x, Y0 + h * (a + (b - a) * t)]));
    const horz = (y: number) => any([0.3, 0.5, 0.7].map(t => [x0 + (x1 - x0) * t, y]));
    const code = [horz(Y0 + 1), vert(x0 + 1, 0.05, 0.45), vert(x1 - 1, 0.05, 0.45), horz(Y0 + h / 2),
                  vert(x0 + 1, 0.55, 0.95), vert(x1 - 1, 0.55, 0.95), horz(Y1 - 1)].join('');
    if (SEVEN_SEG[code] == null) return null; // 숫자 모양이 아니면 타이머가 아님
    text += SEVEN_SEG[code];
  }
  if (!/^\d{1,3}\.\d\d$/.test(text)) return null; // 타이머는 항상 "초.백분의1초" 꼴 (예: 92.79)
  const x0 = Math.min(...band.map(b => b.x)), x1 = Math.max(...band.map(b => b.x + b.w));
  return { sec: parseFloat(text), text, box: { x: r.x + x0, y: r.y + Y0, w: x1 - x0, h: h + 1 } };
}
