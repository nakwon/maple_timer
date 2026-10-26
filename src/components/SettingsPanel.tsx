import { useEffect, useState } from 'react';
import { configStore } from '../config';
import { useConfig, useMonitor, useToggle } from '../hooks';
import { sortedVoices } from '../speech';
import { MoreButton, NumInput } from './controls';

export function SettingsPanel() {
  const cfg = useConfig(), m = useMonitor(), [more, toggleMore] = useToggle();
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);

  // 목소리 목록은 늦게 채워지는 브라우저가 있어 voiceschanged 때마다 다시 채움
  useEffect(() => {
    const fill = () => {
      const list = sortedVoices(); if (!list.length) return;
      setVoices(list);
      const voice = configStore.get().voice;
      if (!voice || !list.some(v => v.name === voice)) configStore.update(c => { c.voice = list[0].name; }, { save: false });
    };
    fill();
    speechSynthesis.addEventListener('voiceschanged', fill);
    return () => speechSynthesis.removeEventListener('voiceschanged', fill);
  }, []);

  return (
    <section className="card">
      <div className="card-head">
        <i className="hdot on"></i><h2>음성 · 감시 설정</h2>
        <span className="spacer"></span>
        <MoreButton open={more} onClick={toggleMore} />
      </div>
      <div className="more" hidden={!more}>
        <div className="fields">
          <label className="field">목소리 <select value={cfg.voice} onChange={e => configStore.update(c => { c.voice = e.target.value; })}>
            {voices.map(v => <option key={v.name} value={v.name}>{`${v.name} (${v.lang})`}</option>)}
          </select></label>
          <label className="field">속도 <NumInput min="0.5" max="2" step="0.1" value={cfg.rate} onValue={v => configStore.update(c => { c.rate = v; })} /></label>
          <label className="field">검사 주기(초) <NumInput min="0.3" step="0.1" value={cfg.tick} onValue={v => configStore.update(c => { c.tick = v; })} onCommit={m.restartMonitor} /></label>
          <label className="field">숫자 밝기 기준(0–255) <NumInput min="50" max="250" value={cfg.ocrThresh} onValue={v => configStore.update(c => { c.ocrThresh = v; })} /></label>
        </div>
        <p className="hint">숫자 밝기 기준: 게임 숫자(흰 글씨)만 남기는 기준입니다. 판독값이 자주 틀리면 150~210 사이로 바꿔 보세요.</p>
      </div>
    </section>
  );
}
