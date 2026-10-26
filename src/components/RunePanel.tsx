import { configStore, type RuneConfig } from '../config';
import { clock } from '../format';
import { useConfig, useMonitor, useToggle } from '../hooks';
import { RUNE_COLOR } from '../vision/minimap';
import { Card, GatedStatus, MoreButton, NumInput, Status, Switch } from './controls';

const setRune = (fn: (R: RuneConfig) => void) => configStore.update(c => fn(c.rune));

export function RunePanel() {
  const cfg = useConfig(), m = useMonitor(), [more, toggleMore] = useToggle();
  const R = cfg.rune, { rune, monitoring } = m;
  return (
    <Card id="runePanel">
      <div className="card-head">
        <i className={R.enabled ? 'hdot on' : 'hdot'} id="dot-rune"></i><h2>룬 알림</h2>
        <button className="link" onClick={() => m.openSetup('view')}>현재 화면으로 확인</button>
        <span className="spacer"></span>
      </div>
      <div className="item">
        <div className="item-row">
          <Switch checked={R.enabled} onChange={v => setRune(r => { r.enabled = v; })} />
          <div className="ident"><span><span className="swatch" style={{ background: `rgb(${RUNE_COLOR})` }}></span>미니맵 <span id="mmInfo">{rune.mm ? `${rune.mm.w}×${rune.mm.h}` : '안 보임'}</span></span></div>
          <div>
            <span className={monitoring && rune.present ? 'pillbox hit' : 'pillbox'} id="runeDetect">
              {!monitoring ? '감지 없음' : rune.present ? '룬 있음' : rune.streak ? `확인 중 ${rune.streak}/${R.frames}` : '감지 없음'}
            </span>
          </div>
          <div className="stat"><span className="lbl">반복</span><span className="val"><NumInput className="inline" min="0" value={R.repeat} onValue={v => setRune(r => { r.repeat = v; })} />초</span></div>
          <div className="stat"><span className="lbl">연속 판정</span><span className="val"><NumInput className="inline" min="1" max="20" value={R.frames} onValue={v => setRune(r => { r.frames = Math.max(1, Math.round(v)); })} />회</span></div>
          <div className="stat"><span className="lbl">마지막 알림</span><span className="val">{clock(rune.lastAlert)}</span></div>
          <div className="status">
            <GatedStatus enabled={R.enabled}>
              {!rune.mm ? <Status cls="warn" title="미니맵이 안 보임 (미니맵을 펼쳐 두세요)" /> : <Status cls="ok" title="감시 중" />}
            </GatedStatus>
          </div>
          <MoreButton open={more} onClick={toggleMore} />
        </div>
        <div className="more" hidden={!more}>
          <div className="fields">
            <label className="field">룬 색 <span>rgb(201, 118, 225) 고정</span></label>
            <label className="field">색 허용 오차 <NumInput min="1" max="200" value={R.tol} onValue={v => setRune(r => { r.tol = v; })} /></label>
            <label className="field">덩어리 최소 픽셀 수 <NumInput min="1" value={R.minPx} onValue={v => setRune(r => { r.minPx = v; })} /></label>
            <label className="field">덩어리 최대 픽셀 수 <NumInput min="1" value={R.maxPx} onValue={v => setRune(r => { r.maxPx = v; })} /></label>
            <label className="field">덩어리 최대 크기(px) <NumInput min="2" value={R.maxSize} onValue={v => setRune(r => { r.maxSize = v; })} /></label>
            <label className="field">음성 문구 <input type="text" className="long" value={R.message} onChange={e => setRune(r => { r.message = e.target.value; })} /></label>
          </div>
          <p className="hint">미니맵은 헤더·버튼을 빼고 지도 부분만 잡아 주세요.</p>
          <p className="detail">{monitoring ? `같은 색 픽셀 ${rune.count}개 · 룬 모양 덩어리 ${rune.blobs ?? 0}개 · 걸러낸 덩어리 ${rune.rejected ?? 0}개` : ''}</p>
        </div>
      </div>
    </Card>
  );
}
