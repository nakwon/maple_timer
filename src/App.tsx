import { useEffect, useState } from 'react';
import { BoosterPanel } from './components/BoosterPanel';
import { BuffPanel } from './components/BuffPanel';
import { HelpCard, SubBar, TopBar } from './components/Header';
import { LogPanel } from './components/LogPanel';
import { RunePanel } from './components/RunePanel';
import { SettingsPanel } from './components/SettingsPanel';
import { SetupOverlay } from './components/SetupOverlay';
import { SplitPanel } from './components/SplitPanel';
import { useToggle } from './hooks';

type Tab = 'alarm' | 'split';
const TABS: [Tab, string][] = [['alarm', '⏰ 알리미'], ['split', '💰 분배 계산기']];
const tabFromHash = (): Tab => location.hash === '#split' ? 'split' : 'alarm';

function App() {
  const [help, toggleHelp] = useToggle();
  const [tab, setTab] = useState(tabFromHash);
  useEffect(() => {
    const onHash = () => setTab(tabFromHash());
    addEventListener('hashchange', onHash);
    return () => removeEventListener('hashchange', onHash);
  }, []);
  return (
    <>
      <div className="shell">
        <TopBar onHelp={toggleHelp} />
        <HelpCard hidden={!help} />
        <nav className="tabs">
          {TABS.map(([id, label]) => (
            <a key={id} href={id === 'alarm' ? '#' : `#${id}`} className={tab === id ? 'tab on' : 'tab'} onClick={() => setTab(id)}>{label}</a>
          ))}
        </nav>
        {/* 감시는 탭과 상관없이 계속 돌아야 하므로 알리미 화면은 숨기기만 함 */}
        <div hidden={tab !== 'alarm'}>
          <SubBar />
          <RunePanel />
          <BoosterPanel />
          <BuffPanel />
          <SettingsPanel />
          <LogPanel />
        </div>
        {tab === 'split' && <SplitPanel />}
      </div>
      <SetupOverlay />
    </>
  );
}

export default App;
