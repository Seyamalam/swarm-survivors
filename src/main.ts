import { Renderer, UV } from "./engine/renderer";
import { Input } from "./engine/input";
import { startLoop } from "./engine/loop";
import { World, TEST_LEVEL } from "./game/world";
import { generateDraft, applyDraft } from "./game/upgrades";
import type { EnemyDef, WeaponDef, Wave } from "./game/types";
import { Menu, type RunStats } from "./ui/menu";
import { AudioEngine } from "./audio/audio";
import enemyDefs from "./data/enemies.json";
import weaponDefs from "./data/weapons.json";
import waves from "./data/waves.json";

const params = new URLSearchParams(window.location.search);
const NAIVE_MODE = params.has("naive");
const STRESS_COUNT = Number(params.get("stress") ?? 0);
const SPEED = Math.max(1, Math.min(8, Number(params.get("speed") ?? 1)));

const canvas = document.querySelector<HTMLCanvasElement>("#game")!;
const hud = document.querySelector<HTMLDivElement>("#hud")!;
const xpbar = document.querySelector<HTMLDivElement>("#xpbar")!;
const leveltag = document.querySelector<HTMLDivElement>("#leveltag")!;

const renderer = new Renderer(canvas, NAIVE_MODE);
const input = new Input(window);
const desktop = window.desktopRuntime;
const allWeapons = weaponDefs as WeaponDef[];
const audio = new AudioEngine();

const enemySpriteName = (def: EnemyDef) =>
  def.boss ? `boss-${def.id}` : def.id;
const spriteNames = [
  "player",
  "gem",
  "bolt",
  ...(enemyDefs as EnemyDef[]).map(enemySpriteName),
];
void renderer.loadSprites(
  spriteNames.map((name) => ({ name, url: `sprites/${name}.png` }))
);

type State = "menu" | "playing" | "paused" | "draft" | "gameover" | "victory";
let state: State = "menu";
let settingsReturn: "menu" | "paused" = "menu";
let world: World | null = null;

function runStats(w: World): RunStats {
  return {
    kills: w.kills,
    time: w.time,
    level: w.level,
    totalDamage: w.totalDamage,
    weapons: w.weapons.map((x) => ({ name: x.def.name, level: x.level })),
  };
}

function toggleFullscreen() {
  if (desktop?.isDesktop) {
    void desktop.window.toggleFullscreen();
  } else if (document.fullscreenElement) {
    void document.exitFullscreen();
  } else {
    void document.documentElement.requestFullscreen();
  }
}

function openSettings() {
  menu.showSettings({
    volume: audio.volume,
    isDesktop: Boolean(desktop?.isDesktop),
    onVolume: (v) => audio.setVolume(v),
    onFullscreen: toggleFullscreen,
    onWindowSize: (w, h) => void desktop?.window.setWindowSize(w, h),
    onBack: () => {
      if (settingsReturn === "paused" && world) menu.showPause(runStats(world));
      else showMenu();
    },
  });
}

const menu = new Menu((action) => {
  if (action === "play") startGame();
  else if (action === "menu") showMenu();
  else if (action === "quit") void desktop?.window.quit();
  else if (action === "resume") resumeGame();
  else if (action === "settings") openSettings();
});

function showMenu() {
  state = "menu";
  world = null;
  audio.stopMusic();
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
    TEST_LEVEL,
    !NAIVE_MODE
  );
  world.onEvent = (event) => {
    switch (event) {
      case "shoot":
        audio.shoot();
        break;
      case "hit":
        audio.hit();
        break;
      case "kill":
        audio.kill();
        break;
      case "hurt":
        audio.hurt();
        break;
      case "gem":
        audio.gem();
        break;
      case "levelup":
        audio.levelup();
        break;
      case "bossspawn":
        audio.bossSpawn();
        break;
    }
  };
  if (STRESS_COUNT > 0) world.stress(STRESS_COUNT);
  state = "playing";
  audio.ensure();
  audio.startMusic();
  menu.hide();
}

function pauseGame() {
  if (state !== "playing" || !world) return;
  state = "paused";
  settingsReturn = "paused";
  menu.showPause(runStats(world));
}

function resumeGame() {
  if (state !== "paused") return;
  state = "playing";
  menu.hide();
}

window.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    if (state === "playing") pauseGame();
    else if (state === "paused") resumeGame();
  } else if (e.key === "F11") {
    e.preventDefault();
    toggleFullscreen();
  }
});

function openDraft() {
  if (!world) return;
  state = "draft";
  const options = generateDraft(world, allWeapons);
  menu.showDraft(options, (index) => {
    if (!world) return;
    applyDraft(world, allWeapons, options[index]);
    audio.pick();
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
      for (let i = 0; i < SPEED; i++) {
        if (world.hitStop > 0) {
          world.hitStop -= dt;
        } else {
          world.update(dt, input.moveX, input.moveY);
        }
      }
      if (world.victory) {
        state = "victory";
        audio.stopMusic();
        audio.victory();
        menu.showVictory(runStats(world));
      } else if (!world.alive) {
        state = "gameover";
        audio.stopMusic();
        audio.gameover();
        menu.showGameOver(runStats(world));
      } else if (world.pendingLevels > 0 && STRESS_COUNT === 0) {
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
    let camX = world?.playerX ?? 0;
    let camY = world?.playerY ?? 0;
    if (world && world.shake > 0) {
      const mag = world.shake * world.shake * 22;
      camX += (Math.random() - 0.5) * 2 * mag;
      camY += (Math.random() - 0.5) * 2 * mag;
    }
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
            uv: UV.circle,
          });
        }
      }

      const flash =
        world.invuln > 0 ? 0.45 + 0.35 * Math.sin(world.time * 40) : 1;
      const playerUV = renderer.spriteUV("player");
      renderer.push({
        x: world.playerX,
        y: world.playerY,
        w: 44,
        h: 44,
        r: playerUV ? 1 : 0.4,
        g: playerUV ? 1 : 0.85,
        b: playerUV ? 1 : 1,
        a: flash,
        uv: playerUV ?? UV.diamond,
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

      const gemUV = renderer.spriteUV("gem");
      for (const g2 of world.gems) {
        renderer.push({
          x: g2.x,
          y: g2.y,
          w: 18,
          h: 18,
          r: gemUV ? 1 : 0.24,
          g: gemUV ? 1 : 0.86,
          b: gemUV ? 1 : 0.52,
          a: 1,
          uv: gemUV ?? UV.diamond,
        });
      }

      for (const e of world.enemies) {
        const sprite = renderer.spriteUV(enemySpriteName(e.def));
        const [r, g, b] = sprite ? [1, 1, 1] : e.def.color;
        renderer.push({
          x: e.x,
          y: e.y,
          w: e.def.size,
          h: e.def.size,
          r,
          g,
          b,
          a: 1,
          uv: sprite ?? UV.circle,
          flash: e.flash > 0 ? e.flash / 0.18 : 0,
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
              uv: UV.spark,
            });
          }
        }
      }

      const boltUV = renderer.spriteUV("bolt");
      for (const p of world.projectiles) {
        renderer.push({
          x: p.x,
          y: p.y,
          w: p.size,
          h: p.size,
          r: boltUV ? 1 : 1,
          g: boltUV ? 1 : 0.95,
          b: boltUV ? 1 : 0.5,
          a: 1,
          uv: boltUV ?? UV.spark,
        });
      }

      for (const pt of world.particles.items) {
        const lifeFrac = pt.life / pt.maxLife;
        renderer.push({
          x: pt.x,
          y: pt.y,
          w: pt.size * lifeFrac,
          h: pt.size * lifeFrac,
          r: pt.r,
          g: pt.g,
          b: pt.b,
          a: lifeFrac,
          uv: pt.uv,
        });
      }

      for (const dn of world.dmgNumbers.items) {
        const digits = String(dn.value);
        const dw = 13;
        const dh = 20;
        const startX = dn.x - (digits.length * dw) / 2;
        const alpha = Math.min(1, dn.life / (dn.maxLife * 0.5));
        for (let i = 0; i < digits.length; i++) {
          renderer.push({
            x: startX + i * dw + dw / 2,
            y: dn.y,
            w: dw,
            h: dh,
            r: 1,
            g: 0.95,
            b: 0.6,
            a: alpha,
            uv: UV.digit(Number(digits[i])),
          });
        }
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
      const modeText = NAIVE_MODE ? " | NAIVE MODE" : "";
      const line1 = `hp: ${Math.ceil(world.hp)}/${world.maxHp} | kills: ${world.kills} | enemies: ${world.enemies.length} | sprites: ${renderer.spriteCount} | time: ${world.time.toFixed(1)}s${bossText}${modeText}`;
      const line2 =
        `fps: ${fps} · sim 120Hz · update ${avgUpdateMs.toFixed(2)}ms · render ${avgRenderMs.toFixed(2)}ms · main-thread ${busyPct.toFixed(0)}% · heap ${heapMb}MB · gpu-buffers ~${vramKb}KB · bloom ${renderer.bloomEnabled ? "on" : "off"}` +
        (desktopMetrics
          ? ` · cpu ${desktopMetrics.cpuPercent}% · proc-ram ${desktopMetrics.processMemMb}MB · gpu-proc ${desktopMetrics.gpuProcMemMb}MB`
          : "");
      hud.innerHTML = `${line1}<br>${line2}<br><span style="opacity:.6">${renderer.gpuName}</span>`;
    }

    renderer.flush();
    renderer.endFrame();
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

window.__perf = () => ({
  fps,
  updateMs: avgUpdateMs,
  renderMs: avgRenderMs,
  busyPct,
  sprites: renderer.spriteCount,
  enemies: world?.enemies.length ?? 0,
  kills: world?.kills ?? 0,
  bloom: renderer.bloomEnabled,
  naive: NAIVE_MODE,
});

window.__state = () => {
  if (!world) return null;
  let nearest: { dx: number; dy: number; d: number } | null = null;
  for (const e of world.enemies) {
    const dx = e.x - world.playerX;
    const dy = e.y - world.playerY;
    const d = Math.hypot(dx, dy);
    if (!nearest || d < nearest.d) nearest = { dx, dy, d };
  }
  return {
    time: world.time,
    hp: world.hp,
    maxHp: world.maxHp,
    level: world.level,
    kills: world.kills,
    enemies: world.enemies.length,
    nearest,
    boss: world.boss ? world.boss.hp : null,
    victory: world.victory,
    alive: world.alive,
    weapons: world.weapons.map((w) => `${w.def.id}:${w.level}`),
  };
};
