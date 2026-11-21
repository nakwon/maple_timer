import { useEffect, useState } from 'react';
import { meso, parseMeso } from '../format';
import { useToggle } from '../hooks';
import { computeSplit, MAX_MEMBERS, sendRate, splitStore, useSplit, type Member } from '../split';
import { MoreButton, NumInput } from './controls';

const pct = (r: number) => `${(r * 100).toFixed(2).replace(/\.?0+$/, '')}%`;

function PriceInput() {
  const { price } = useSplit();
  const [text, setText] = useState(() => price ? String(price) : '');
  const parsed = parseMeso(text);
  return (
    <label className="price">
      <span className="lbl">경매장에 올린 금액</span>
      <input type="text" inputMode="numeric" placeholder="예: 1200000000 또는 12억" value={text}
        className={parsed == null ? 'bad' : ''}
        onChange={e => { setText(e.target.value); const v = parseMeso(e.target.value); if (v != null) splitStore.update(s => { s.price = v; }); }} />
      <span className="price-read">{parsed == null ? '숫자나 "12억 3456만"처럼 입력해 주세요' : `${meso(price)} 메소`}</span>
    </label>
  );
}

function CopyButton({ value }: { value: number }) {
  const [done, setDone] = useState(false);
  useEffect(() => { if (!done) return; const t = setTimeout(() => setDone(false), 1200); return () => clearTimeout(t); }, [done]);
  return (
    <button className="copy" title="숫자만 복사" onClick={() => navigator.clipboard?.writeText(String(value)).then(() => setDone(true), () => {})}>
      {done ? '복사됨' : '복사'}
    </button>
  );
}

const editMember = (id: number, mutate: (m: Member) => void) =>
  splitStore.update(s => { const m = s.members.find(x => x.id === id); if (m) mutate(m); });

export function SplitPanel() {
  const st = useSplit(), r = computeSplit(st), [more, toggleMore] = useToggle();
  const byId = new Map(r.payouts.map(p => [p.member.id, p]));
  const sellerJoined = st.members.some(m => m.id === st.sellerId && m.joined);
  const setFee = (k: keyof typeof st.fees) => (v: number) => splitStore.update(s => { s.fees[k] = v / 100; });

  return (
    <section className="card split">
      <div className="card-head">
        <h2>보스 드롭 분배 계산기</h2>
        <span className="spacer"></span>
        <span className="lbl">수수료까지 모두 같이 부담해서 전원이 똑같이 받도록 나눕니다</span>
      </div>

      <div className="split-top">
        <PriceInput />
        <div className="split-sum">
          <div className="stat"><span className="lbl">경매장 수수료 ({pct(st.fees.auction)})</span><span className="val">{meso(r.auctionFee)}</span></div>
          <div className="stat"><span className="lbl">실수령액</span><span className="val">{meso(r.net)}</span></div>
          <div className="stat"><span className="lbl">참여 인원</span><span className="val">{r.count}명</span></div>
          <div className="stat hero"><span className="lbl">1인당 최종 메소</span><span className="val">{meso(r.share)}</span></div>
        </div>
      </div>
      {!sellerJoined && <p className="split-warn">판매자를 고르고 참여에 체크해 주세요.</p>}

      <div className="mrow mhead">
        <span>판매자</span><span>이름</span><span>참여</span><span>다른 서버</span>
        <span className="num">보내야 할 금액</span><span className="num">전달 수수료</span><span></span>
      </div>
      {st.members.map(m => {
        const p = byId.get(m.id);
        return (
          <div key={m.id} className={`mrow${m.joined ? '' : ' out'}${m.id === st.sellerId ? ' seller' : ''}`}>
            <input type="radio" name="seller" aria-label="판매자" checked={m.id === st.sellerId} onChange={() => splitStore.update(s => { s.sellerId = m.id; })} />
            <input type="text" className="mname" value={m.name} onChange={e => editMember(m.id, x => { x.name = e.target.value; })} />
            <input type="checkbox" className="switch" aria-label="참여" checked={m.joined} onChange={e => editMember(m.id, x => { x.joined = e.target.checked; })} />
            <label className="other">
              <input type="checkbox" checked={m.otherServer} disabled={m.id === st.sellerId} onChange={e => editMember(m.id, x => { x.otherServer = e.target.checked; })} />
              {m.id !== st.sellerId && m.joined && <small>{pct(sendRate(m, st.fees))}</small>}
            </label>
            <span className="num send">
              {!p ? <i>—</i> : p.seller ? <i>보낼 필요 없음</i> : <>{meso(p.send)}<CopyButton value={p.send} /></>}
            </span>
            <span className="num fee">{p && !p.seller ? meso(p.fee) : ''}</span>
            <button className="icon-btn" aria-label="파티원 빼기" disabled={st.members.length <= 1}
              onClick={() => splitStore.update(s => {
                s.members = s.members.filter(x => x.id !== m.id);
                if (s.sellerId === m.id) s.sellerId = s.members[0].id;
              })}>×</button>
          </div>
        );
      })}

      <div className="split-foot">
        <button className="btn" disabled={st.members.length >= MAX_MEMBERS}
          onClick={() => splitStore.update(s => {
            const id = Math.max(0, ...s.members.map(x => x.id)) + 1;
            s.members.push({ id, name: `파티원${s.members.length}`, joined: true, otherServer: false });
          })}>+ 파티원 추가</button>
        <span className="spacer"></span>
        <span className="lbl">전달 수수료 합계 <b>{meso(r.totalSendFee)}</b></span>
        <span className="lbl">판매자가 남기는 금액 <b>{meso(r.sellerKeeps)}</b></span>
        <MoreButton open={more} onClick={toggleMore} />
      </div>

      <div className="more" hidden={!more}>
        <div className="fields">
          <label className="field">경매장 판매 수수료 (%)<NumInput min="0" max="100" step="0.1" value={st.fees.auction * 100} onValue={setFee('auction')} /></label>
          <label className="field">메소 전달 수수료 (%)<NumInput min="0" max="100" step="0.1" value={st.fees.send * 100} onValue={setFee('send')} /></label>
          <label className="field">다른 서버 추가 수수료 (%)<NumInput min="0" max="100" step="0.1" value={st.fees.otherExtra * 100} onValue={setFee('otherExtra')} /></label>
        </div>
        <p className="hint">다른 서버는 전달 수수료를 뗀 뒤 남은 금액에서 추가 수수료를 한 번 더 뗍니다 (5% → 1% = 실제 5.95%). 보낼 금액은 받는 사람이 몫보다 적게 받지 않도록 1메소 단위로 올려서, 판매자 몫은 몇 메소 차이 날 수 있습니다.</p>
      </div>
    </section>
  );
}
