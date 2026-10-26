import { configStore } from '../config';
import { speak } from '../speech';
import { autoBuffRegion, BUFF_ROW, iconCount, locateBuffRow, MAX_SLOTS, readSlots, type SlotDebug } from '../vision/buffGrid';
import type { Rect } from '../vision/geometry';
import { BoosterTracker } from './booster';
import { buffLeft, BuffTracker } from './buffs';
import type { PanelId, TrackerEnv } from './env';
import { RuneTracker } from './rune';

export type SetupMode = 'view' | 'booster' | 'buffRegion';
export interface LogEntry { id: number; text: string }

type FrameGrabber = { grabFrame(): Promise<ImageBitmap> };
// ImageCapture는 아직 TS 기본 타입에 없음 (Chrome 전용)
const ImageCaptureCtor = (globalThis as { ImageCapture?: new (track: MediaStreamTrack) => FrameGrabber }).ImageCapture;

const MAX_LOG = 200;

// 화면 공유·감시 루프·런타임 상태 (저장 안 함). React는 subscribe/getVersion으로 바뀔 때마다 다시 그림
export class Monitor {
  readonly frame = document.createElement('canvas');
  readonly fctx = this.frame.getContext('2d', { willReadFrequently: true })!;
  // 영역 지정용 정지 화면 (지정 창을 열 때 한 번 찍음)
  readonly still = document.createElement('canvas');
  readonly sctx = this.still.getContext('2d', { willReadFrequently: true })!;
  readonly rune: RuneTracker;
  readonly booster: BoosterTracker;
  readonly buffs: BuffTracker;

  monitoring = false;
  mode: SetupMode | null = null;
  stillVersion = 0;
  now = Date.now(); // 마지막으로 상태가 바뀐 시각 (화면에 남은 시간을 계산하는 기준)
  logs: LogEntry[] = [];
  flashing = new Set<PanelId>();

  private stream: MediaStream | null = null;
  private imageCapture: FrameGrabber | null = null;
  private readonly video: HTMLVideoElement;
  private timer = 0;
  private busy = false;
  private nextLogId = 1;
  private version = 0;
  private readonly listeners = new Set<() => void>();

  constructor() {
    const env: TrackerEnv = {
      ctx: this.fctx,
      cfg: () => configStore.get(),
      log: (msg) => this.log(msg),
      speak: (text) => speak(text, configStore.get()),
      flash: (panel) => this.flash(panel),
    };
    this.rune = new RuneTracker(env);
    this.booster = new BoosterTracker(env);
    this.buffs = new BuffTracker(env);
    configStore.onError((msg) => this.log(msg));
    this.video = Object.assign(document.createElement('video'), { autoplay: true, muted: true, playsInline: true, hidden: true });
    document.body.append(this.video);
  }

  subscribe = (l: () => void) => { this.listeners.add(l); return () => { this.listeners.delete(l); }; };
  getVersion = () => this.version;
  private emit() { this.version++; this.now = Date.now(); this.listeners.forEach(l => l()); }

  get sharing() { return !!this.stream; }
  private get cfg() { return configStore.get(); }
  private get tickMs() { return Math.max(300, this.cfg.tick * 1000); }

  log(msg: string) {
    this.logs = [{ id: this.nextLogId++, text: new Date().toLocaleTimeString() + '  ' + msg }, ...this.logs].slice(0, MAX_LOG);
    this.emit();
  }

  private flash(panel: PanelId) {
    this.flashing.add(panel); this.emit();
    setTimeout(() => { this.flashing.delete(panel); this.emit(); }, 3000);
  }

  // ---------- 화면 공유 ----------
  toggleShare = () => { if (this.stream) this.stopShare(); else void this.startShare(); };

  async startShare() {
    // displaySurface: 'window' → 공유 선택 창에서 '창' 탭을 먼저 보여줌
    try { this.stream = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 10, displaySurface: 'window' }, audio: false }); }
    catch (e) { this.log('화면 공유 취소/실패: ' + (e as Error).message); return; }
    const track = this.stream.getVideoTracks()[0];
    track.addEventListener('ended', this.stopShare);
    this.imageCapture = ImageCaptureCtor ? new ImageCaptureCtor(track) : null;
    this.video.srcObject = this.stream; await this.video.play();
    this.log('화면 공유 시작');
    this.startMonitor(); // 공유하는 동안은 항상 감시
  }

  stopShare = () => {
    this.stopMonitor();
    this.stream?.getTracks().forEach(t => t.stop());
    this.stream = null; this.imageCapture = null; this.video.srcObject = null;
    this.mode = null; this.log('화면 공유 종료');
  };

  // 프레임 한 장을 frame 캔버스로. 백그라운드 탭에서도 동작하도록 ImageCapture 우선 사용
  private async grab() {
    let src: ImageBitmap | null = null;
    if (this.imageCapture) {
      try { src = await Promise.race([this.imageCapture.grabFrame(), new Promise<never>((_, rej) => setTimeout(rej, 400))]); } catch { /* 늦으면 video에서 */ }
    }
    const w = src ? src.width : this.video.videoWidth, h = src ? src.height : this.video.videoHeight;
    if (!w) return false;
    if (this.frame.width !== w || this.frame.height !== h) { this.frame.width = w; this.frame.height = h; }
    this.fctx.drawImage(src || this.video, 0, 0);
    src?.close?.();
    return true;
  }

  // ---------- 영역 지정 창 (정지 스냅샷) ----------
  async snapshot() {
    if (!(await this.grab())) { this.log('화면을 가져오지 못했습니다.'); return false; }
    this.still.width = this.frame.width; this.still.height = this.frame.height; this.sctx.drawImage(this.frame, 0, 0);
    this.stillVersion++; this.emit();
    return true;
  }

  private needShare() { if (!this.stream) { this.log('먼저 화면 공유를 시작하세요.'); return true; } return false; }

  async openSetup(m: SetupMode) {
    if (this.needShare()) return;
    this.mode = (await this.snapshot()) ? m : null;
    this.emit();
  }

  closeSetup = () => { if (this.mode) { this.mode = null; this.emit(); } };

  // ---------- 감시 루프 ----------
  private tick = async () => {
    if (this.busy) return; this.busy = true;
    try {
      if (!(await this.grab())) return;
      const now = Date.now();
      this.rune.check(now);
      this.booster.check(now);
      this.buffs.check(now, this.cfg.boosterBox || this.booster.box);
      this.emit();
    } finally { this.busy = false; }
  };

  private startMonitor() {
    this.rune.reset();
    this.booster.reset(); this.booster.lastAlertAt = 0; this.buffs.reset();
    this.monitoring = true;
    this.timer = window.setInterval(this.tick, this.tickMs);
    this.log('감시 시작');
  }

  private stopMonitor() {
    if (!this.monitoring) return;
    this.monitoring = false; clearInterval(this.timer);
    this.log('감시 중지');
  }

  // 검사 주기를 바꾸면 감시를 다시 시작
  restartMonitor = () => { if (this.monitoring) { this.stopMonitor(); this.startMonitor(); } };

  // ---------- 설정 버튼 ----------
  setBoosterBox(r: Rect) {
    configStore.update(c => { c.boosterBox = r; });
    this.booster.reset(); this.log(`부스터 타이머 위치 직접 지정: ${r.w}×${r.h}`);
  }

  setBuffRegion(r: Rect) {
    configStore.update(c => { c.buffRegion = r; });
    this.buffs.timers = []; this.log(`버프 인식 영역 직접 지정: ${r.w}×${r.h}`);
  }

  refindBooster = () => { this.booster.reset(); this.log('부스터 타이머 다시 찾는 중'); };

  autoBooster = () => {
    configStore.update(c => { c.boosterBox = null; });
    this.booster.reset(); this.log('부스터 타이머를 자동으로 찾습니다');
  };

  autoBuffRow = () => {
    configStore.update(c => { c.buffRegion = null; });
    this.buffs.timers = []; this.log(`버프 감시 줄: 자동(${BUFF_ROW}번째 화살표)`);
  };

  testVoice = () => speak('룬이 생성되었습니다. 부스터 종료 10초 전', this.cfg);

  // ---------- 진단 저장: 웹페이지가 실제로 받은 화면(PNG)과 그 화면의 판별 결과·설정(JSON)을 내려받음 ----------
  saveDiagnostics = async () => {
    if (this.needShare()) return;
    if (!(await this.grab())) { this.log('화면을 가져오지 못했습니다.'); return; }
    const { frame, fctx, cfg, rune, booster, buffs } = this;
    const stamp = new Date().toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 15);
    const download = (blob: Blob, name: string) => { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 5000); };
    // 1) 지금 화면 그대로 (무손실 PNG)
    const png = await new Promise<Blob | null>(res => frame.toBlob(res, 'image/png'));
    if (png) download(png, `maple-diag-${stamp}.png`);
    // 2) 같은 화면으로 다시 판별한 결과와 그때의 설정·상태
    const area = autoBuffRegion(frame.width, frame.height), { row, arrows } = locateBuffRow(fctx, cfg.buffRegion), slots: SlotDebug[] = [];
    buffs.arrows = arrows;
    const reads = row && !row.manual ? readSlots(fctx, row, cfg.ocrThresh, slots) : [];
    const track = this.stream!.getVideoTracks()[0];
    const info = {
      savedAt: new Date().toString(),
      frame: { width: frame.width, height: frame.height },
      track: track.getSettings?.(),          // 공유 방식(창/화면), 해상도 등
      devicePixelRatio: window.devicePixelRatio,
      settings: { ocrThresh: cfg.ocrThresh, tick: cfg.tick, buffRegion: cfg.buffRegion, buff: cfg.buff, boosterBox: cfg.boosterBox },
      buffSearchArea: area,
      arrows: buffs.arrows,
      row,
      iconCounts: row && !row.manual ? [0, 1, 2].map(l => iconCount(fctx, row, l, MAX_SLOTS)) : null,
      slots,                                  // 칸마다 찾은 숫자 덩어리·최종 판독값
      reads: reads.map(r => ({ text: r.text, sec: r.sec, exact: r.exact, min: r.min, slot: r.k, line: r.line })),
      timers: buffs.timers.map(t => ({ id: t.id, exact: t.exact, left: Math.round(buffLeft(t, Date.now())), min: t.min, text: t.text, hits: t.hits, box: t.box })),
      booster: { box: booster.box, raw: booster.raw, value: booster.value },
      rune: { minimap: rune.mm, present: rune.present, centroid: rune.centroid, pixels: rune.count, blobs: rune.blobs, rejected: rune.rejected },
      recentLog: this.logs.slice(0, 40).map(l => l.text),
    };
    download(new Blob([JSON.stringify(info, null, 2)], { type: 'application/json' }), `maple-diag-${stamp}.json`);
    this.log(`🩺 진단 저장: maple-diag-${stamp}.png / .json (다운로드 폴더) · 이 화면 판독 ${reads.map(r => r.exact ? r.text : r.text + '분').join(', ') || '없음'}`);
  };
}

export const monitor = new Monitor();
