const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const DEV_URL = process.env.ELECTRON_DEV_URL;
const IS_DEV = Boolean(DEV_URL);
const DIST_PATH = path.join(__dirname, "..", "dist");
const APP_URL_ROOT = pathToFileURL(`${DIST_PATH}${path.sep}`).href;

app.commandLine.appendSwitch("enable-gpu-rasterization");
app.commandLine.appendSwitch("enable-zero-copy");
app.commandLine.appendSwitch("high-dpi-support", "1");

if (process.platform === "win32") {
  app.commandLine.appendSwitch("force_high_performance_gpu");
  app.setAppUserModelId("games.swarmsurvivors.game");
}

let mainWindow = null;

const IPC = Object.freeze({
  getWindowState: "desktop:get-window-state",
  setFullscreen: "desktop:set-fullscreen",
  toggleFullscreen: "desktop:toggle-fullscreen",
  setWindowSize: "desktop:set-window-size",
  quit: "desktop:quit",
  fullscreenChanged: "desktop:fullscreen-changed",
  getMetrics: "desktop:get-metrics",
});

function isTrustedDevUrl(url) {
  if (!IS_DEV) return false;

  try {
    const requested = new URL(url);
    const configured = new URL(DEV_URL);
    return requested.origin === configured.origin;
  } catch {
    return false;
  }
}

function isTrustedAppUrl(url) {
  if (IS_DEV) return isTrustedDevUrl(url);
  return url.startsWith(APP_URL_ROOT);
}

function requireTrustedWindow(event) {
  const window = mainWindow;
  const senderUrl = event.senderFrame?.url ?? event.sender.getURL();
  if (
    !window ||
    window.isDestroyed() ||
    event.sender !== window.webContents ||
    !isTrustedAppUrl(senderUrl)
  ) {
    throw new Error("Unauthorized desktop IPC sender");
  }
  return window;
}

function windowState(window) {
  const [width, height] = window.getContentSize();
  return {
    isFullScreen: window.isFullScreen(),
    isMaximized: window.isMaximized(),
    isMinimized: window.isMinimized(),
    isFocused: window.isFocused(),
    isVisible: window.isVisible(),
    width,
    height,
  };
}

ipcMain.handle(IPC.getWindowState, (event) =>
  windowState(requireTrustedWindow(event))
);

ipcMain.handle(IPC.setFullscreen, (event, enabled) => {
  const window = requireTrustedWindow(event);
  if (typeof enabled !== "boolean")
    throw new TypeError("Fullscreen state must be a boolean");
  window.setFullScreen(enabled);
  return enabled;
});

ipcMain.handle(IPC.toggleFullscreen, (event) => {
  const window = requireTrustedWindow(event);
  const enabled = !window.isFullScreen();
  window.setFullScreen(enabled);
  return enabled;
});

ipcMain.handle(IPC.setWindowSize, (event, width, height) => {
  const window = requireTrustedWindow(event);
  const supported =
    (width === 1280 && height === 720) ||
    (width === 1600 && height === 900) ||
    (width === 1920 && height === 1080);
  if (!supported) throw new RangeError("Unsupported desktop window size");
  if (window.isFullScreen()) window.setFullScreen(false);
  window.setContentSize(width, height, true);
  window.center();
  return windowState(window);
});

ipcMain.handle(IPC.quit, (event) => {
  requireTrustedWindow(event);
  app.quit();
});

ipcMain.handle(IPC.getMetrics, (event) => {
  requireTrustedWindow(event);
  let cpuPercent = 0;
  let processMemKb = 0;
  let gpuProcMemKb = 0;
  for (const metric of app.getAppMetrics()) {
    cpuPercent += metric.cpu.percentCPUUsage;
    processMemKb += metric.memory?.workingSetSize ?? 0;
    if (metric.type === "GPU")
      gpuProcMemKb += metric.memory?.workingSetSize ?? 0;
  }
  const sys = process.getSystemMemoryInfo();
  return {
    cpuPercent: Math.round(cpuPercent * 10) / 10,
    processMemMb: Math.round(processMemKb / 1024),
    gpuProcMemMb: Math.round(gpuProcMemKb / 1024),
    systemTotalMb: Math.round(sys.total / 1024),
    systemFreeMb: Math.round(sys.free / 1024),
  };
});

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1600,
    height: 900,
    minWidth: 960,
    minHeight: 540,
    backgroundColor: "#0b0e14",
    autoHideMenuBar: true,
    show: false,
    fullscreenable: true,
    useContentSize: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      devTools: IS_DEV,
      backgroundThrottling: false,
    },
  });

  mainWindow.once("ready-to-show", () => {
    mainWindow?.show();
    mainWindow?.focus();
  });

  const fullscreenWindow = mainWindow;
  const emitFullscreenState = () => {
    if (
      fullscreenWindow.isDestroyed() ||
      fullscreenWindow.webContents.isDestroyed()
    )
      return;
    fullscreenWindow.webContents.send(
      IPC.fullscreenChanged,
      fullscreenWindow.isFullScreen()
    );
  };
  fullscreenWindow.on("enter-full-screen", emitFullscreenState);
  fullscreenWindow.on("leave-full-screen", emitFullscreenState);

  mainWindow.webContents.setWindowOpenHandler(() => ({ action: "deny" }));

  mainWindow.webContents.on("will-navigate", (event, url) => {
    if (!isTrustedAppUrl(url)) event.preventDefault();
  });

  mainWindow.webContents.on("before-input-event", (event, input) => {
    if (input.type !== "keyDown") return;

    if (input.key === "F11") {
      event.preventDefault();
      mainWindow?.setFullScreen(!mainWindow.isFullScreen());
    }
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  if (IS_DEV) {
    void mainWindow.loadURL(DEV_URL);
  } else {
    void mainWindow.loadFile(path.join(DIST_PATH, "index.html"));
  }
}

app.whenReady().then(() => {
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
