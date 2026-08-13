export interface EnemyDef {
  id: string;
  hp: number;
  speed: number;
  size: number;
  color: [number, number, number];
  xp: number;
  damage: number;
  boss?: boolean;
}

export type WeaponType = "projectile" | "aura" | "orbit" | "nova";

export interface WeaponDef {
  id: string;
  name: string;
  type: WeaponType;
  description: string;
  levels: Record<string, number>[];
}

export interface Wave {
  time: number;
  spawnInterval: number;
  enemies: string[];
  boss?: string;
}
