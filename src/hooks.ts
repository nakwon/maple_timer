import { useState, useSyncExternalStore } from 'react';
import { configStore } from './config';
import { monitor } from './monitor/Monitor';

export const useConfig = () => useSyncExternalStore(configStore.subscribe, configStore.get);

// 감시 상태는 Monitor 안에서 바뀌므로 버전 번호로 다시 그림
export function useMonitor() {
  useSyncExternalStore(monitor.subscribe, monitor.getVersion);
  return monitor;
}

export function useToggle(initial = false) {
  const [on, setOn] = useState(initial);
  return [on, () => setOn(v => !v)] as const;
}
