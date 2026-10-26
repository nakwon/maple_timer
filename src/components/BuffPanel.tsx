import { configStore } from '../config';
import { clock, fmt } from '../format';
import { useConfig, useMonitor, useToggle } from '../hooks';
import { buffLeft, type BuffTimer } from '../monitor/buffs';
import { BUFF_ROW } from '../vision/buffGrid';
import { Card, GatedStatus, MoreButton, NumInput, Status, Switch } from './controls';

// 버프마다 key를 고정해 두어 매초 다시 그려도 썸네일이 깜빡이지 않음
function BuffList({ list, now }: { list: BuffTimer[]; now: number }) {
  const sorted = list.slice().sort((a, b) => buffLeft(a, now) - buffLeft(b, now));
  return (
    <div className="tracked" id="buffList">
      {sorted.map(t => (
        <div className="tbuff" key={t.id}>
          <img className="thumb" src={t.thumb} alt="" />
          <div className="stat"><span className="lbl">남은 시간</span><span className="val">{t.exact ? fmt(buffLeft(t, now)) : `약 ${t.min}분`}</span></div>
        </div>
      ))}
    </div>
  );
}

export function BuffPanel() {
  const cfg = useConfig(), m = useMonitor(), [more, toggleMore] = useToggle();
  const F = cfg.buff, { buffs, monitoring } = m;
  const list = buffs.timers.filter(t => t.hits >= 2); // 확인된 버프만 표시
  return (
    <Card id="buffPanel">
      <div className="card-head">
        <i className={F.enabled ? 'hdot on' : 'hdot'} id="dot-buffs"></i><h2>버프 종료 알림</h2>
        <span className="spacer"></span>
      </div>
      <div className="item">
        <div className="item-row">
          <Switch checked={F.enabled} onChange={v => configStore.update(c => { c.buff.enabled = v; })} />
          <div className="ident">버프칸 3번째 화살표 줄</div>
          <div className="stat"><span className="lbl">알림 시점</span><span className="val"><NumInput className="inline" min="0" value={F.warnBefore} onValue={v => configStore.update(c => { c.buff.warnBefore = v; })} />초 전</span></div>
          <div className="stat"><span className="lbl">함께 꺼지는 버프</span><span className="val"><NumInput className="inline" min="1" max="12" value={F.minCount} onValue={v => configStore.update(c => { c.buff.minCount = Math.max(1, Math.round(v)); })} />개 이상</span></div>
          <div className="stat"><span className="lbl">추적 중</span><span className="val">{monitoring ? `${list.length}개` : '--'}</span></div>
          <div className="stat"><span className="lbl">마지막 알림</span><span className="val">{clock(buffs.lastAlertAt)}</span></div>
          <div className="status">
            <GatedStatus enabled={F.enabled}>
              {!buffs.row ? <Status cls="warn" title={`${BUFF_ROW}번째 줄을 못 찾음`} sub={`오른쪽 끝 화살표 ${buffs.arrows.length}개 보임`} />
                : <Status cls="ok" title="인식 중" sub={`${cfg.buffRegion ? '직접 지정한 줄' : `${BUFF_ROW}번째 화살표 줄`} · 숫자 ${list.length}개 읽음`} />}
            </GatedStatus>
          </div>
          <MoreButton open={more} onClick={toggleMore} />
        </div>
        <div className="more" hidden={!more}>
          <div className="actions">
            <button className="btn" onClick={() => m.openSetup('view')}>찾은 줄 확인</button>
            <button className="btn" onClick={() => m.openSetup('buffRegion')}>감시 줄 직접 지정</button>
            <button className="btn" onClick={m.autoBuffRow}>자동(3번째 화살표)으로 되돌리기</button>
            <button className="btn" title="지금 공유 화면(PNG)과 판별 결과(JSON)를 파일로 저장" onClick={m.saveDiagnostics}>진단 저장</button>
          </div>
          <p className="hint">오른쪽 끝 흰색 "&gt;" 화살표를 위에서부터 세어 3번째 화살표가 있는 줄만 봅니다. 남은 시간은 4가지로 읽습니다: 아이콘 왼쪽 아래 작은 숫자(예: 21) = 남은 분, 가운데 큰 숫자 “3:05” = 분:초, “45” = 초, “7” = 초.</p>
        </div>
        <BuffList list={monitoring ? list : []} now={m.now} />
      </div>
    </Card>
  );
}
