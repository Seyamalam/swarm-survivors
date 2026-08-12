interface DesktopRuntime {
  isDesktop: boolean;
  platform: string;
  window: {
    quit: () => Promise<void>;
    toggleFullscreen: () => Promise<boolean>;
  };
}

interface Window {
  desktopRuntime?: DesktopRuntime;
}
