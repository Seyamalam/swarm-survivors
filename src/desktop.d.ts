interface DesktopMetrics {
  cpuPercent: number;
  processMemMb: number;
  gpuProcMemMb: number;
  systemTotalMb: number;
  systemFreeMb: number;
}

interface DesktopRuntime {
  isDesktop: boolean;
  platform: string;
  window: {
    quit: () => Promise<void>;
    toggleFullscreen: () => Promise<boolean>;
    setWindowSize: (width: number, height: number) => Promise<unknown>;
    getMetrics: () => Promise<DesktopMetrics>;
  };
}

interface PerformanceMemory {
  usedJSHeapSize: number;
  totalJSHeapSize: number;
  jsHeapSizeLimit: number;
}

interface Performance {
  memory?: PerformanceMemory;
}

interface Window {
  desktopRuntime?: DesktopRuntime;
}

interface PerfSnapshot {
  fps: number;
  updateMs: number;
  renderMs: number;
  busyPct: number;
  sprites: number;
  enemies: number;
  kills: number;
  bloom: boolean;
  naive: boolean;
}

interface Window {
  __perf?: () => PerfSnapshot;
}

interface BotState {
  time: number;
  hp: number;
  maxHp: number;
  level: number;
  kills: number;
  enemies: number;
  nearest: { dx: number; dy: number; d: number } | null;
  boss: number | null;
  victory: boolean;
  alive: boolean;
  weapons: string[];
}

interface Window {
  __state?: () => BotState | null;
}
