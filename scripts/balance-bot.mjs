import { chromium } from "playwright";
import { spawn, execSync } from "node:child_process";

const PORT = 5196;
const BASE = `http://localhost:${PORT}`;
const SPEED = process.env.BOT_SPEED ?? "4";
const MAX_WALL_SECONDS = Number(process.env.BOT_WALL ?? 240);

execSync("npm run build", { cwd: process.cwd(), stdio: "ignore" });
const server = spawn("npx", ["vite", "preview", "--port", String(PORT), "--strictPort"], {
  cwd: process.cwd(),
  stdio: "ignore",
});
await new Promise((r) => setTimeout(r, 2500));

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on("pageerror", (e) => console.log("[pageerror]", e.message));

await page.goto(`${BASE}?speed=${SPEED}`);
await page.waitForSelector('#menu-overlay.visible button[data-action="play"]');
await page.click('button[data-action="play"]');
await page.waitForSelector("[data-weapon]");
await page.evaluate(() => document.querySelector("[data-weapon]").click());

const KEYS = ["w", "a", "s", "d"];
const held = new Set();

async function setMove(x, y) {
  const want = new Set();
  if (x > 0.2) want.add("d");
  if (x < -0.2) want.add("a");
  if (y > 0.2) want.add("s");
  if (y < -0.2) want.add("w");
  for (const k of KEYS) {
    if (want.has(k) && !held.has(k)) {
      await page.keyboard.down(k);
      held.add(k);
    } else if (!want.has(k) && held.has(k)) {
      await page.keyboard.up(k);
      held.delete(k);
    }
  }
}

let lastLog = 0;
const start = Date.now();
let final = null;

while ((Date.now() - start) / 1000 < MAX_WALL_SECONDS) {
  await page.waitForTimeout(150);

  const draft = await page.$("#menu-overlay.visible [data-draft]");
  if (draft) {
    await page.evaluate(() => {
      const cards = document.querySelectorAll("[data-draft]");
      cards[Math.floor(Math.random() * cards.length)].click();
    });
    continue;
  }

  const s = await page.evaluate(() => window.__state?.());
  if (!s) continue;
  final = s;

  if (!s.alive || s.victory) break;

  if (s.nearest && s.nearest.d < 400) {
    const away = Math.atan2(-s.nearest.dy, -s.nearest.dx);
    const tangent = away + Math.PI / 3;
    await setMove(Math.cos(tangent), Math.sin(tangent));
  } else {
    const t = s.time / 2;
    await setMove(Math.cos(t), Math.sin(t));
  }

  if (s.time - lastLog >= 30) {
    lastLog = s.time;
    console.log(
      `[bot] t=${s.time.toFixed(0)}s hp=${Math.ceil(s.hp)}/${s.maxHp} lv=${s.level} kills=${s.kills} enemies=${s.enemies} boss=${s.boss ?? "-"} [${s.weapons.join(", ")}]`,
    );
  }
}

console.log("[bot] final:", JSON.stringify(final));
if (final?.victory) console.log("[bot] RESULT: VICTORY");
else if (final && !final.alive) console.log(`[bot] RESULT: died at ${final.time.toFixed(0)}s lv${final.level}`);

await browser.close();
server.kill();
