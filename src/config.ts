import type { Rect } from './vision/geometry';

export interface RuneConfig { enabled: boolean; tol: number; minPx: number; maxPx: number; maxSize: number; frames: number; repeat: number; message: string }
export interface BoosterConfig { enabled: boolean; warnBefore: number }
export interface BuffConfig { enabled: boolean; warnBefore: number; minCount: number } // minCount: 이 개수 이상 함께 꺼질 때만 알림
export interface Config {
  tick: number; rate: number; volume: number; voice: string; ocrThresh: number;
  boosterBox: Rect | null; buffRegion: Rect | null; // boosterBox·buffRegion: 직접 지정했을 때만 (없으면 자동)
  rune: RuneConfig; booster: BoosterConfig; buff: BuffConfig;
}

const KEY = 'maple-alarm';
const DEFAULTS: Config = {
  tick: 1, rate: 1.1, volume: 1, voice: '', ocrThresh: 185,
  boosterBox: null, buffRegion: null,
  rune: { enabled: true, tol: 40, minPx: 6, maxPx: 400, maxSize: 30, frames: 3, repeat: 30, message: '룬이 생성되었습니다' },
  booster: { enabled: true, warnBefore: 10 },
  buff: { enabled: true, warnBefore: 20, minCount: 1 },
};

function load(): Config {
  // 예전 버전 설정도 섞여 들어올 수 있어 any로 받음
  let cfg: any = structuredClone(DEFAULTS);
  try {
    const s = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (s) cfg = { ...cfg, ...s, rune: { ...cfg.rune, ...s.rune }, booster: { ...cfg.booster, ...s.booster }, buff: { ...cfg.buff, ...s.buff } };
  } catch { /* 저장된 설정이 깨졌으면 기본값 */ }
  // 예전 버전(아이콘 등록 방식)의 설정은 쓰지 않음
  delete cfg.booster.alertOnEnd; delete cfg.minimap; delete cfg.rune.color; delete cfg.buffbar; delete cfg.buffs; delete cfg.buff.alertOnEnd; delete cfg.buff.minDuration;
  for (const k of ['id', 'name', 'tpl', 'thresh', 'duration', 'ignoreCenter', 'endFrames', 'repeatEnd']) delete cfg.booster[k];
  return cfg;
}

let current = load();
const listeners = new Set<() => void>();
let reportError = (_msg: string) => {};

export const configStore = {
  get: () => current,
  subscribe(l: () => void) { listeners.add(l); return () => { listeners.delete(l); }; },
  // 설정을 고치고 저장. save: false면 저장하지 않고 화면만 갱신
  update(mutate: (c: Config) => void, { save = true } = {}) {
    const next = structuredClone(current);
    mutate(next);
    current = next;
    if (save) {
      try { localStorage.setItem(KEY, JSON.stringify(current)); } catch (e) { reportError('설정 저장 실패: ' + (e as Error).message); }
    }
    listeners.forEach(l => l());
  },
  onError(fn: (msg: string) => void) { reportError = fn; },
};
