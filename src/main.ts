import { Renderer } from "./engine/renderer";
import { Input } from "./engine/input";
import { startLoop } from "./engine/loop";
import { World, TEST_LEVEL } from "./game/world";
import { generateDraft, applyDraft } from "./game/upgrades";
import type { EnemyDef, WeaponDef, Wave } from "./game/types";
import { Menu } from "./ui/menu";
import enemyDefs from "./data/enemies.json";
import weaponDefs from "./data/weapons.json";
import waves from "./data/waves.json";

const canvas = document.querySelector<HTMLCanvasElement>("#game")!;
const hud = document.querySelector<HTMLDivElement>("#hud")!;
const xpbar = document.querySelector<HTMLDivElement>("#xpbar")!;
const leveltag = document.querySelector<HTMLDivElement>("#leveltag")!;

const renderer = new Renderer(canvas);
const input = new Input(window);
const desktop = window.desktopRuntime;
const allWeapons = weaponDefs as WeaponDef[];

type State = "menu" | "playing" | "draft" | "gameover" | "victory";
let state: State = "menu";
let world: World | null = null;

const menu = new Menu((action) => {
  if (action === "play") startGame();
  else if (action === "menu") showMenu();
  else if (action === "quit") void desktop?.window.quit();
});

function showMenu() {
  state = "menu";
  world = null;
  menu.showMain(Boolean(desktop?.isDesktop));
  hud.textContent = "";
  leveltag.textContent = "";
  xpbar.style.width = "0%";
}

function startGame() {
  world = new World(
    enemyDefs as EnemyDef[],
    allWeapons,
    waves as Wave[],
    TEST_LEVEL
  );
  state = "playing";
  menu.hide();
}

function openDraft() {
  if (!world) return;
  state = "draft";
  const options = generateDraft(world, allWeapons);
  menu.showDraft(options, (index) => {
    if (!world) return;
    applyDraft(world, allWeapons, options[index]);
    world.pendingLevels--;
    if (world.pendingLevels > 0) {
      openDraft();
    } else {
      menu.hide();
      state = "playing";
    }
  });
}

showMenu();

const GRID_SPACING = 160;

let statFrames = 0;
let statLast = performance.now();
let fps = 0;
let avgUpdateMs = 0;
let avgRenderMs = 0;
let busyPct = 0;
let accUpdate = 0;
let accRender = 0;

interface DesktopMetrics {
  cpuPercent: number;
  processMemMb: number;
  gpuProcMemMb: number;
  systemTotalMb: number;
  systemFreeMb: number;
}
let desktopMetrics: DesktopMetrics | null = null;
if (desktop?.isDesktop) {
  const poll = () =>
    desktop.window
      .getMetrics()
      .then((m) => (desktopMetrics = m))
      .catch(() => {});
  void poll();
  setInterval(poll, 1000);
}

startLoop(
  (dt) => {
    if (state === "playing" && world) {
      world.update(dt, input.moveX, input.moveY);
      if (world.victory) {
        state = "victory";
        menu.showVictory(world.kills, world.time);
      } else if (!world.alive) {
        state = "gameover";
        menu.showGameOver(world.kills, world.time);
      } else if (world.pendingLevels > 0) {
        openDraft();
      }
    }
  },
  () => {
    statFrames++;
    const now = performance.now();
    if (now - statLast >= 500) {
      fps = Math.round((statFrames * 1000) / (now - statLast));
      avgUpdateMs = accUpdate / statFrames;
      avgRenderMs = accRender / statFrames;
      busyPct = Math.min(
        100,
        ((accUpdate + accRender) / (now - statLast)) * 100
      );
      statFrames = 0;
      accUpdate = 0;
      accRender = 0;
      statLast = now;
    }
    renderer.resize();
    const camX = world?.playerX ?? 0;
    const camY = world?.playerY ?? 0;
    renderer.begin(camX, camY);

    drawGrid(camX, camY);

    if (world) {
      drawArena(world.config.arenaHalfSize);

      for (const w of world.weapons) {
        if (w.def.type === "aura") {
          const radius = world.auraRadius(w);
          renderer.push({
            x: world.playerX,
            y: world.playerY,
            w: radius * 2,
            h: radius * 2,
            r: 0.5,
            g: 0.8,
            b: 1,
            a: 0.08,
          });
        }
      }

      const flash =
        world.invuln > 0 ? 0.45 + 0.35 * Math.sin(world.time * 40) : 1;
      renderer.push({
        x: world.playerX,
        y: world.playerY,
        w: 34,
        h: 34,
        r: 0.4,
        g: 0.85,
        b: 1,
        a: flash,
      });

      const barW = 48;
      const hpFrac = Math.max(0, world.hp / world.maxHp);
      renderer.push({
        x: world.playerX,
        y: world.playerY - 38,
        w: barW,
        h: 7,
        r: 0.2,
        g: 0.2,
        b: 0.25,
        a: 0.9,
      });
      renderer.push({
        x: world.playerX - (barW * (1 - hpFrac)) / 2,
        y: world.playerY - 38,
        w: barW * hpFrac,
        h: 7,
        r: 0.3,
        g: 0.9,
        b: 0.4,
        a: 1,
      });

      for (const g2 of world.gems) {
        renderer.push({
          x: g2.x,
          y: g2.y,
          w: 12,
          h: 12,
          r: 0.24,
          g: 0.86,
          b: 0.52,
          a: 1,
        });
      }

      for (const e of world.enemies) {
        const [r, g, b] = e.def.color;
        renderer.push({
          x: e.x,
          y: e.y,
          w: e.def.size,
          h: e.def.size,
          r,
          g,
          b,
          a: 1,
        });
      }

      for (const w of world.weapons) {
        if (w.def.type === "orbit") {
          for (const orb of world.orbitPositions(w)) {
            renderer.push({
              x: orb.x,
              y: orb.y,
              w: orb.size,
              h: orb.size,
              r: 0.55,
              g: 0.9,
              b: 1,
              a: 0.95,
            });
          }
        }
      }

      for (const p of world.projectiles) {
        renderer.push({
          x: p.x,
          y: p.y,
          w: p.size,
          h: p.size,
          r: 1,
          g: 0.95,
          b: 0.5,
          a: 1,
        });
      }

      xpbar.style.width = `${Math.min(100, (world.xp / world.xpNext) * 100)}%`;
      leveltag.textContent = `Lv ${world.level}`;

      const heapMb = performance.memory
        ? Math.round(performance.memory.usedJSHeapSize / 1048576)
        : "?";
      const vramKb = Math.round(renderer.vramBytes / 1024);
      const bossText = world.boss
        ? ` | BOSS: ${Math.ceil(world.boss.hp)}/${world.boss.maxHp}`
        : "";
      const line1 = `hp: ${Math.ceil(world.hp)}/${world.maxHp} | kills: ${world.kills} | enemies: ${world.enemies.length} | sprites: ${renderer.spriteCount} | time: ${world.time.toFixed(1)}s${bossText}`;
      const line2 =
        `fps: ${fps} · sim 120Hz · update ${avgUpdateMs.toFixed(2)}ms · render ${avgRenderMs.toFixed(2)}ms · main-thread ${busyPct.toFixed(0)}% · heap ${heapMb}MB · gpu-buffers ~${vramKb}KB` +
        (desktopMetrics
          ? ` · cpu ${desktopMetrics.cpuPercent}% · proc-ram ${desktopMetrics.processMemMb}MB · gpu-proc ${desktopMetrics.gpuProcMemMb}MB`
          : "");
      hud.innerHTML = `${line1}<br>${line2}<br><span style="opacity:.6">${renderer.gpuName}</span>`;
    }

    renderer.flush();
  },
  (timing) => {
    accUpdate += timing.updateMs;
    accRender += timing.renderMs;
  }
);

function drawGrid(camX: number, camY: number) {
  const halfW = canvas.width / 2;
  const halfH = canvas.height / 2;
  const x0 = Math.floor((camX - halfW) / GRID_SPACING) * GRID_SPACING;
  const y0 = Math.floor((camY - halfH) / GRID_SPACING) * GRID_SPACING;

  for (let x = x0; x <= camX + halfW; x += GRID_SPACING) {
    renderer.push({
      x,
      y: camY,
      w: 2,
      h: halfH * 2 + GRID_SPACING,
      r: 0.1,
      g: 0.12,
      b: 0.16,
      a: 1,
    });
  }
  for (let y = y0; y <= camY + halfH; y += GRID_SPACING) {
    renderer.push({
      x: camX,
      y,
      w: halfW * 2 + GRID_SPACING,
      h: 2,
      r: 0.1,
      g: 0.12,
      b: 0.16,
      a: 1,
    });
  }
}

function drawArena(half: number) {
  const t = 6;
  const c = { r: 0.75, g: 0.25, b: 0.3, a: 0.8 };
  renderer.push({ x: 0, y: -half, w: half * 2 + t, h: t, ...c });
  renderer.push({ x: 0, y: half, w: half * 2 + t, h: t, ...c });
  renderer.push({ x: -half, y: 0, w: t, h: half * 2 + t, ...c });
  renderer.push({ x: half, y: 0, w: t, h: half * 2 + t, ...c });
}
