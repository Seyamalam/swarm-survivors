import type { EnemyDef, WeaponDef, Wave } from "./types";
import { createWeapon, weaponStats, type WeaponInstance } from "./weapons";

export interface Enemy {
  id: number;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  kx: number;
  ky: number;
  lastOrbitHit: number;
  def: EnemyDef;
}

export interface Projectile {
  x: number;
  y: number;
  dx: number;
  dy: number;
  damage: number;
  life: number;
  size: number;
  speed: number;
  pierce: number;
  hitIds: number[];
}

export interface Gem {
  x: number;
  y: number;
  xp: number;
}

export interface LevelConfig {
  arenaHalfSize: number;
  playerMaxHp: number;
  playerSpeed: number;
  invulnTime: number;
  maxEnemies: number;
  pickupRadius: number;
}

export const TEST_LEVEL: LevelConfig = {
  arenaHalfSize: 2000,
  playerMaxHp: 100,
  playerSpeed: 360,
  invulnTime: 0.5,
  maxEnemies: 350,
  pickupRadius: 90,
};

export const PLAYER_SIZE = 34;
const ORBIT_HIT_COOLDOWN = 0.4;
const PROJECTILE_LIFE = 1.6;
const KNOCKBACK_FORCE = 320;

export class World {
  playerX = 0;
  playerY = 0;
  hp: number;
  maxHp: number;
  damageMult = 1;
  speedMult = 1;
  pickupRadius: number;
  invuln = 0;

  level = 1;
  xp = 0;
  xpNext = 8;
  pendingLevels = 0;

  weapons: WeaponInstance[] = [];
  enemies: Enemy[] = [];
  projectiles: Projectile[] = [];
  gems: Gem[] = [];

  kills = 0;
  time = 0;
  victory = false;
  boss: Enemy | null = null;

  private spawnTimer = 0;
  private bossSpawned = false;
  private nextEnemyId = 1;
  private lastMoveX = 1;
  private lastMoveY = 0;

  constructor(
    private enemyDefs: EnemyDef[],
    allWeapons: WeaponDef[],
    private waves: Wave[],
    readonly config: LevelConfig
  ) {
    this.hp = config.playerMaxHp;
    this.maxHp = config.playerMaxHp;
    this.pickupRadius = config.pickupRadius;
    this.addWeapon(allWeapons[0]);
  }

  get alive() {
    return this.hp > 0;
  }

  addWeapon(def: WeaponDef) {
    this.weapons.push(createWeapon(def));
  }

  upgradeWeapon(id: string) {
    const w = this.weapons.find((w) => w.def.id === id);
    if (w && w.level < w.def.levels.length) w.level++;
  }

  update(dt: number, moveX: number, moveY: number) {
    if (!this.alive || this.victory) return;
    this.time += dt;
    if (this.invuln > 0) this.invuln -= dt;

    if (moveX !== 0 || moveY !== 0) {
      this.lastMoveX = moveX;
      this.lastMoveY = moveY;
    }
    const len = Math.hypot(moveX, moveY) || 1;
    const bound = this.config.arenaHalfSize;
    const speed = this.config.playerSpeed * this.speedMult;
    this.playerX = clamp(
      this.playerX + (moveX / len) * speed * dt,
      -bound,
      bound
    );
    this.playerY = clamp(
      this.playerY + (moveY / len) * speed * dt,
      -bound,
      bound
    );

    this.updateSpawns(dt);
    this.updateEnemies(dt);
    this.updateWeapons(dt);
    this.updateProjectiles(dt);
    this.updateGems(dt);
    this.reapDead();
  }

  private currentWave(): Wave {
    let wave = this.waves[0];
    for (const w of this.waves) {
      if (this.time >= w.time) wave = w;
      else break;
    }
    return wave;
  }

  private updateSpawns(dt: number) {
    const wave = this.currentWave();

    if (wave.boss && !this.bossSpawned) {
      this.bossSpawned = true;
      const def = this.enemyDefs.find((d) => d.id === wave.boss);
      if (def) {
        this.boss = this.spawn(def);
      }
    }

    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0 && this.enemies.length < this.config.maxEnemies) {
      this.spawnTimer = wave.spawnInterval;
      const id = wave.enemies[Math.floor(Math.random() * wave.enemies.length)];
      const def = this.enemyDefs.find((d) => d.id === id);
      if (def) this.spawn(def);
    }
  }

  private spawn(def: EnemyDef): Enemy {
    const angle = Math.random() * Math.PI * 2;
    const radius = 750 + Math.random() * 250;
    const e: Enemy = {
      id: this.nextEnemyId++,
      x: this.playerX + Math.cos(angle) * radius,
      y: this.playerY + Math.sin(angle) * radius,
      hp: def.hp,
      maxHp: def.hp,
      kx: 0,
      ky: 0,
      lastOrbitHit: -1,
      def,
    };
    this.enemies.push(e);
    return e;
  }

  private updateEnemies(dt: number) {
    const es = this.enemies;
    for (const e of es) {
      const dx = this.playerX - e.x;
      const dy = this.playerY - e.y;
      const d = Math.hypot(dx, dy) || 1;
      e.x += (dx / d) * e.def.speed * dt + e.kx * dt;
      e.y += (dy / d) * e.def.speed * dt + e.ky * dt;
      e.kx *= 1 - Math.min(1, 8 * dt);
      e.ky *= 1 - Math.min(1, 8 * dt);

      const touch = (e.def.size + PLAYER_SIZE) / 2;
      if (d < touch && this.invuln <= 0) {
        this.hp -= e.def.damage;
        this.invuln = this.config.invulnTime;
        e.kx = (-dx / d) * KNOCKBACK_FORCE;
        e.ky = (-dy / d) * KNOCKBACK_FORCE;
      }
    }

    for (let i = 0; i < es.length; i++) {
      for (let j = i + 1; j < es.length; j++) {
        const a = es[i];
        const b = es[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const minDist = (a.def.size + b.def.size) / 2;
        const d2 = dx * dx + dy * dy;
        if (d2 > 0.01 && d2 < minDist * minDist) {
          const d = Math.sqrt(d2);
          const push = ((minDist - d) / d) * 0.5;
          const px = dx * push;
          const py = dy * push;
          a.x -= px;
          a.y -= py;
          b.x += px;
          b.y += py;
        }
      }
    }
  }

  private updateWeapons(dt: number) {
    for (const w of this.weapons) {
      const s = weaponStats(w);
      switch (w.def.type) {
        case "projectile": {
          w.timer -= dt;
          if (w.timer <= 0) {
            w.timer = s.cooldown;
            this.fireProjectiles(s);
          }
          break;
        }
        case "nova": {
          w.timer -= dt;
          if (w.timer <= 0) {
            w.timer = s.cooldown;
            this.fireNova(s);
          }
          break;
        }
        case "aura": {
          w.timer -= dt;
          if (w.timer <= 0) {
            w.timer = s.cooldown;
            for (const e of this.enemies) {
              if (
                Math.hypot(e.x - this.playerX, e.y - this.playerY) <
                s.radius + e.def.size / 2
              ) {
                e.hp -= s.damage * this.damageMult;
              }
            }
          }
          break;
        }
        case "orbit": {
          w.angle += s.rotSpeed * dt;
          for (let i = 0; i < s.count; i++) {
            const a = w.angle + (i * Math.PI * 2) / s.count;
            const ox = this.playerX + Math.cos(a) * s.radius;
            const oy = this.playerY + Math.sin(a) * s.radius;
            for (const e of this.enemies) {
              if (this.time - e.lastOrbitHit < ORBIT_HIT_COOLDOWN) continue;
              if (
                Math.hypot(e.x - ox, e.y - oy) <
                (e.def.size + s.orbSize) / 2
              ) {
                e.hp -= s.damage * this.damageMult;
                e.lastOrbitHit = this.time;
                const d =
                  Math.hypot(e.x - this.playerX, e.y - this.playerY) || 1;
                e.kx += ((e.x - this.playerX) / d) * KNOCKBACK_FORCE * 0.5;
                e.ky += ((e.y - this.playerY) / d) * KNOCKBACK_FORCE * 0.5;
              }
            }
          }
          break;
        }
      }
    }
  }

  private fireProjectiles(s: Record<string, number>) {
    const target = this.nearestEnemy();
    let bx: number;
    let by: number;
    if (target) {
      bx = target.x - this.playerX;
      by = target.y - this.playerY;
    } else {
      bx = this.lastMoveX;
      by = this.lastMoveY;
    }
    const baseAngle = Math.atan2(by, bx);
    const count = s.count;
    for (let i = 0; i < count; i++) {
      const spread = (i - (count - 1) / 2) * 0.14;
      const a = baseAngle + spread;
      this.projectiles.push({
        x: this.playerX,
        y: this.playerY,
        dx: Math.cos(a),
        dy: Math.sin(a),
        damage: s.damage * this.damageMult,
        life: PROJECTILE_LIFE,
        size: s.size,
        speed: s.speed,
        pierce: s.pierce,
        hitIds: [],
      });
    }
  }

  private fireNova(s: Record<string, number>) {
    for (let i = 0; i < s.count; i++) {
      const a = (i / s.count) * Math.PI * 2;
      this.projectiles.push({
        x: this.playerX,
        y: this.playerY,
        dx: Math.cos(a),
        dy: Math.sin(a),
        damage: s.damage * this.damageMult,
        life: PROJECTILE_LIFE,
        size: s.size,
        speed: s.speed,
        pierce: s.pierce,
        hitIds: [],
      });
    }
  }

  private updateProjectiles(dt: number) {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.x += p.dx * p.speed * dt;
      p.y += p.dy * p.speed * dt;
      p.life -= dt;
      if (p.life <= 0) {
        this.projectiles.splice(i, 1);
        continue;
      }
      for (const e of this.enemies) {
        if (p.hitIds.includes(e.id)) continue;
        if (Math.hypot(e.x - p.x, e.y - p.y) < (e.def.size + p.size) / 2) {
          e.hp -= p.damage;
          p.hitIds.push(e.id);
          if (p.hitIds.length > p.pierce) {
            this.projectiles.splice(i, 1);
            break;
          }
        }
      }
    }
  }

  private updateGems(dt: number) {
    for (let i = this.gems.length - 1; i >= 0; i--) {
      const g = this.gems[i];
      const dx = this.playerX - g.x;
      const dy = this.playerY - g.y;
      const d = Math.hypot(dx, dy);
      if (d < this.pickupRadius) {
        const pull = 500 * dt;
        g.x += (dx / (d || 1)) * pull;
        g.y += (dy / (d || 1)) * pull;
      }
      if (d < PLAYER_SIZE / 2 + 10) {
        this.gems.splice(i, 1);
        this.gainXp(g.xp);
      }
    }
  }

  private gainXp(amount: number) {
    this.xp += amount;
    while (this.xp >= this.xpNext) {
      this.xp -= this.xpNext;
      this.level++;
      this.xpNext = 8 + (this.level - 1) * 6;
      this.pendingLevels++;
    }
  }

  private reapDead() {
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      if (e.hp <= 0) {
        this.enemies.splice(i, 1);
        this.kills++;
        this.gems.push({ x: e.x, y: e.y, xp: e.def.xp });
        if (e.def.boss) {
          this.boss = null;
          this.victory = true;
        }
      }
    }
  }

  private nearestEnemy(): Enemy | null {
    let best: Enemy | null = null;
    let bestD = Infinity;
    for (const e of this.enemies) {
      const d = Math.hypot(e.x - this.playerX, e.y - this.playerY);
      if (d < bestD) {
        bestD = d;
        best = e;
      }
    }
    return best;
  }

  orbitPositions(w: WeaponInstance): { x: number; y: number; size: number }[] {
    const s = weaponStats(w);
    const out: { x: number; y: number; size: number }[] = [];
    for (let i = 0; i < s.count; i++) {
      const a = w.angle + (i * Math.PI * 2) / s.count;
      out.push({
        x: this.playerX + Math.cos(a) * s.radius,
        y: this.playerY + Math.sin(a) * s.radius,
        size: s.orbSize,
      });
    }
    return out;
  }

  auraRadius(w: WeaponInstance): number {
    return weaponStats(w).radius;
  }
}

function clamp(v: number, min: number, max: number) {
  return v < min ? min : v > max ? max : v;
}
