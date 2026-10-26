import type { Rect } from '../vision/geometry';
import { boosterSearchRegion, digitPixels, readSevenSeg } from '../vision/sevenSeg';
import type { TrackerEnv } from './env';

const BOOST_LOST_MS = 15000; // 부스터 타이머가 이 시간 동안 화면에 안 보이면 없어진 것으로 봄

export class BoosterTracker {
  box: Rect | null = null; value: number | null = null; lastSeen = 0; seenAt = 0; px = 0; misses = 0;
  warned = false; raw = ''; lastAlertAt = 0;
  cand: { sec: number; at: number } | null = null;
  private readonly env: TrackerEnv;

  constructor(env: TrackerEnv) { this.env = env; }

  // 마지막 알림 시각(lastAlertAt)은 남김
  reset() { Object.assign(this, { box: null, value: null, lastSeen: 0, seenAt: 0, px: 0, misses: 0, warned: false, raw: '', cand: null }); }

  left(now: number) { return this.value == null ? null : this.value - (now - this.lastSeen) / 1000; }

  check(now: number) {
    const { ctx, log, speak, flash } = this.env, cfg = this.env.cfg(), B = cfg.booster;
    if (!B.enabled) return;
    // 직접 지정한 위치가 있으면 거기, 아니면 위쪽 가운데 전체에서 매번 찾음 (계산이 가벼워 위치를 고정할 필요 없음)
    const read = readSevenSeg(ctx, cfg.boosterBox || boosterSearchRegion(ctx.canvas.width, ctx.canvas.height));
    const pred = this.left(now);
    // 읽은 값은 지금 예상 남은 시간과 맞거나(±2초), 바로 전에 읽은 값과 시간 흐름이 맞을 때만(두 번 연속 확인) 인정
    // → 글자가 겹쳐 한두 번 잘못 읽혀도 무시되고, 부스터를 다시 써서 시간이 늘어난 것도 두 번 확인 후 반영
    let ok = false;
    if (read) {
      const c = this.cand;
      if (pred != null && Math.abs(read.sec - pred) <= 2) ok = true;
      else if (c && Math.abs(read.sec - (c.sec - (now - c.at) / 1000)) <= 1.5) ok = true;
      else this.cand = { sec: read.sec, at: now };
    }
    if (ok && read) {
      if (pred == null) log(`⏱ 부스터 타이머 찾음 (${read.text}초)`);
      else if (read.sec > pred + 5) { this.warned = false; log(`⏱ 부스터 갱신 (${read.text}초)`); }
      Object.assign(this, { box: read.box, value: read.sec, lastSeen: now, seenAt: now, px: digitPixels(ctx, read.box), misses: 0, raw: read.text, cand: null });
    } else if (this.value != null) {
      // 못 읽은 동안은 마지막으로 읽은 값에서 계속 줄어드는 것으로 계산
      this.misses++;
      // 글자가 겹쳐 못 읽을 뿐 타이머 숫자 색이 그 자리에 그대로 있으면 아직 떠 있는 것
      if (digitPixels(ctx, this.box!) >= this.px * 0.4) this.seenAt = now;
      const left = this.left(now)!, lost = now - this.seenAt > BOOST_LOST_MS;
      if (left <= 0.5 || lost) {
        // 시간이 다 됐거나 한참 동안 아예 안 보이면 추적 끝 (음성은 "N초 전" 알림만 씀)
        log(lost ? '부스터 타이머가 안 보임' : '부스터 끝남');
        this.reset();
        return;
      }
    }
    // 종료 N초 전 알림 (읽기 사이에도 남은 시간을 계산해서 늦지 않게)
    const left = this.left(now);
    if (left != null && !this.warned && B.warnBefore > 0 && left <= B.warnBefore && left > 0) {
      this.warned = true; this.lastAlertAt = now;
      speak(`부스터 종료 ${Math.max(1, Math.round(left))}초 전`); log(`⏳ 부스터 종료 ${Math.round(left)}초 전`); flash('boosterPanel');
    }
  }
}
