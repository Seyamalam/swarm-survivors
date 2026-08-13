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
