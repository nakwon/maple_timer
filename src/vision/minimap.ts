import { components, type Rect } from './geometry';

export const RUNE_COLOR = [201, 118, 225]; // 미니맵 룬 아이콘 색 (고정)
const RUNE_MEAN_TOL = 28;   // 덩어리 평균 색이 룬 색과 이만큼 이내여야 룬 (다른 색 아이콘의 가장자리 번짐 걸러냄)
const RUNE_MIN_SIDE = 4;    // 룬 아이콘은 최소 4×4px (실제 6×6 정도)

export interface RuneBlobLimits { minPx: number; maxPx: number; maxSize: number }
export interface RuneBlob { n: number; w: number; h: number; cx: number; cy: number }

// 룬 아이콘 조건(픽셀 수, 크기, 가로세로 비율, 채움 비율)에 맞는 덩어리 중 가장 큰 것을 고름
// (d: 미니맵 픽셀. 덩어리 평균 색 확인용)
export function findRuneBlob(mask: Uint8Array, W: number, H: number, R: RuneBlobLimits, d: Uint8ClampedArray) {
  let total = 0, accepted = 0, rejected = 0, best: RuneBlob | null = null;
  // 덩어리에 속한 픽셀들의 평균 색이 룬 색에서 얼마나 떨어졌는지
  const meanDist = (x0: number, y0: number, x1: number, y1: number) => {
    let r = 0, g = 0, b = 0, k = 0;
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const p = y * W + x; if (!mask[p]) continue;
      r += d[p * 4]; g += d[p * 4 + 1]; b += d[p * 4 + 2]; k++;
    }
    return Math.hypot(r / k - RUNE_COLOR[0], g / k - RUNE_COLOR[1], b / k - RUNE_COLOR[2]);
  };
  for (const { n, sx, sy, x0, y0, x1, y1 } of components(mask, W, H)) {
    total += n;
    if (n < R.minPx) continue; // 점 몇 개짜리 잡음은 판정 대상에서도 제외
    const w = x1 - x0 + 1, h = y1 - y0 + 1, ratio = w / h, fill = n / (w * h);
    // 룬 아이콘은 정사각형에 가까운 4px 이상 덩어리이고, 평균 색이 룬 색에 가까움
    const ok = n <= R.maxPx && w <= R.maxSize && h <= R.maxSize && w >= RUNE_MIN_SIDE && h >= RUNE_MIN_SIDE
      && ratio >= 0.6 && ratio <= 1.7 && fill >= 0.25 && meanDist(x0, y0, x1, y1) <= RUNE_MEAN_TOL;
    if (!ok) { rejected++; continue; }
    accepted++;
    if (!best || n > best.n) best = { n, w, h, cx: sx / n, cy: sy / n };
  }
  return { total, accepted, rejected, best };
}

// 미니맵 지도 칸의 흰 테두리(2px 밝은 회백색 사각형)를 찾아 그 안쪽 영역을 돌려줌. 못 찾으면 null
export function findMinimapFrame(ctx: CanvasRenderingContext2D): Rect | null {
  const W = Math.round(ctx.canvas.width * 0.45), H = Math.round(ctx.canvas.height * 0.5);
  const d = ctx.getImageData(0, 0, W, H).data;
  const bright = new Uint8Array(W * H);
  for (let i = 0, p = 0; i < d.length; i += 4, p++) {
    const mx = Math.max(d[i], d[i + 1], d[i + 2]), mn = Math.min(d[i], d[i + 1], d[i + 2]);
    if (mn >= 185 && mx - mn <= 45) bright[p] = 1;
  }
  // 가로로 길게 이어진 밝은 줄 (위·아래 테두리 후보)
  const runs: { y: number; x0: number; x1: number }[] = [];
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W;) {
      if (!bright[y * W + x]) { x++; continue; }
      let e = x; while (e + 1 < W && bright[y * W + e + 1]) e++;
      if (e - x + 1 >= 60) runs.push({ y, x0: x, x1: e });
      x = e + 1;
    }
  }
  const colFill = (x: number, y0: number, y1: number) => { let n = 0; for (let y = y0; y <= y1; y++) n += bright[y * W + x] || bright[y * W + x + 1] || bright[y * W + x - 1] ? 1 : 0; return n / (y1 - y0 + 1); };
  let best: (Rect & { area: number }) | null = null;
  for (const t of runs) for (const b of runs) {
    const h = b.y - t.y;
    if (h < 30 || Math.abs(t.x0 - b.x0) > 6 || Math.abs(t.x1 - b.x1) > 6) continue;
    const x0 = Math.min(t.x0, b.x0) - 3, x1 = Math.max(t.x1, b.x1) + 3;
    // 왼쪽·오른쪽 세로 테두리도 있어야 함 (모서리가 둥글어 가로줄보다 몇 px 바깥)
    let lx = -1, rx = -1;
    for (let x = Math.max(1, x0); x <= x0 + 8 && lx < 0; x++) if (colFill(x, t.y + 4, b.y - 4) >= 0.8) lx = x;
    for (let x = Math.min(W - 2, x1); x >= x1 - 8 && rx < 0; x--) if (colFill(x, t.y + 4, b.y - 4) >= 0.8) rx = x;
    if (lx < 0 || rx < 0) continue;
    const area = (rx - lx) * h;
    if (!best || area > best.area) best = { area, x: lx + 2, y: t.y + 2, w: rx - lx - 3, h: h - 3 };
  }
  return best && { x: best.x, y: best.y, w: best.w, h: best.h };
}
