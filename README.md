# Swarm Survivors

A Vampire Survivors-style arena roguelike built with TypeScript + WebGL2, made for our computer graphics course. The whole game is a GPU showcase: thousands of instanced enemies, particles, and shaders at 60fps.

## Quick start

```bash
npm install
npm run dev
```

Open the printed local URL. Move with **WASD** or **arrow keys**.

Build for release:

```bash
npm run build     # outputs static site to dist/
npm run preview   # serve the production build locally
```

## Publishing to itch.io

**HTML5 (in-browser play):**

```bash
npm run deploy:itch:web   # builds dist/ and pushes with butler
```

Requires the [butler CLI](https://itch.io/docs/butler/) on PATH and `BUTLER_API_KEY` in the environment or `.env.local`. Set `ITCH_TARGET=user/page:html5` to override the default target. Or do it manually: zip the **contents** of `dist/` (index.html at zip root) → itch.io → New project → Kind: **HTML** → check "This file will be played in the browser".

**Desktop downloads (Electron):**

```bash
npm run package:mac     # dmg + zip, x64 and arm64
npm run package:win     # portable exe, x64
npm run package:linux   # AppImage + zip, x64
```

Artifacts land in `release/desktop/`. Upload them to the same itch page as downloadable files (or push with `butler push <file> user/page:osx-arm64` etc.). Note: builds are unsigned — macOS players right-click → Open the first time.

## Development

| Command | What it does |
|---------|-------------|
| `npm run dev` | Run the game in the browser (fastest iteration) |
| `npm run desktop:dev` | Electron with Vite hot-reload |
| `npm run desktop` | Electron against the built `dist/` |
| `npm run build` | Production web build to `dist/` |
| `npm run package:win/mac/linux` | Package desktop apps to `release/desktop/` |

## Team structure

The codebase is split so each member owns a separable area:

| Area | Path | Owner | What it is |
|------|------|-------|-----------|
| Engine core | `src/engine/` | Member 1 | Instanced sprite renderer, game loop, input, (next: spatial hash collision, object pooling) |
| Content & balance | `src/data/` | Member 2 | Enemies, weapons, upgrades, waves — pure JSON, no engine knowledge needed |
| VFX & juice | `src/game/vfx/` | Member 3 | Particles, damage numbers, hit flashes, screen shake |
| UI & menus | `src/ui/` | Member 4 | HUD, upgrade draft screen, main menu, game-over stats |

> Add names to the table once assigned. Each member's demo contribution should be visible in the final video and summarized in the grading writeup below.

## Roadmap / scope guardrails

- [x] Instanced WebGL2 quad renderer (one draw call for all sprites)
- [x] Game loop, input, camera-follow, basic enemy spawning/seeking
- [ ] Spatial hash grid for collision (naive O(n²) dies ~1k enemies — this is the CG talking point)
- [ ] Auto-firing weapons driven by `src/data/weapons.json`
- [ ] XP gems, leveling, 3-card upgrade draft
- [ ] Particle system + damage numbers
- [ ] HUD + menus
- [ ] One boss wave at 10 minutes

**Explicitly out of scope:** meta-progression saves, multiple stages/characters, online anything.

## Grading demo narrative

1. Show the naive per-sprite renderer (kept on branch `naive-renderer`) dying at ~1k enemies
2. Show the instanced + spatial-hashed version at 10k+ enemies
3. The before/after frame-time graph is the core of the report
