export const fmt = (s: number) => {
  s = Math.max(0, Math.round(s));
  const h = Math.floor(s / 3600), m = Math.floor(s / 60) % 60, ss = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${String(m).padStart(2, '0')}:${ss}`;
};

// 메소를 억/만 단위로: 1234567890 → "12억 3,456만 7,890"
export const meso = (n: number) => {
  n = Math.round(n);
  const sign = n < 0 ? '-' : '', a = Math.abs(n);
  const eok = Math.floor(a / 1e8), man = Math.floor(a / 1e4) % 1e4, rest = a % 1e4;
  const parts = [eok && `${eok.toLocaleString()}억`, man && `${man.toLocaleString()}만`, rest && rest.toLocaleString()].filter(Boolean);
  return sign + (parts.join(' ') || '0');
};

// 억 단위 입력에서 숫자와 소수점(첫 번째 하나만) 외에는 지움: "12.5억" → "12.5"
export const eokText = (text: string) => { const [a, ...b] = text.replace(/[^\d.]/g, '').split('.'); return b.length ? `${a}.${b.join('')}` : a; };
// 억 단위 숫자를 메소로: "12.5" → 1250000000 ("."만 있으면 0)
export const parseEok = (text: string) => Math.round((parseFloat(text) || 0) * 1e8);

export const clock =(ms: number) => ms ? new Date(ms).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '--';
