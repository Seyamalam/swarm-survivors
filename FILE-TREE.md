# File Tree

```
swarm-survivors/
├── index.html                    # Page shell: canvas, HUD/XP DOM elements, menu overlay styles
├── package.json                  # npm scripts (dev/build/desktop/package/deploy/benchmark) and dev deps
├── tsconfig.json                 # Strict TypeScript config for src/
├── vite.config.ts                # Vite config — base './' so itch.io subpath hosting works
├── electron-builder.yml          # Desktop packaging: win portable exe, mac dmg/zip, linux AppImage/zip
├── eslint.config.js              # ESLint flat config (browser/node/script globals per folder)
├── .prettierrc                   # Prettier formatting rules enforced by pre-commit
├── .lintstagedrc                 # lint-staged: prettier on staged files at commit time
├── .nvmrc                        # Node 22 for local dev and CI parity
├── .gitignore                    # Ignores node_modules, dist, release, local env files
│
├── .husky/
│   ├── pre-commit                # Screenshots → prettier → typecheck → lint, blocks commit on failure
│   └── post-commit               # Auto-builds and deploys the web build to itch.io via butler
│
├── electron/
│   ├── main.cjs                  # Electron main process: window, GPU switches, fullscreen/quit/metrics IPC
│   └── preload.cjs               # contextBridge exposing safe `desktopRuntime` API to the renderer
│
├── scripts/
│   ├── capture-screenshots.mjs   # Headless Playwright: builds game, screenshots menu+gameplay for README
│   ├── smoke-test.mjs            # Headless end-to-end playtest: moves, drafts upgrades, asserts loop works
│   ├── benchmark.mjs             # naive vs optimized stress benchmark → docs/benchmark.md + .json
│   └── publish-itch-web.sh       # Butler push of dist/ to the itch.io html5 channel with retries
│
├── docs/
│   └── screenshots/              # Auto-regenerated README screenshots (menu.png, gameplay.png)
│
└── src/
    ├── main.ts                   # Entry: game state machine, camera shake, all rendering, HUD/perf overlay
    ├── desktop.d.ts              # Window/Performance type declarations for Electron IPC and perf hook
    │
    ├── engine/
    │   ├── renderer.ts           # WebGL2 instanced sprite renderer: procedural texture atlas, per-instance UV/flash, bloom post pipeline, naive mode for benchmarks
    │   ├── spatial-hash.ts       # Uniform-grid spatial hash for O(1) neighbor queries (collision, separation)
    │   ├── loop.ts               # Fixed 120Hz timestep game loop with accumulator + per-frame timing
    │   └── input.ts              # WASD/arrow-key state as normalized move axes
    │
    ├── game/
    │   ├── world.ts              # Simulation core: enemies, projectiles, gems, weapons, waves, boss, knockback, hit-stop, shake, stress mode
    │   ├── weapons.ts            # Weapon instances and per-level stat merging (level 1 base + deltas)
    │   ├── upgrades.ts           # Draft option generation (new/upgrade weapon, stat boosts) and application
    │   ├── types.ts              # Shared types: EnemyDef, WeaponDef, Wave
    │   └── vfx/
    │       ├── particles.ts      # Pooled particle system: hit sparks, death bursts, level-up flash
    │       └── damage-numbers.ts # Pooled floating damage numbers (rendered via atlas digit sprites)
    │
    ├── ui/
    │   └── menu.ts               # DOM overlay screens: main menu, game over, victory, level-up draft cards
    │
    └── data/
        ├── enemies.json          # 16 enemy definitions (hp/speed/size/color/xp/damage, boss flag) — content, no code
        ├── weapons.json          # 10 weapons × 8 levels across 4 mechanics (projectile/aura/orbit/nova)
        └── waves.json            # Spawn timeline: 12 escalating waves over 10 minutes, boss at 10:00
```
