import type { Config } from './config';

// 한국어 목소리를 앞으로
export const sortedVoices = () =>
  speechSynthesis.getVoices().slice().sort((a, b) => Number(b.lang.startsWith('ko')) - Number(a.lang.startsWith('ko')));

export function speak(text: string, cfg: Config) {
  const u = new SpeechSynthesisUtterance(text);
  const v = speechSynthesis.getVoices().find(v => v.name === cfg.voice);
  if (v) { u.voice = v; u.lang = v.lang; } else u.lang = 'ko-KR';
  u.rate = cfg.rate || 1; u.volume = cfg.volume ?? 1;
  speechSynthesis.speak(u);
}
