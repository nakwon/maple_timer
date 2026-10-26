import { useMonitor } from '../hooks';

export function LogPanel() {
  const { logs } = useMonitor();
  return (
    <section className="card">
      <div className="card-head"><i className="hdot on"></i><h2>기록</h2></div>
      <div id="log">{logs.map(l => <div key={l.id}>{l.text}</div>)}</div>
    </section>
  );
}
