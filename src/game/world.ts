import type { EnemyDef, WeaponDef } from "./types";

export interface Enemy {
  x: number;
  y: number;
  hp: number;
  def: EnemyDef;
}

export interface Projectile {
  x: number;
  y: number;
  dx: number;
  dy: number;
  damage: number;
  life: number;
}

export interface LevelConfig {
  arenaHalfSize: number;
  playerMaxHp: number;
  playerSpeed: number;
  contactDps: number;
  spawnIntervalStart: number;
  spawnIntervalMin: number;
  spawnDecay: number;
  weaponRange: number;
}

export const TEST_LEVEL: LevelConfig = {
  arenaHalfSize: 2000,
  playerMaxHp: 100,
  playerSpeed: 240,
  contactDps: 12,
  spawnIntervalStart: 1.1,
  spawnIntervalMin: 0.12,
  spawnDecay: 0.985,
  weaponRange: 650,
};

export class World {
  playerX = 0;
  playerY = 0;
  hp: number;
  enemies: Enemy[] = [];
  projectiles: Projectile[] = [];
  kills = 0;
  time = 0;

  private spawnTimer = 0;
  private spawnInterval: number;
  private fireTimer = 0;

  constructor(
    private enemyDefs: EnemyDef[],
    private weapon: WeaponDef,
    readonly config: LevelConfig,
  ) {
    this.hp = config.playerMaxHp;
    this.spawnInterval = config.spawnIntervalStart;
  }

  get alive() {
    return this.hp > 0;
  }

  update(dt: number, moveX: number, moveY: number) {
    if (!this.alive) return;
    this.time += dt;

    const len = Math.hypot(moveX, moveY) || 1;
    const bound = this.config.arenaHalfSize;
    this.playerX = clamp(this.playerX + (moveX / len) * this.config.playerSpeed * dt, -bound, bound);
    this.playerY = clamp(this.playerY + (moveY / len) * this.config.playerSpeed * dt, -bound, bound);

    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawnTimer = this.spawnInterval;
      this.spawnInterval = Math.max(this.config.spawnIntervalMin, this.spawnInterval * this.config.spawnDecay);
      this.spawnEnemy();
    }

    for (const e of this.enemies) {
      const dx = this.playerX - e.x;
      const dy = this.playerY - e.y;
      const d = Math.hypot(dx, dy) || 1;
      e.x += (dx / d) * e.def.speed * dt;
      e.y += (dy / d) * e.def.speed * dt;

      const touch = (e.def.size + 22) / 2;
      if (d < touch) this.hp -= this.config.contactDps * dt;
    }

    this.fireTimer -= dt;
    if (this.fireTimer <= 0) {
      const target = this.nearestEnemy();
      if (target) {
        this.fireTimer = this.weapon.cooldown;
        const dx = target.x - this.playerX;
        const dy = target.y - this.playerY;
        const d = Math.hypot(dx, dy) || 1;
        this.projectiles.push({
          x: this.playerX,
          y: this.playerY,
          dx: dx / d,
          dy: dy / d,
          damage: this.weapon.damage,
          life: 1.5,
        });
      }
    }

    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.x += p.dx * this.weapon.projectileSpeed * dt;
      p.y += p.dy * this.weapon.projectileSpeed * dt;
      p.life -= dt;
      if (p.life <= 0) {
        this.projectiles.splice(i, 1);
        continue;
      }
      for (let j = this.enemies.length - 1; j >= 0; j--) {
        const e = this.enemies[j];
        if (Math.hypot(e.x - p.x, e.y - p.y) < e.def.size / 2 + 5) {
          e.hp -= p.damage;
          this.projectiles.splice(i, 1);
          if (e.hp <= 0) {
            this.enemies.splice(j, 1);
            this.kills++;
          }
          break;
        }
      }
    }
  }

  private nearestEnemy(): Enemy | null {
    let best: Enemy | null = null;
    let bestD = this.config.weaponRange;
    for (const e of this.enemies) {
      const d = Math.hypot(e.x - this.playerX, e.y - this.playerY);
      if (d < bestD) {
        bestD = d;
        best = e;
      }
    }
    return best;
  }

  private spawnEnemy() {
    const def = this.enemyDefs[Math.floor(Math.random() * this.enemyDefs.length)];
    const angle = Math.random() * Math.PI * 2;
    const radius = 750 + Math.random() * 200;
    this.enemies.push({
      x: this.playerX + Math.cos(angle) * radius,
      y: this.playerY + Math.sin(angle) * radius,
      hp: def.hp,
      def,
    });
  }
}

function clamp(v: number, min: number, max: number) {
  return v < min ? min : v > max ? max : v;
}
