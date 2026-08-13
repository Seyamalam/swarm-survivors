# Swarm Survivors — Technical Report

A Vampire Survivors-style arena roguelike written from scratch in TypeScript + WebGL2, with no game engine or rendering library. This document covers the computer graphics techniques used and the measured performance story.

## Architecture

```
index.html ─ src/main.ts (state machine, render loop, HUD)
                ├── engine/renderer.ts      WebGL2 instanced renderer + bloom post pipeline
                ├── engine/spatial-hash.ts  uniform-grid broadphase
                ├── engine/loop.ts          fixed 120Hz timestep
                ├── game/world.ts           simulation (entities, weapons, waves, boss)
                ├── game/vfx/               pooled particles + damage numbers
                └── data/*.json             all content (enemies, weapons, waves) as data
```

## CG techniques

### 1. Instanced sprite rendering

All sprites — enemies, projectiles, gems, particles, damage digits, grid — are drawn with **one `gl.drawArraysInstanced` call per frame**. A static unit-quad VBO is combined with a dynamic per-instance VBO (position, size, RGBA tint, UV rect, flash amount = 13 floats/instance), streamed with `gl.bufferSubData`. The instance buffer doubles on demand.

### 2. Procedural texture atlas

A 512×512 atlas is generated at runtime on a 2D canvas: soft circle, ring, diamond, star spark, and a 10-digit bitmap font (used for damage numbers). Per-instance UV rects select the glyph — one texture, zero asset files, zero network loads.

### 3. Custom vertex/fragment shaders

The vertex shader transforms world → clip space with a camera uniform; the fragment shader samples the atlas, applies per-instance tint, and mixes toward gray for **hit-flash** feedback.

### 4. Bloom post-processing

Three-pass FBO pipeline: scene → offscreen FBO; luminance bright-pass (threshold 0.8) downsampled to half resolution; two separable Gaussian blur ping-pong iterations; additive composite to the default framebuffer. (Two real bugs were found and fixed here: a texture/FBO feedback loop, and alpha-0 bright-pass output accumulating trails under blending — see git history.)

### 5. Spatial hash broadphase

Enemies are bucketed into a uniform 96px grid each frame. Collision, separation, aura, orbit, and projectile queries only test neighbors in overlapped cells instead of all pairs.

### 6. Object pooling

Enemies, projectiles, gems, particles, and damage numbers are recycled from freelists with swap-remove — no per-frame allocation in the hot loop.

### 7. Fixed-timestep simulation

The simulation ticks at a fixed 120Hz through an accumulator, decoupled from display refresh — identical gameplay speed on 60Hz and 120Hz+ displays.

## Performance: naive vs optimized

Full methodology and raw data: `docs/benchmark.md` (regenerate with `npm run benchmark`). Headless Chromium (SwiftShader software GL), 8s samples, god-mode stress spawns.

| Enemies | Naive update ms | Optimized update ms | Speedup   |
| ------- | --------------- | ------------------- | --------- |
| 500     | 1.69            | 0.52                | 3.2×      |
| 2,000   | 261.7           | 9.15                | **28.6×** |
| 5,000   | 1,652           | 148.7               | 11.1×     |
| 10,000  | 5,800           | 422                 | 13.7×     |

Render time stays under 2ms at 10,000 sprites in the optimized path (single draw call), while the naive path's per-sprite draw calls collapse well before update costs matter. The `naive-renderer` branch preserves the unoptimized code for comparison; `?naive=1&stress=N` toggles naive mode on current code.

## Game systems

- 16 enemy types + boss, all data-driven (`src/data/enemies.json`)
- 12-wave escalating spawn timeline, boss at 10:00 (`src/data/waves.json`)
- 10 weapons × 8 levels across 4 mechanics: homing projectiles, damage auras, orbiting blades, radial novas (`src/data/weapons.json`)
- Level-up 3-card draft: new weapon / weapon upgrade / stat boost
- Game feel: knockback, invulnerability frames, particles, damage numbers, screen shake, hit-stop on elite kills
- Procedural WebAudio SFX + generative music (no audio assets)

## Tooling

- Pre-commit: auto-screenshot README images → prettier → typecheck → eslint
- Post-commit: auto-build + deploy to itch.io (butler)
- `npm run test:smoke` — headless end-to-end playtest (moves, drafts, dies/wins)
- `npm run benchmark` — the table above
- `node scripts/balance-bot.mjs` — kiting bot for balance testing (used to tune waves/damage; see commit history)
- Live in-game perf overlay: FPS, update/render ms, main-thread %, heap, GPU model; Electron adds real CPU% and process RAM
