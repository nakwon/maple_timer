import { components, type Rect } from './geometry';

// ---------- 버프 숫자: 게임 숫자 모양(0~9)과 대조 ----------
// 버프 아이콘의 숫자는 높이 9px(칸 높이의 약 24%)짜리 고정 픽셀 글꼴이라, 한 글자씩 떼어 7×9 격자로 맞춘 뒤
// 아래 모양과 가장 비슷한 숫자로 읽음. 모양은 실제 게임 스크린샷에서 뽑았음 ('#' = 노랑·흰 숫자 픽셀)
const GLYPH_W = 7, GLYPH_H = 9;
const DIGIT_SHAPES: Record<string, string[]> = {
  0: ['.####../##..##./#....#./#....#./#....#./#....#./#....#./##..##./.####..'],
  1: ['...##../..###../....#../....#../....#../....#../....#../....#../....#..', '....#../..###../....#../....#../....#../....#../....#../....#../....#..'],
  2: ['.#####./.....#./.....#./.....#./....##./...##../..##.../..#..../.#####.', '.####../#....#./.....#./.....#./....#../..##.../.#...../#....../######.'],
  3: ['.####../.....#./.....#./....##./..###../....##./.....#./....##./.####..'],
  4: ['...##../...##../..###../..#.#../.#..#../##.##../######./....#../....#..', '....#../...##../..#.#../.#..#../#...#../######./....#../....#../....#..'], // 둘째: 왼쪽 아래 작은 숫자
  5: ['.#####./.#...../.#...../.#...../.####../.....#./.....#./....##./.####..', '######./#....../#....../#####../.....#./.....#./.....#./#....#./.####..'],
  6: ['.#####./##...../#....../#....../#####../#....#./#....#./##..##./.####..', '..###../.#...../#....../#####../#....#./#....#./#....#./#....#./.####..'],
  7: ['######./....##./....#../...##../...#.../...#.../..#..../..#..../.#.....'],
  8: ['.####../#....#./#....#./##..#../.####../##..##./#....#./##..##./.####..', '.####../#....#./#....#./#....#./.####../#....#./#....#./#....#./.####..'],
  9: ['.####../#...##./#....#./#...##./.#####./.....#./.....#./....##./#####..', '.####../#....#./#....#./#....#./#....#./.#####./.....#./.....#./.####..'],
};
const DIGIT_BITS = Object.entries(DIGIT_SHAPES).flatMap(([d, list]) => list.map(s => ({ d, bits: s.replace(/\//g, '') })));
const DIGIT_MAX_DIFF = 12; // 63칸 중 이보다 많이 다르면 숫자가 아닌 것으로 봄

// 영역 b에서 숫자 픽셀(빨강·초록이 모두 밝은 노랑·흰색) 표시
function digitMask(ctx: CanvasRenderingContext2D, b: Rect, ocrThresh: number) {
  const T = ocrThresh - 35, d = ctx.getImageData(b.x, b.y, b.w, b.h).data, m = new Uint8Array(b.w * b.h);
  for (let i = 0, p = 0; p < m.length; i += 4, p++) if (d[i] > T && d[i + 1] > T) m[p] = 1;
  return m;
}
// 글자 덩어리 c를 7×9 격자로 맞춤 (높이 기준으로 크기를 맞추고 가로는 가운데 정렬)
function glyphBits(m: Uint8Array, W: number, c: Rect) {
  const s = c.h / GLYPH_H, nw = Math.max(1, Math.min(GLYPH_W, Math.round(c.w / s))), off = Math.floor((GLYPH_W - nw) / 2);
  let out = '';
  for (let y = 0; y < GLYPH_H; y++) for (let x = 0; x < GLYPH_W; x++) {
    const ix = x - off;
    out += ix >= 0 && ix < nw && m[(c.y + Math.floor((y + 0.5) * s)) * W + c.x + Math.floor((ix + 0.5) * s)] ? '#' : '.';
  }
  return out;
}
function matchDigit(bits: string) {
  let best: string | null = null, bestDiff = Infinity;
  for (const t of DIGIT_BITS) {
    let diff = 0;
    for (let i = 0; i < bits.length && diff < bestDiff; i++) if (bits[i] !== t.bits[i]) diff++;
    if (diff < bestDiff) { bestDiff = diff; best = t.d; }
  }
  return bestDiff <= DIGIT_MAX_DIFF ? best : null;
}

export interface DigitGroup extends Rect { text: string }

// 영역 b 안의 숫자 글자 덩어리들: 숫자 높이(칸 높이 digitH 기준)이고, 같은 높이에 나란히 놓인 것끼리 묶음
export function digitGroups(ctx: CanvasRenderingContext2D, b: Rect, digitH: number, ocrThresh: number): DigitGroup[] {
  const m = digitMask(ctx, b, ocrThresh);
  const cand = components(m, b.w, b.h)
    .map(c => ({ x: c.x0, y: c.y0, w: c.x1 - c.x0 + 1, h: c.y1 - c.y0 + 1, n: c.n }))
    .filter(c => c.h >= digitH * 0.75 && c.h <= digitH * 1.25 && c.w >= 2 && c.w <= digitH * 0.8 && c.n >= 4)
    .sort((a, c) => a.x - c.x);
  const groups: (typeof cand)[] = [];
  for (const c of cand) {
    // 같은 줄(위·아래 끝이 1px 이내)이고 바로 옆이면 같은 숫자. 콜론을 사이에 둔 "5:59"는 틈이 7px이라 숫자 높이(9px)까지 허용
    const g = groups.find(g => { const l = g[g.length - 1]; return Math.abs(l.y - c.y) <= 1 && Math.abs(l.y + l.h - c.y - c.h) <= 1 && c.x - (l.x + l.w) <= digitH; });
    if (g) g.push(c); else groups.push([c]);
  }
  return groups.map(g => ({ g, text: g.map(c => matchDigit(glyphBits(m, b.w, c))) }))
    .filter(r => r.text.every(Boolean)).map(({ g, text }) => ({ text: text.join(''), x: g[0].x, y: g[0].y, w: g[g.length - 1].x + g[g.length - 1].w - g[0].x, h: g[0].h }));
}

// 왼쪽 아래 작은 숫자는 밝은 아이콘 그림 위에 겹쳐 있어 색만으로는 떼어 낼 수 없음.
// 그래서 숫자 모양을 구석에 직접 대 보며 "숫자 픽셀은 밝고, 숫자를 두른 검은 테두리는 어두운" 자리를 찾음
// (아이콘 그림에는 이런 테두리가 없어서 걸러짐)
const DIGIT_TPL = Object.entries(DIGIT_SHAPES).flatMap(([d, list]) => list.map(s => {
  const rows = s.split('/'), isCore = (x: number, y: number) => y >= 0 && y < GLYPH_H && x >= 0 && x < GLYPH_W && rows[y][x] === '#';
  let x0 = GLYPH_W, x1 = -1;
  rows.forEach(r => [...r].forEach((ch, x) => { if (ch === '#') { x0 = Math.min(x0, x); x1 = Math.max(x1, x); } }));
  const core: [number, number][] = [], ring: [number, number][] = [];
  for (let y = -1; y <= GLYPH_H; y++) for (let x = x0 - 1; x <= x1 + 1; x++) {
    if (isCore(x, y)) core.push([x - x0, y]);
    else if ([[-1, 0], [1, 0], [0, -1], [0, 1]].some(([dx, dy]) => isCore(x + dx, y + dy))) ring.push([x - x0, y]);
  }
  return { d, w: x1 - x0 + 1, core, ring };
}));
type DigitTpl = (typeof DIGIT_TPL)[number];
const CORNER_MIN_SCORE = 0.85; // 숫자 픽셀·테두리 중 이 비율 이상이 맞아야 숫자로 인정

export function readCornerDigits(ctx: CanvasRenderingContext2D, box: Rect, ocrThresh: number) {
  const s = box.h * 0.243 / GLYPH_H, T = ocrThresh - 35;
  const d = ctx.getImageData(box.x, box.y, box.w, box.h).data;
  const at = (x: number, y: number) => { x = Math.round(x); y = Math.round(y); return x < 0 || y < 0 || x >= box.w || y >= box.h ? -1 : (y * box.w + x) * 4; };
  const score = (t: DigitTpl, ox: number, oy: number) => {
    let ok = 0;
    for (const [x, y] of t.core) { const i = at(ox + x * s, oy + y * s); if (i >= 0 && d[i] > T && d[i + 1] > T) ok++; }
    for (const [x, y] of t.ring) { const i = at(ox + x * s, oy + y * s); if (i < 0 || d[i] + d[i + 1] + d[i + 2] < 240) ok++; }
    return ok / (t.core.length + t.ring.length);
  };
  const bestAt = (xs: number[], ys: number[]) => {
    let best: { t: DigitTpl; ox: number; oy: number; sc: number } | null = null;
    for (const oy of ys) for (const ox of xs) for (const t of DIGIT_TPL) { const sc = score(t, ox, oy); if (!best || sc > best.sc) best = { t, ox, oy, sc }; }
    return best && best.sc >= CORNER_MIN_SCORE ? best : null;
  };
  const range = (a: number, b: number) => { const r: number[] = []; for (let v = Math.round(a); v <= Math.round(b); v++) r.push(v); return r; };
  // 첫 글자: 칸 왼쪽 아래 구역 어디든. 다음 글자: 바로 오른쪽 같은 높이 (최대 3글자)
  let cur = bestAt(range(0, box.w * 0.4), range(box.h * 0.55, box.h - GLYPH_H * s));
  if (!cur) return null;
  let text = cur.t.d;
  while (text.length < 3) {
    const nx = cur.ox + cur.t.w * s;
    const next = bestAt(range(nx, nx + 3 * s), [cur.oy]);
    if (!next) break;
    text += next.t.d; cur = next;
  }
  return text;
}

export interface TimeRead { sec: number; min?: number; exact?: boolean }

// 버프 시간 표시 4가지: 1) 왼쪽 아래 작은 숫자 → 남은 분(대략)  2) M:SS  3) SS  4) S  (2~4는 가운데 숫자, 정확한 초)
// 콜론은 너무 작아 글자로 잡히지 않으므로 숫자 개수로 구분: 1~2개 = 초, 3~4개 = 분:초
export function digitsToTime(text: string, corner: boolean): TimeRead {
  if (corner) return { sec: +text * 60, min: +text, exact: false }; // 초는 모름
  if (text.length <= 2) return { sec: +text, exact: true };
  const m = +text.slice(0, -2), s = +text.slice(-2);
  return s < 60 ? { sec: m * 60 + s, exact: true } : { sec: 0 };
}
