import { Renderer } from "./engine/renderer";
import { Input } from "./engine/input";
import { startLoop } from "./engine/loop";
import { World, TEST_LEVEL } from "./game/world";
import type { EnemyDef, WeaponDef } from "./game/types";
import { Menu } from "./ui/menu";
import enemyDefs from "./data/enemies.json";
import weaponDefs from "./data/weapons.json";

const canvas = document.querySelector<HTMLCanvasElement>("#game")!;
const hud = document.querySelector<HTMLDivElement>("#hud")!;

const renderer = new Renderer(canvas);
const input = new Input(window);
const desktop = window.desktopRuntime;

type State = "menu" | "playing" | "gameover";
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
}

function startGame() {
  world = new World(
    enemyDefs as EnemyDef[],
    weaponDefs[0] as WeaponDef,
    TEST_LEVEL
  );
  state = "playing";
  menu.hide();
}

showMenu();

const GRID_SPACING = 160;

let fpsFrames = 0;
let fpsLast = performance.now();
let fps = 0;

startLoop(
  (dt) => {
    if (state === "playing" && world) {
      world.update(dt, input.moveX, input.moveY);
      if (!world.alive) {
        state = "gameover";
        menu.showGameOver(world.kills, world.time);
      }
    }
  },
  () => {
    fpsFrames++;
    const now = performance.now();
    if (now - fpsLast >= 500) {
      fps = Math.round((fpsFrames * 1000) / (now - fpsLast));
      fpsFrames = 0;
      fpsLast = now;
    }
    renderer.resize();
    const camX = world?.playerX ?? 0;
    const camY = world?.playerY ?? 0;
    renderer.begin(camX, camY);

    drawGrid(camX, camY);

    if (world) {
      drawArena(world.config.arenaHalfSize);

      renderer.push({
        x: world.playerX,
        y: world.playerY,
        w: 34,
        h: 34,
        r: 0.4,
        g: 0.85,
        b: 1,
        a: 1,
      });

      const barW = 48;
      const hpFrac = Math.max(0, world.hp / world.config.playerMaxHp);
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

      for (const p of world.projectiles) {
        renderer.push({
          x: p.x,
          y: p.y,
          w: 14,
          h: 14,
          r: 1,
          g: 0.95,
          b: 0.5,
          a: 1,
        });
      }

      hud.textContent = `fps: ${fps} (sim 120Hz) | hp: ${Math.ceil(world.hp)} | kills: ${world.kills} | enemies: ${world.enemies.length} | sprites: ${renderer.spriteCount} | time: ${world.time.toFixed(1)}s`;
    }

    renderer.flush();
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
