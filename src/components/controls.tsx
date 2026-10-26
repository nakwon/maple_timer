import { useEffect, useRef, useState, type InputHTMLAttributes, type ReactNode } from 'react';
import { useMonitor } from '../hooks';
import type { PanelId } from '../monitor/env';

type NumInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> & {
  value: number;
  onValue(v: number): void;
  onCommit?(): void; // 입력을 마쳤을 때 (change 이벤트: 포커스를 옮기거나 Enter)
};

// 숫자 칸: 처음 값만 채워 두고, 입력하는 그대로 보여 주면서 값만 반영 (빈 칸이면 0)
export function NumInput({ value, onValue, onCommit, ...rest }: NumInputProps) {
  const [text, setText] = useState(() => String(value));
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || !onCommit) return;
    el.addEventListener('change', onCommit);
    return () => el.removeEventListener('change', onCommit);
  }, [onCommit]);
  return <input type="number" {...rest} ref={ref} value={text} onChange={e => { setText(e.target.value); onValue(parseFloat(e.target.value) || 0); }} />;
}

export function Switch({ checked, onChange }: { checked: boolean; onChange(v: boolean): void }) {
  return (
    <label className="sw">
      <input type="checkbox" className="switch" checked={checked} onChange={e => onChange(e.target.checked)} />
      <span>{checked ? '켜짐' : '꺼짐'}</span>
    </label>
  );
}

export function MoreButton({ open, onClick }: { open: boolean; onClick(): void }) {
  return <button className="icon-btn" aria-label="설정 펼치기" onClick={onClick}>{open ? '⌄' : '›'}</button>;
}

export function Status({ cls, title, sub }: { cls: '' | 'ok' | 'off' | 'warn'; title: string; sub?: string }) {
  return <><i className={`dot ${cls}`}></i><span><strong>{title}</strong>{sub ? <small>{sub}</small> : null}</span></>;
}

// 꺼져 있거나 공유 전이면 그 상태를, 아니면 children을 보여 줌
export function GatedStatus({ enabled, children }: { enabled: boolean; children: ReactNode }) {
  const m = useMonitor();
  return !enabled ? <Status cls="off" title="꺼짐" /> : !m.monitoring ? <Status cls="" title="화면 공유 필요" /> : children;
}

// 알림이 울리면 3초 동안 테두리를 빨갛게
export function Card({ id, children }: { id: PanelId; children: ReactNode }) {
  const m = useMonitor();
  return <section className={m.flashing.has(id) ? 'card alert' : 'card'} id={id}>{children}</section>;
}
