import { chromium } from "playwright";
import { spawn, execSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.join(root, "docs");
const PORT = 5197;
const BASE = `http://localhost:${PORT}`;
const COUNTS = [500, 2000, 5000, 10000];
const SAMPLE_SECONDS = 8;

mkdirSync(outDir, { recursive: true });

console.log("[bench] building...");
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

  const results = [];
  for (const naive of [true, false]) {
    for (const count of COUNTS) {
      const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
      await page.goto(`${BASE}?stress=${count}${naive ? "&naive=1" : ""}`);
      await page.waitForSelector('#menu-overlay.visible button[data-action="play"]');
      await page.click('button[data-action="play"]');
      await page.waitForTimeout(2000);

      const samples = [];
      for (let i = 0; i < SAMPLE_SECONDS; i++) {
        await page.waitForTimeout(1000);
        samples.push(await page.evaluate(() => window.__perf()));
      }
      await page.close();

      const avg = (key) => samples.reduce((s, x) => s + x[key], 0) / samples.length;
      const row = {
        mode: naive ? "naive" : "optimized",
        enemies: count,
        fps: Math.round(avg("fps")),
        updateMs: Number(avg("updateMs").toFixed(2)),
        renderMs: Number(avg("renderMs").toFixed(2)),
        frameMs: Number((avg("updateMs") + avg("renderMs")).toFixed(2)),
        sprites: Math.round(avg("sprites")),
      };
      results.push(row);
      console.log(
        `[bench] ${row.mode.padEnd(9)} ${String(count).padStart(6)} enemies → ${row.fps} fps, update ${row.updateMs}ms, render ${row.renderMs}ms`,
      );
    }
  }

  writeFileSync(path.join(outDir, "benchmark.json"), JSON.stringify(results, null, 2));

  const lines = [
    "# Benchmark: naive vs optimized renderer + collision",
    "",
    `Measured with \`npm run benchmark\` (headless Chromium, 1280x720, ${SAMPLE_SECONDS}s samples, god-mode stress spawns).`,
    "",
    "| Mode | Enemies | FPS | Update ms | Render ms |",
    "| --- | --- | --- | --- | --- |",
    ...results.map(
      (r) => `| ${r.mode} | ${r.enemies} | ${r.fps} | ${r.updateMs} | ${r.renderMs} |`,
    ),
    "",
    "- **naive**: one draw call per sprite, O(n²) collision and separation",
    "- **optimized**: single instanced draw call, spatial-hash collision, pooled entities, bloom enabled",
  ];
  writeFileSync(path.join(outDir, "benchmark.md"), lines.join("\n") + "\n");
  console.log("[bench] wrote docs/benchmark.md and docs/benchmark.json");
} finally {
  await browser?.close();
  server.kill();
}
