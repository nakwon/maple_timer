import { configStore } from '../config';
import { useConfig, useMonitor } from '../hooks';
import { NumInput } from './controls';

export function TopBar({ onHelp }: { onHelp(): void }) {
  const m = useMonitor();
  return (
    <header className="topbar">
      <h1>🍁 메이플 알리미</h1>
      <button className="link" onClick={onHelp}>사용 가이드</button>
      <button className={m.monitoring ? 'share-pill live' : 'share-pill'} onClick={m.toggleShare}>
        <span>{m.monitoring ? '● 감시 중' : '● 화면 공유 필요'}</span><span className="act">{m.monitoring ? '중지' : '시작'}</span>
      </button>
    </header>
  );
}

export function HelpCard({ hidden }: { hidden: boolean }) {
  return (
    <section className="card" id="help" hidden={hidden}>
      <div className="card-head"><h2>사용 가이드</h2></div>
      <ol className="steps">
        <li>오른쪽 위 <b>시작</b>으로 메이플 창을 공유하면 바로 감시가 시작됩니다. 공유를 끝내면 감시도 꺼집니다. (게임 화면은 따로 보여주지 않아요)</li>
        <li>룬 알림은 <b>미니맵 지정</b>만 하면 됩니다. 지정을 누르면 그 순간의 스냅샷이 뜨고, 드래그해서 고르면 됩니다.</li>
        <li>부스터는 화면 위쪽 가운데의 타이머 숫자를, 버프는 오른쪽 위 버프칸에서 <b>오른쪽 끝 "&gt;" 화살표 기준 3번째 줄</b> 아이콘들의 남은 시간 숫자를 <b>자동으로</b> 읽습니다.</li>
        <li>버프 숫자를 읽으려면 게임 설정 &gt; UI &gt; <b>퀵슬롯&amp;버프 시간표시</b>를 <b>[중앙, 크게]</b>로, 표시방식을 <b>[분 + 초]</b>로 맞춰 주세요.</li>
        <li>이 탭은 최소화하지 말고 별도 창으로 띄워 두세요.</li>
      </ol>
    </section>
  );
}

export function SubBar() {
  const cfg = useConfig(), m = useMonitor();
  return (
    <div className="subbar">
      <span className="title">알림</span>
      <label>
        🔊 마스터 볼륨 <NumInput type="range" min="0" max="1" step="0.05" value={cfg.volume} onValue={v => configStore.update(c => { c.volume = v; })} />{' '}
        <b>{Math.round(cfg.volume * 100)}%</b>
      </label>
      <button className="link" onClick={m.testVoice}>음성 테스트</button>
    </div>
  );
}
