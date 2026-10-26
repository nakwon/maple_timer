import type { Rect } from '../vision/geometry';
import { findMinimapFrame, findRuneBlob, RUNE_COLOR } from '../vision/minimap';
import type { TrackerEnv } from './env';

const STREAK = 2;        // 룬이 사라졌다고 판단하기 위한 연속 판정 횟수
const MM_FIND_MS = 3000; // 미니맵 테두리 다시 찾는 간격 (맵마다 미니맵 크기가 다름)
const MM_KEEP_MS = 7000; // 미니맵을 잠깐 못 찾아도 이전 위치를 유지하는 시간

export class RuneTracker {
  present = false; streak = 0; count = 0; lastAlert = 0;
  centroid: [number, number] | null = null;
  mm: Rect | null = null; mmAt = 0; mmSeenAt = 0;
  blobs?: number; rejected?: number;
  private readonly env: TrackerEnv;

  constructor(env: TrackerEnv) { this.env = env; }

  reset() {
    Object.assign(this, { present: false, streak: 0, count: 0, lastAlert: 0, centroid: null, mm: null, mmAt: 0, mmSeenAt: 0 });
  }

  private debounce(raw: boolean, need = STREAK) {
    if (raw === this.present) { this.streak = 0; return false; }
    if (++this.streak < need) return false;
    this.present = raw; this.streak = 0; return true; // 상태 변경됨
  }

  check(now: number) {
    const { ctx, log, speak, flash } = this.env, R = this.env.cfg().rune;
    if (!R.enabled) { this.count = 0; this.centroid = null; return; }
    const m = this.region(now);
    if (!m) { Object.assign(this, { present: false, streak: 0, count: 0, centroid: null }); return; } // 미니맵이 안 보이면 반복 알림도 멈춤
    const d = ctx.getImageData(m.x, m.y, m.w, m.h).data, [cr, cg, cb] = RUNE_COLOR, tol2 = R.tol * R.tol;
    // 1) 룬 색과 비슷한 픽셀 표시
    const mask = new Uint8Array(m.w * m.h);
    for (let i = 0, p = 0; i < d.length; i += 4, p++) {
      const dr = d[i] - cr, dg = d[i + 1] - cg, db = d[i + 2] - cb;
      if (dr * dr + dg * dg + db * db <= tol2) mask[p] = 1;
    }
    // 2) 붙어 있는 픽셀끼리 덩어리로 묶고, 룬 아이콘다운 크기/모양인 덩어리만 인정
    const blob = findRuneBlob(mask, m.w, m.h, R, d);
    this.count = blob.total; this.blobs = blob.accepted; this.rejected = blob.rejected;
    this.centroid = blob.best ? [m.x + blob.best.cx, m.y + blob.best.cy] : null;
    // 3) 나타날 때는 R.frames번 연속으로 보여야 인정 (잠깐 스친 보라색 무시)
    const changed = this.debounce(!!blob.best, blob.best ? R.frames : STREAK);
    if (changed && this.present) { this.lastAlert = now; speak(R.message); log(`🔮 룬 감지 (${blob.best!.n}px, ${blob.best!.w}×${blob.best!.h})`); flash('runePanel'); }
    else if (changed) log('룬 사라짐');
    else if (this.present && R.repeat > 0 && now - this.lastAlert >= R.repeat * 1000) { this.lastAlert = now; speak(R.message); log('🔮 룬 반복 알림'); }
  }

  // 룬은 자동으로 찾은 미니맵 지도 칸 안에서만 찾음.
  // 미니맵이 접혀 있거나 없는 맵이면 아무 데도 보지 않음 (예전 위치를 계속 보면 게임 배경의 보라색을 룬으로 착각)
  // 커서가 테두리를 잠깐 가리는 정도는 봐주려고 마지막으로 찾은 위치를 MM_KEEP_MS 동안만 유지
  private region(now: number) {
    if (now - this.mmAt >= MM_FIND_MS) {
      this.mmAt = now;
      const f = findMinimapFrame(this.env.ctx);
      if (f) { this.mm = f; this.mmSeenAt = now; }
      else if (now - this.mmSeenAt > MM_KEEP_MS) this.mm = null;
    }
    return this.mm;
  }
}
