import type { WeaponDef } from "./types";
import { MAX_WEAPON_LEVEL } from "./weapons";
import type { World } from "./world";

export const MAX_WEAPONS = 4;

export interface DraftOption {
  kind: "new-weapon" | "upgrade-weapon" | "stat";
  id: string;
  name: string;
  desc: string;
  level?: number;
}

const STAT_OPTIONS: DraftOption[] = [
  { kind: "stat", id: "damage", name: "Sharpen", desc: "+10% all damage" },
  { kind: "stat", id: "speed", name: "Swift Boots", desc: "+8% move speed" },
  {
    kind: "stat",
    id: "maxhp",
    name: "Vitality",
    desc: "+25 max HP and heal 25",
  },
  { kind: "stat", id: "pickup", name: "Magnet", desc: "+30% pickup radius" },
];

export function generateDraft(
  world: World,
  allWeapons: WeaponDef[]
): DraftOption[] {
  const pool: DraftOption[] = [];

  for (const w of world.weapons) {
    if (w.level < MAX_WEAPON_LEVEL) {
      pool.push({
        kind: "upgrade-weapon",
        id: w.def.id,
        name: w.def.name,
        desc: `Upgrade to level ${w.level + 1}`,
        level: w.level + 1,
      });
    }
  }

  if (world.weapons.length < MAX_WEAPONS) {
    for (const def of allWeapons) {
      if (!world.weapons.some((w) => w.def.id === def.id)) {
        pool.push({
          kind: "new-weapon",
          id: def.id,
          name: def.name,
          desc: def.description,
        });
      }
    }
  }

  pool.push(...STAT_OPTIONS);

  const picks: DraftOption[] = [];
  const bag = [...pool];
  while (picks.length < 3 && bag.length > 0) {
    const i = Math.floor(Math.random() * bag.length);
    picks.push(bag.splice(i, 1)[0]);
  }
  return picks;
}

export function applyDraft(
  world: World,
  allWeapons: WeaponDef[],
  option: DraftOption
) {
  if (option.kind === "new-weapon") {
    const def = allWeapons.find((d) => d.id === option.id);
    if (def) world.addWeapon(def);
  } else if (option.kind === "upgrade-weapon") {
    world.upgradeWeapon(option.id);
  } else {
    switch (option.id) {
      case "damage":
        world.damageMult *= 1.1;
        break;
      case "speed":
        world.speedMult *= 1.08;
        break;
      case "maxhp":
        world.maxHp += 25;
        world.hp = Math.min(world.maxHp, world.hp + 25);
        break;
      case "pickup":
        world.pickupRadius *= 1.3;
        break;
    }
  }
}
