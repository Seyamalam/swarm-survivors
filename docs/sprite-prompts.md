# Sprite generation brief

Hand this file to your image generator (GPT image, Midjourney, SDXL, etc.).
When done, drop PNGs into `assets/sprites/` with the exact filenames below and tell me — I'll wire them into the texture atlas.

## Global style rules (include in every prompt)

- Top-down 2D game sprite, centered, full body visible
- Flat dark background `#0b0e14` OR transparent background (transparent preferred)
- Bold readable silhouette, chunky shapes, slight cel shading
- Palette: dark fantasy neon (deep blues/purples base, bright accent per character)
- Square 1:1 canvas, character fills ~80% of frame, facing DOWNWARD (top-down view)
- No text, no watermark, no border/frame
- Export size: 256×256 PNG (I downscale at atlas build time)

## Sprites needed

| Filename               | Prompt seed                                                                |
| ---------------------- | -------------------------------------------------------------------------- |
| `player.png`           | Small hooded survivor mage, glowing cyan cloak, determined stance          |
| `crawler.png`          | Squat red demon grub, many tiny legs, glowing eyes                         |
| `runner.png`           | Lean orange imp mid-sprint, sharp claws                                    |
| `swarmling.png`        | Tiny pink bat-like creature, oversized wings                               |
| `spitter.png`          | Bloated green plague toad, dripping maw                                    |
| `imp.png`              | Small red-orange trickster demon, grinning                                 |
| `stalker.png`          | Slim violet shadow panther, glowing eyes                                   |
| `leech.png`            | Segmented green leech with circular mouth                                  |
| `brute.png`            | Massive purple ogre, tiny head, huge fists                                 |
| `bomber.png`           | Round dark-red bomb creature, lit fuse, crazed look                        |
| `wraith.png`           | Ghostly white floating specter, tattered cloak                             |
| `shielder.png`         | Blue armored beetle knight, huge shell                                     |
| `sentinel.png`         | Steel-gray construct golem, single glowing eye                             |
| `ravager.png`          | Crimson four-armed berserker demon                                         |
| `golem.png`            | Huge gray stone golem, mossy cracks                                        |
| `titan.png`            | Enormous dark obsidian giant, glowing core                                 |
| `boss-hive-tyrant.png` | Colossal insectoid hive queen, crimson carapace, crown of spikes, menacing |
| `gem.png`              | Small glowing green crystal shard                                          |
| `bolt.png`             | Glowing golden magic bolt projectile, slight motion trail                  |

## Round 2 — gem rarity tiers + extras

Same style rules as above. These drop into `assets/sprites/` with these exact filenames; the game picks them up automatically (colored fallback exists until then).

| Filename            | Prompt seed                                           |
| ------------------- | ----------------------------------------------------- |
| `gem-rare.png`      | Small glowing blue crystal shard, brighter inner glow |
| `gem-epic.png`      | Small glowing purple crystal shard, arcane sparkle    |
| `gem-legendary.png` | Radiant golden crystal shard, brilliant halo          |

Gem tiers in-game: common (green, 1–2 xp) → rare (blue, 3–4 xp) → epic (purple, 5–8 xp) → legendary (gold, boss/elite drops). Damage numbers when enemies hit the player are already rendered in-engine (red digits) — no art needed for those.

## Round 3 — weapon projectiles + walk frames

Same style rules. The game picks these up automatically when present (fallbacks exist).

### Per-weapon projectile sprites

| Filename               | Prompt seed                                |
| ---------------------- | ------------------------------------------ |
| `proj-magic-bolt.png`  | Glowing cyan magic bolt, sharp energy dart |
| `proj-fireball.png`    | Roaring orange fireball, flaming trail     |
| `proj-ice-shard.png`   | Jagged pale-blue ice shard, frosty edges   |
| `proj-poison-dart.png` | Slim toxic-green dart, dripping venom      |
| `proj-arc-nova.png`    | Crackling violet lightning orb             |
| `proj-ember-nova.png`  | Heavy molten ember, glowing cracks         |

### Walk-cycle second frames (flipbook)

For each of the 16 enemies + boss from round 1, generate a **second frame of the same character mid-stride** (legs/wings/tentacles in the opposite position, identical style/colors/framing). Filename pattern: `<name>-walk2.png` — e.g. `crawler-walk2.png`, `boss-hive-tyrant-walk2.png`.

Consistency trick: feed the round-1 image back as a reference and ask for "same character, mid-stride second animation frame".

## Tips

- Generate `player.png` and `crawler.png` first and check style consistency before batch-running the rest
- If background removal is needed: `npx remove-bg-cli assets/sprites/x.png` or any online remover
- Consistency trick: reuse the same seed/style reference image for every prompt
