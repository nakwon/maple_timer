// 보스 드롭 분배 계산: 경매장 수수료를 뺀 실수령액을, 전달 수수료까지 모두 같이 부담해서
// 판매자를 포함한 참여자 전원이 똑같은 최종 메소를 갖도록 나눔
import { useSyncExternalStore } from 'react';

export interface Member { id: number; name: string; joined: boolean; otherServer: boolean }
export interface Fees { auction: number; send: number; otherExtra: number } // 비율 (0.05 = 5%)
export interface SplitState { price: number; sellerId: number; members: Member[]; fees: Fees }

export const MAX_MEMBERS = 6;

// 다른 서버로 보낼 때는 전달 수수료를 뗀 뒤 남은 금액에서 추가 수수료를 한 번 더 뗌
export const sendRate = (m: Member, f: Fees) => m.otherServer ? 1 - (1 - f.send) * (1 - f.otherExtra) : f.send;

export interface Payout { member: Member; seller: boolean; rate: number; send: number; final: number; fee: number }
export interface SplitResult { auctionFee: number; net: number; share: number; sellerKeeps: number; totalSendFee: number; count: number; payouts: Payout[] }

// 부동소수 오차로 정확히 나누어떨어지는 값이 1메소 넘어가지 않게 소수 둘째 자리에서 먼저 반올림
const ceilMeso = (x: number) => Math.ceil(Math.round(x * 100) / 100);
const floorMeso = (x: number) => Math.floor(Math.round(x * 100) / 100);

export function computeSplit({ price, sellerId, members, fees }: SplitState): SplitResult {
  const auctionFee = Math.round(price * fees.auction), net = price - auctionFee;
  const joined = members.filter(m => m.joined);
  const sellerIn = joined.some(m => m.id === sellerId);
  const receivers = joined.filter(m => m.id !== sellerId);
  // 받는 사람 i에게 x를 남기려면 x / (1 - 수수료율)을 보내야 하므로, net = x + Σ x / (1 - r_i)
  const share = sellerIn ? Math.floor(net / (1 + receivers.reduce((s, m) => s + 1 / (1 - sendRate(m, fees)), 0))) : 0;
  const payouts: Payout[] = receivers.map(m => {
    const rate = sendRate(m, fees), send = ceilMeso(share / (1 - rate)), final = floorMeso(send * (1 - rate));
    return { member: m, seller: false, rate, send, final, fee: send - final };
  });
  const sellerKeeps = net - payouts.reduce((s, p) => s + p.send, 0);
  const seller = members.find(m => m.id === sellerId);
  if (seller && sellerIn) payouts.unshift({ member: seller, seller: true, rate: 0, send: 0, final: sellerKeeps, fee: 0 });
  return { auctionFee, net, share, sellerKeeps, totalSendFee: payouts.reduce((s, p) => s + p.fee, 0), count: joined.length, payouts };
}

const KEY = 'maple-split';
const DEFAULTS: SplitState = {
  price: 0, sellerId: 1,
  members: [{ id: 1, name: '본인', joined: true, otherServer: false }, ...[2, 3, 4, 5, 6].map(id => ({ id, name: `파티원${id - 1}`, joined: true, otherServer: false }))],
  fees: { auction: 0.05, send: 0.05, otherExtra: 0.01 },
};

function load(): SplitState {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (s) return { ...structuredClone(DEFAULTS), ...s, fees: { ...DEFAULTS.fees, ...s.fees } };
  } catch { /* 저장된 값이 깨졌으면 기본값 */ }
  return structuredClone(DEFAULTS);
}

let current = load();
const listeners = new Set<() => void>();

export const splitStore = {
  get: () => current,
  subscribe(l: () => void) { listeners.add(l); return () => { listeners.delete(l); }; },
  update(mutate: (s: SplitState) => void) {
    const next = structuredClone(current);
    mutate(next);
    current = next;
    try { localStorage.setItem(KEY, JSON.stringify(current)); } catch { /* 저장 못 해도 계산은 됨 */ }
    listeners.forEach(l => l());
  },
};

export const useSplit = () => useSyncExternalStore(splitStore.subscribe, splitStore.get);
