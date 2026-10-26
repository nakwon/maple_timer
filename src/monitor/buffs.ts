import { locateBuffRow, readSlots, type BuffRow } from '../vision/buffGrid';
import { center, dist, overlaps, type Rect } from '../vision/geometry';
import { digitGroups, digitsToTime } from '../vision/glyphs';
import type { TrackerEnv } from './env';

const BUFF_OCR_MS = 2000;   // 버프 숫자 읽기 간격
const BUFF_GRACE_MS = 12000; // 버프 숫자가 안 보여도 이 시간까지는 가려진 것으로 보고 기다림
const BUFF_GROUP_SEC = 10;   // 종료 N초 전 알림을 할 때, 이 시간 안에 이어서 끝나는 버프는 같은 알림으로 묶음

export interface BuffTimer {
  id: number; exact: boolean; value: number | null; min?: number;
  lastSeen: number; box: Rect; text: string; warned: boolean; hits: number; thumb: string;
}
interface BuffRead { text: string; sec: number; min?: number; exact?: boolean; box: Rect }
type Fit = { value: number; exact?: boolean } | { min: number };

// ---------- 버프: 오른쪽 끝 ">" 화살표 기준 N번째 줄의 남은 시간 숫자 ----------
// 아이콘마다 숫자를 읽어 "타이머"로 추적. 아이콘 위치가 바뀌어도 남은 시간이 이어지는 것끼리 같은 버프로 봄
// 남은 시간(초). 분 표시 버프는 초를 모르므로 표시된 분으로 대략 계산 (정렬·표시용, 알림에는 쓰지 않음)
export const buffLeft = (t: BuffTimer, now: number) => t.exact ? t.value! - (now - t.lastSeen) / 1000 : t.min! * 60;

// 읽은 숫자 r이 타이머 t와 같은 버프면 t에 덮어쓸 값, 아니면 null.
// 왼쪽 아래 분 표시("N")는 초를 알 수 없으므로 초로 계산하지 않고 "약 N분"으로만 들고 있다가,
// 같은 칸 숫자가 가운데 M:SS로 바뀌는 순간부터 정확한 초로 이어서 셈
function fitRead(r: BuffRead, t: BuffTimer, now: number): Fit | null {
  if (t.exact && r.exact) return Math.abs(r.sec - buffLeft(t, now)) <= 3 ? { value: r.sec } : null;
  if (!t.exact && !r.exact) return r.min === t.min || r.min === t.min! - 1 ? { min: r.min! } : null; // 분은 그대로거나 1 줄어듦
  if (!t.exact && r.exact) // 분 표시 → 초 표시로 바뀜: 같은 칸이고 남은 시간이 그 분 근처일 때만
    return dist(r.box, t.box) < r.box.w * 0.6 && r.sec <= t.min! * 60 + 60 ? { value: r.sec, exact: true } : null;
  return null; // 초 표시 → 분 표시는 생기지 않음 (버프를 다시 쓴 경우는 새 버프로 처리)
}

export class BuffTracker {
  timers: BuffTimer[] = [];
  lastRead = 0; lastAlertAt = 0; nextId = 1;
  arrows: Rect[] = [];
  row: BuffRow | null = null;
  private readonly env: TrackerEnv;

  constructor(env: TrackerEnv) { this.env = env; }

  reset() { Object.assign(this, { timers: [], lastAlertAt: 0, arrows: [], row: null }); }

  // boosterBox: 부스터 타이머 숫자는 버프로 읽지 않음
  check(now: number, boosterBox: Rect | null) {
    const { ctx } = this.env, cfg = this.env.cfg();
    if (!cfg.buff.enabled || now - this.lastRead < BUFF_OCR_MS) return;
    this.lastRead = now;
    const { row, arrows } = locateBuffRow(ctx, cfg.buffRegion);
    this.row = row; this.arrows = arrows;
    if (!row) return; // 줄을 못 찾으면 이번엔 건너뜀 (가려진 동안은 기존 타이머가 기다림)
    // 직접 지정한 영역은 칸 격자를 모르므로 영역 안 숫자를 모두 가운데 숫자(초)로 읽음. 숫자 높이는 영역 높이로 짐작
    const reads: BuffRead[] = row.manual
      ? digitGroups(ctx, row, Math.min(row.h, 37) * 0.243, cfg.ocrThresh).map(n => ({ text: n.text, ...digitsToTime(n.text, false), box: { x: row.x + n.x, y: row.y + n.y, w: n.w, h: n.h } })).filter(n => n.sec > 0)
      : readSlots(ctx, row, cfg.ocrThresh);
    this.track(reads.filter(x => !(boosterBox && overlaps(x.box, boosterBox))), now);
  }

  private track(reads: BuffRead[], now: number) {
    const { log, speak, flash } = this.env, C = this.env.cfg().buff, timers = this.timers, used = new Set<BuffTimer>();
    // 1) 남은 시간이 예상대로 이어지는 숫자 = 같은 버프 (가까운 칸 우선)
    const pairs: { r: BuffRead; t: BuffTimer; fit: Fit; cost: number }[] = [];
    for (const r of reads) for (const t of timers) {
      const fit = fitRead(r, t, now);
      if (fit) pairs.push({ r, t, fit, cost: ('value' in fit && t.exact ? Math.abs(fit.value - buffLeft(t, now)) : 0) + dist(r.box, t.box) / 100 });
    }
    pairs.sort((a, b) => a.cost - b.cost);
    const matchedR = new Set<BuffRead>();
    for (const { r, t, fit } of pairs) {
      if (used.has(t) || matchedR.has(r)) continue;
      used.add(t); matchedR.add(r);
      if ('exact' in fit && fit.exact && !t.exact) log(`⏱ 버프 남은 시간 초 단위로 전환 (${r.text})`);
      Object.assign(t, fit, { lastSeen: now, box: r.box, text: r.text, hits: t.hits + 1 });
      if (t.hits === 2) log(`✅ 버프 감지 (${t.exact ? r.text : `약 ${t.min}분`})`);
    }
    for (const r of reads) {
      if (matchedR.has(r)) continue;
      // 2) 같은 칸에서 숫자가 늘었으면 버프를 다시 쓴 것 (잘못 읽은 숫자로 착각하지 않게 "분:초"로 읽힌 경우만)
      const same = r.exact && timers.find(t => !used.has(t) && t.exact && t.hits >= 2 && dist(r.box, t.box) < Math.min(r.box.w, r.box.h) * 0.5 && r.sec > buffLeft(t, now) + 3);
      if (same) {
        used.add(same);
        Object.assign(same, { value: r.sec, lastSeen: now, box: r.box, text: r.text, warned: false });
        log(`✅ 버프 갱신 (${r.text})`);
        continue;
      }
      // 3) 새 버프 후보: 다음 읽기에서도 이어지는 숫자가 나와야(hits 2) 진짜 버프로 인정 → 잘못 읽은 숫자 제외
      timers.push({ id: this.nextId++, exact: !!r.exact, value: r.exact ? r.sec : null, min: r.min, lastSeen: now, box: r.box, text: r.text,
                    warned: false, hits: 1, thumb: this.iconThumb(r.box) });
    }
    // 4) 안 보이는 타이머: (초 단위로 세던 버프가) 거의 끝났으면 목록에서 빼고, 아니면 가려진 것으로 보고 잠시 기다림
    this.timers = timers.filter(t => {
      if (used.has(t) || t.lastSeen === now) return true;
      if (t.exact && buffLeft(t, now) <= 4) { if (t.hits >= 2) log(`버프 끝남 (${t.text})`); return false; }
      return now - t.lastSeen < BUFF_GRACE_MS;
    });
    // 5) 종료 N초 전 알림: 같이 쓴 버프들은 1~2초 차이로 끝나므로 버프마다 알리지 않고 한 번만 알림.
    //    알릴 때가 된 버프가 있으면, 그보다 몇 초 안에 끝나는 버프들까지 함께 알린 것으로 처리
    if (C.warnBefore <= 0) return;
    const live = this.timers.filter(t => t.exact && t.hits >= 2 && !t.warned && buffLeft(t, now) > 0);
    const due = live.filter(t => buffLeft(t, now) <= C.warnBefore);
    if (!due.length) return;
    const left = Math.min(...due.map(t => buffLeft(t, now)));
    const group = live.filter(t => buffLeft(t, now) <= C.warnBefore + BUFF_GROUP_SEC);
    group.forEach(t => { t.warned = true; });
    // 함께 꺼지는 버프가 설정한 개수보다 적으면 알리지 않음 (예: 쿠폰·비약을 같이 쓴 묶음만 알림)
    if (group.length < Math.max(1, C.minCount)) { log(`버프 ${group.length}개 종료 예정 · ${C.minCount}개 미만이라 알리지 않음`); return; }
    this.lastAlertAt = now;
    speak(`버프 종료 ${Math.max(1, Math.round(left))}초 전`);
    log(`⏳ 버프 종료 ${Math.round(left)}초 전 (버프 ${group.length}개)`); flash('buffPanel');
  }

  // 썸네일: 자동 모드는 아이콘 칸 그대로, 직접 지정 모드는 숫자 둘레 정사각형
  private iconThumb(b: Rect) {
    const side = Math.max(b.w, b.h * 2.6), [cx, cy] = center(b);
    const r = this.row!.manual ? { x: Math.max(0, cx - side / 2), y: Math.max(0, cy - side / 2), w: side, h: side } : b;
    const c = document.createElement('canvas'); c.width = c.height = 56;
    c.getContext('2d')!.drawImage(this.env.ctx.canvas, r.x, r.y, r.w, r.h, 0, 0, 56, 56);
    return c.toDataURL();
  }
}
