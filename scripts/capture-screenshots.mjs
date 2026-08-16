import { chromium } from "playwright";
import { spawn, execSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.join(root, "docs", "screenshots");
const PORT = 5199;
const BASE = `http://localhost:${PORT}`;

mkdirSync(outDir, { recursive: true });

console.log("[screenshots] building production bundle...");
execSync("npm run build", { cwd: root, stdio: "inherit" });

const server = spawn("npx", ["vite", "preview", "--port", String(PORT), "--strictPort"], {
  cwd: root,
  stdio: "ignore",
});

async function waitForServer(timeoutMs = 30000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(BASE);
      if (res.ok) return;
    } catch (e) {
      void e;
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error("preview server did not start");
}

let browser;
try {
  await waitForServer();
  browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });

  await page.goto(BASE);
  await page.waitForSelector("#menu-overlay.visible h1");
  await page.screenshot({ path: path.join(outDir, "menu.png") });
  console.log("[screenshots] captured menu.png");

  await page.click('button[data-action="play"]');
  await page.waitForSelector("[data-weapon]");
  await page.evaluate(() => document.querySelector("[data-weapon]").click());
  await page.waitForTimeout(4000);
  await page.keyboard.down("d");
  await page.waitForTimeout(2500);
  await page.keyboard.up("d");
  await page.keyboard.down("w");
  await page.waitForTimeout(2500);
  await page.keyboard.up("w");
  await page.waitForTimeout(4000);
  await page.screenshot({ path: path.join(outDir, "gameplay.png") });
  console.log("[screenshots] captured gameplay.png");
} finally {
  await browser?.close();
  server.kill();
}
