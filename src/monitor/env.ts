import type { Config } from '../config';

export type PanelId = 'runePanel' | 'boosterPanel' | 'buffPanel';

// 추적기들이 함께 쓰는 것: 지금 프레임, 설정, 알림 수단
export interface TrackerEnv {
  ctx: CanvasRenderingContext2D;
  cfg(): Config;
  log(msg: string): void;
  speak(text: string): void;
  flash(panel: PanelId): void;
}
