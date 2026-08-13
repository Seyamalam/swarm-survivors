import type { WeaponDef } from "./types";

export const MAX_WEAPON_LEVEL = 8;

export interface WeaponInstance {
  def: WeaponDef;
  level: number;
  timer: number;
  angle: number;
}

export function createWeapon(def: WeaponDef): WeaponInstance {
  return { def, level: 1, timer: 0, angle: Math.random() * Math.PI * 2 };
}

export function weaponStats(w: WeaponInstance): Record<string, number> {
  const base = w.def.levels[0];
  const merged: Record<string, number> = { ...base };
  for (let i = 1; i < w.level; i++) {
    Object.assign(merged, w.def.levels[i]);
  }
  return merged;
}
