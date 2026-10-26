import { BoosterPanel } from './components/BoosterPanel';
import { BuffPanel } from './components/BuffPanel';
import { HelpCard, SubBar, TopBar } from './components/Header';
import { LogPanel } from './components/LogPanel';
import { RunePanel } from './components/RunePanel';
import { SettingsPanel } from './components/SettingsPanel';
import { SetupOverlay } from './components/SetupOverlay';
import { useToggle } from './hooks';

function App() {
  const [help, toggleHelp] = useToggle();
  return (
    <>
      <div className="shell">
        <TopBar onHelp={toggleHelp} />
        <HelpCard hidden={!help} />
        <SubBar />
        <RunePanel />
        <BoosterPanel />
        <BuffPanel />
        <SettingsPanel />
        <LogPanel />
      </div>
      <SetupOverlay />
    </>
  );
}

export default App;
