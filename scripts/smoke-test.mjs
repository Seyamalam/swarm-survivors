import { chromium } from "playwright";
import { spawn, execSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PORT = 5198;
const BASE = `http://localhost:${PORT}`;
const RUN_SECONDS = Number(process.env.SMOKE_SECONDS ?? 120);

console.log("[smoke] building...");
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
let failures = 0;
try {
  await waitForServer();
  browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on("pageerror", (err) => {
    console.error("[smoke] page error:", err.message);
    failures++;
  });

  await page.goto(BASE);
  await page.waitForSelector('#menu-overlay.visible button[data-action="play"]');
  await page.click('button[data-action="play"]');

  const dirs = ["d", "s", "a", "w"];
  let dirIndex = 0;
  let draftsPicked = 0;
  let sawVictoryOrGameOver = false;

  await page.keyboard.down("d");
  const start = Date.now();
  while ((Date.now() - start) / 1000 < RUN_SECONDS) {
    await page.waitForTimeout(1000);

    const draft = await page.$("#menu-overlay.visible [data-draft]");
    if (draft) {
      draftsPicked++;
      await page.evaluate(() => {
        const cards = document.querySelectorAll("[data-draft]");
        const pick = cards[Math.floor(Math.random() * cards.length)];
        pick.click();
      });
      console.log(`[smoke] draft #${draftsPicked} picked`);
      continue;
    }

    const overlayTitle = await page
      .$eval("#menu-overlay.visible h1", (el) => el.textContent)
      .catch(() => null);
    if (overlayTitle === "Game Over" || overlayTitle === "Victory!") {
      console.log(`[smoke] run ended: ${overlayTitle}`);
      sawVictoryOrGameOver = true;
      break;
    }

    await page.keyboard.up(dirs[dirIndex % 4]);
    dirIndex++;
    await page.keyboard.down(dirs[dirIndex % 4]);

    if (dirIndex % 8 === 0) {
      const hud = await page.$eval("#hud", (el) => el.textContent?.split("fps")[0] ?? "");
      const level = await page.$eval("#leveltag", (el) => el.textContent);
      console.log(`[smoke] ${level} | ${hud.trim()}`);
    }
  }

  console.log(`[smoke] finished: drafts=${draftsPicked} ended=${sawVictoryOrGameOver}`);
  if (draftsPicked === 0 && !sawVictoryOrGameOver) {
    console.error("[smoke] FAIL: no draft appeared and run never ended");
    failures++;
  }
} finally {
  await browser?.close();
  server.kill();
}

process.exit(failures > 0 ? 1 : 0);
