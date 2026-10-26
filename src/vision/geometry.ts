export interface Rect { x: number; y: number; w: number; h: number }

export const overlaps = (a: Rect, b: Rect) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
export const center = (b: Rect): [number, number] => [b.x + b.w / 2, b.y + b.h / 2];
export const dist = (a: Rect, b: Rect) => { const [ax, ay] = center(a), [bx, by] = center(b); return Math.hypot(ax - bx, ay - by); };

export interface Blob { n: number; sx: number; sy: number; x0: number; y0: number; x1: number; y1: number }

// 마스크에서 서로 붙어 있는 픽셀 덩어리들을 찾음 (8방향: 안티앨리어싱으로 끊긴 대각선도 한 덩어리로)
export function components(mask: Uint8Array, W: number, H: number): Blob[] {
  const seen = new Uint8Array(mask.length), stack: number[] = [], out: Blob[] = [];
  for (let start = 0; start < mask.length; start++) {
    if (!mask[start] || seen[start]) continue;
    let n = 0, sx = 0, sy = 0, x0 = W, y0 = H, x1 = 0, y1 = 0;
    seen[start] = 1; stack.push(start);
    while (stack.length) {
      const p = stack.pop()!, x = p % W, y = (p / W) | 0;
      n++; sx += x; sy += y;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx, ny = y + dy, q = ny * W + nx;
        if (nx >= 0 && ny >= 0 && nx < W && ny < H && mask[q] && !seen[q]) { seen[q] = 1; stack.push(q); }
      }
    }
    out.push({ n, sx, sy, x0, y0, x1, y1 });
  }
  return out;
}
