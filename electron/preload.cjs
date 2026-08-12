const { contextBridge, ipcRenderer } = require("electron");

const IPC = Object.freeze({
  getWindowState: "desktop:get-window-state",
  setFullscreen: "desktop:set-fullscreen",
  toggleFullscreen: "desktop:toggle-fullscreen",
  setWindowSize: "desktop:set-window-size",
  quit: "desktop:quit",
  fullscreenChanged: "desktop:fullscreen-changed",
  getMetrics: "desktop:get-metrics",
});

const windowControls = Object.freeze({
  getState: () => ipcRenderer.invoke(IPC.getWindowState),
  setFullscreen: (enabled) => {
    if (typeof enabled !== "boolean")
      return Promise.reject(
        new TypeError("Fullscreen state must be a boolean")
      );
    return ipcRenderer.invoke(IPC.setFullscreen, enabled);
  },
  toggleFullscreen: () => ipcRenderer.invoke(IPC.toggleFullscreen),
  setWindowSize: (width, height) => {
    const supported =
      (width === 1280 && height === 720) ||
      (width === 1600 && height === 900) ||
      (width === 1920 && height === 1080);
    if (!supported)
      return Promise.reject(new RangeError("Unsupported desktop window size"));
    return ipcRenderer.invoke(IPC.setWindowSize, width, height);
  },
  quit: () => ipcRenderer.invoke(IPC.quit),
  getMetrics: () => ipcRenderer.invoke(IPC.getMetrics),
  onFullscreenChanged: (listener) => {
    if (typeof listener !== "function")
      throw new TypeError("Fullscreen listener must be a function");
    const wrapped = (_event, enabled) => listener(Boolean(enabled));
    ipcRenderer.on(IPC.fullscreenChanged, wrapped);
    return () => ipcRenderer.removeListener(IPC.fullscreenChanged, wrapped);
  },
});

contextBridge.exposeInMainWorld(
  "desktopRuntime",
  Object.freeze({
    isDesktop: true,
    platform: process.platform,
    versions: Object.freeze({
      chrome: process.versions.chrome,
      electron: process.versions.electron,
    }),
    window: windowControls,
  })
);
