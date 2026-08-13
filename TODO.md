# Swarm Survivors — Task List

Status: `todo` → `doing` → `done`. Owner key: **M1** engine core, **M2** content/data, **M3** VFX/juice, **M4** UI/menus.

## Milestone 1 — Core loop (playable end-to-end) ✅

- [x] Instanced WebGL2 quad renderer (M1)
- [x] Game loop, input, camera follow (M1)
- [x] Main menu + game over + retry (M4)
- [x] Test level: bounded arena, spawning, auto-fire, HP/death (M1)
- [x] Player/enemy contact knockback + brief invulnerability window (M1)
- [x] Enemy separation so they don't stack on one tile (M1)
- [x] Kill → XP gem drops, pickup radius, XP bar (M1)

## Milestone 2 — Roguelike systems ✅

- [x] Level-up → 3-card upgrade draft screen (M4)
- [x] Weapon system: multiple equipped weapons, per-weapon cooldowns (M1)
- [x] Upgrade system: damage/speed/area/projectile-count modifiers (M1)
- [x] 10 weapons with 8 levels each, defined in `src/data/weapons.json` (M2)
- [x] 15+ enemy types + spawn waves over time in `src/data/enemies.json` / `waves.json` (M2)
- [x] 10-minute run timer with escalating wave table (M2)
- [x] Final boss wave at 10:00 (M1 + M2)

## Milestone 3 — CG showcase (the grading material)

- [x] Spatial hash grid collision (replaces naive O(n²)) (M1)
- [x] Object pooling for enemies/projectiles/particles (M1)
- [x] Sprite atlas + textured quads (procedural runtime atlas: shapes + digit font) (M1)
- [x] Particle system: hit sparks, death bursts, level-up flash (M3)
- [x] Damage numbers + hit flashes (M3)
- [x] Screen shake + hit-stop on big kills (M3)
- [x] Post-processing: bloom/glow pass (M1)
- [x] `naive-renderer` branch preserved for before/after benchmark (M1)
- [x] Frame-time benchmark: naive vs instanced+spatial-hash, graph for report (M1) — see `docs/benchmark.md`

## Milestone 4 — Polish & ship

- [ ] Title screen art + logo pass (M4)
- [ ] Pause menu (ESC) with stats (M4)
- [ ] Settings: fullscreen/window size (desktop IPC already exposed), volume (M4)
- [ ] Sound effects + music (M3)
- [ ] Game-over stats screen: kills, DPS, time, build summary (M4)
- [ ] itch.io page: screenshots, description, tags (M4)
- [ ] Desktop builds: win/mac/linux via `npm run package:*`, upload to itch (M1)
- [ ] Demo video for grading (everyone records their part)

## Explicitly out of scope

- Meta-progression / save system
- Multiple stages or characters
- Online anything
- Custom art assets beyond placeholder shapes + free textures
