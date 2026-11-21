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

// "12억 3456만", "1,234,567,890", "12.5억" 같은 입력을 메소 숫자로 (못 읽으면 null)
export function parseMeso(text: string): number | null {
  const s = text.replace(/[,\s]/g, '');
  if (!s) return 0;
  const m = s.match(/^(?:(\d+(?:\.\d+)?)억)?(?:(\d+(?:\.\d+)?)만)?(\d+)?$/);
  if (!m || !(m[1] || m[2] || m[3])) return null;
  return Math.round((parseFloat(m[1] || '0') * 1e8) + (parseFloat(m[2] || '0') * 1e4) + parseFloat(m[3] || '0'));
}

export const clock =(ms: number) => ms ? new Date(ms).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '--';
