import { configStore } from '../config';
import { clock, fmt } from '../format';
import { useConfig, useMonitor, useToggle } from '../hooks';
import { Card, GatedStatus, MoreButton, NumInput, Status, Switch } from './controls';

export function BoosterPanel() {
  const cfg = useConfig(), m = useMonitor(), [more, toggleMore] = useToggle();
  const B = cfg.booster, { booster, monitoring } = m;
  const located = cfg.boosterBox || booster.box, left = booster.left(m.now);
  return (
    <Card id="boosterPanel">
      <div className="card-head">
        <i className={B.enabled ? 'hdot on' : 'hdot'} id="dot-booster"></i><h2>부스터 종료 알림</h2>
        <span className="spacer"></span>
      </div>
      <div className="item">
        <div className="item-row">
          <Switch checked={B.enabled} onChange={v => configStore.update(c => { c.booster.enabled = v; })} />
          <div className="ident">화면 상단 부스터 타이머</div>
          <div className="stat"><span className="lbl">판독값</span><span className="val">{monitoring && booster.raw ? booster.raw : '--'}</span></div>
          <div className="stat"><span className="lbl">알림 시점</span><span className="val"><NumInput className="inline" min="0" value={B.warnBefore} onValue={v => configStore.update(c => { c.booster.warnBefore = v; })} />초 전</span></div>
          <div className="stat"><span className="lbl">남은 시간</span><span className="val">{monitoring && left != null ? fmt(left) : '--'}</span></div>
          <div className="stat"><span className="lbl">마지막 알림</span><span className="val">{clock(booster.lastAlertAt)}</span></div>
          <div className="status">
            <GatedStatus enabled={B.enabled}>
              {!located ? <Status cls="warn" title="타이머 찾는 중" sub="부스터를 쓰면 자동으로 잡힙니다" />
                : <Status cls="ok" title="추적 중" sub={cfg.boosterBox ? '직접 지정한 위치' : '자동으로 찾은 위치'} />}
            </GatedStatus>
          </div>
          <MoreButton open={more} onClick={toggleMore} />
        </div>
        <div className="more" hidden={!more}>
          <div className="actions">
            <button className="btn" onClick={m.refindBooster}>다시 찾기</button>
            <button className="btn" onClick={() => m.openSetup('booster')}>타이머 위치 직접 지정</button>
            <button className="btn" onClick={m.autoBooster}>자동 찾기로 되돌리기</button>
          </div>
          <p className="hint">화면 위쪽 가운데 “남은시간 92.79 초” 전광판 숫자를 자동으로 찾습니다. 다른 숫자를 잡으면 위치를 직접 지정해 주세요.</p>
        </div>
      </div>
    </Card>
  );
}
