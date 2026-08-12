export interface EnemyDef {
  id: string;
  hp: number;
  speed: number;
  size: number;
  color: [number, number, number];
  xp: number;
}

export interface WeaponDef {
  id: string;
  name: string;
  damage: number;
  cooldown: number;
  projectileSpeed: number;
}
