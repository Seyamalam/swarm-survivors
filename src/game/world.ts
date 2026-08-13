import type { EnemyDef, WeaponDef, Wave } from "./types";
import { createWeapon, weaponStats, type WeaponInstance } from "./weapons";
import { SpatialHash } from "../engine/spatial-hash";
import { Particles } from "./vfx/particles";
import { DamageNumbers } from "./vfx/damage-numbers";
import { UV } from "../engine/renderer";

export interface Enemy {
  id: number;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  kx: number;
  ky: number;
  flash: number;
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
const MAX_ENEMY_SIZE = 140;

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

  readonly particles = new Particles();
  readonly dmgNumbers = new DamageNumbers();
  shake = 0;
  hitStop = 0;
  godMode = false;

  kills = 0;
  time = 0;
  victory = false;
  boss: Enemy | null = null;

  private spawnTimer = 0;
  private bossSpawned = false;
  private nextEnemyId = 1;
  private lastMoveX = 1;
  private lastMoveY = 0;
  private hash = new SpatialHash<Enemy>(96);
  private scratch: Enemy[] = [];
  private enemyPool: Enemy[] = [];
  private projectilePool: Projectile[] = [];
  private gemPool: Gem[] = [];

  constructor(
    private enemyDefs: EnemyDef[],
    allWeapons: WeaponDef[],
    private waves: Wave[],
    readonly config: LevelConfig,
    readonly useSpatialHash = true
  ) {
    this.hp = config.playerMaxHp;
    this.maxHp = config.playerMaxHp;
    this.pickupRadius = config.pickupRadius;
    this.addWeapon(allWeapons[0]);
  }

  get alive() {
    return this.godMode || this.hp > 0;
  }

  addWeapon(def: WeaponDef) {
    this.weapons.push(createWeapon(def));
  }

  upgradeWeapon(id: string) {
    const w = this.weapons.find((w) => w.def.id === id);
    if (w && w.level < w.def.levels.length) w.level++;
  }

  stress(count: number) {
    this.godMode = true;
    for (let i = 0; i < count; i++) {
      const def =
        this.enemyDefs[Math.floor(Math.random() * (this.enemyDefs.length - 1))];
      const angle = Math.random() * Math.PI * 2;
      const radius = 300 + Math.random() * 1100;
      const e = this.enemyPool.pop() ?? ({} as Enemy);
      e.id = this.nextEnemyId++;
      e.x = this.playerX + Math.cos(angle) * radius;
      e.y = this.playerY + Math.sin(angle) * radius;
      e.hp = def.hp;
      e.maxHp = def.hp;
      e.kx = 0;
      e.ky = 0;
      e.flash = 0;
      e.lastOrbitHit = -1;
      e.def = def;
      this.enemies.push(e);
    }
  }

  update(dt: number, moveX: number, moveY: number) {
    if (!this.alive || this.victory) return;
    this.time += dt;
    if (this.invuln > 0) this.invuln -= dt;
    if (this.shake > 0) this.shake = Math.max(0, this.shake - dt * 2);
    if (this.godMode && this.hp < 1) this.hp = 1;

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
    if (this.useSpatialHash) this.hash.rebuild(this.enemies);
    this.separateEnemies();
    this.updateWeapons(dt);
    this.updateProjectiles(dt);
    this.updateGems(dt);
    this.particles.update(dt);
    this.dmgNumbers.update(dt);
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
    if (this.godMode) return;
    const wave = this.currentWave();

    if (wave.boss && !this.bossSpawned) {
      this.bossSpawned = true;
      const def = this.enemyDefs.find((d) => d.id === wave.boss);
      if (def) this.boss = this.spawn(def);
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
    const e = this.enemyPool.pop() ?? ({} as Enemy);
    e.id = this.nextEnemyId++;
    e.x = this.playerX + Math.cos(angle) * radius;
    e.y = this.playerY + Math.sin(angle) * radius;
    e.hp = def.hp;
    e.maxHp = def.hp;
    e.kx = 0;
    e.ky = 0;
    e.flash = 0;
    e.lastOrbitHit = -1;
    e.def = def;
    this.enemies.push(e);
    return e;
  }

  private updateEnemies(dt: number) {
    for (const e of this.enemies) {
      const dx = this.playerX - e.x;
      const dy = this.playerY - e.y;
      const d = Math.hypot(dx, dy) || 1;
      e.x += (dx / d) * e.def.speed * dt + e.kx * dt;
      e.y += (dy / d) * e.def.speed * dt + e.ky * dt;
      e.kx *= 1 - Math.min(1, 8 * dt);
      e.ky *= 1 - Math.min(1, 8 * dt);
      if (e.flash > 0) e.flash = Math.max(0, e.flash - dt * 5);
    }

    if (this.invuln <= 0) {
      const touching = this.useSpatialHash
        ? this.hash.queryCircle(
            this.playerX,
            this.playerY,
            (PLAYER_SIZE + MAX_ENEMY_SIZE) / 2,
            this.scratch
          )
        : this.enemies;
      for (const e of touching) {
        const d = Math.hypot(e.x - this.playerX, e.y - this.playerY);
        const touch = (e.def.size + PLAYER_SIZE) / 2;
        if (d < touch) {
          this.hp -= e.def.damage;
          this.invuln = this.config.invulnTime;
          this.shake = Math.min(1, this.shake + 0.3);
          const dir = d || 1;
          e.kx = ((e.x - this.playerX) / dir) * KNOCKBACK_FORCE;
          e.ky = ((e.y - this.playerY) / dir) * KNOCKBACK_FORCE;
          break;
        }
      }
    }
  }

  private separateEnemies() {
    const es = this.enemies;
    if (this.useSpatialHash) {
      for (const a of es) {
        const radius = (a.def.size + MAX_ENEMY_SIZE) / 2;
        const neighbors = this.hash.queryCircle(a.x, a.y, radius, this.scratch);
        for (const b of neighbors) {
          if (b.id <= a.id) continue;
          this.pushApart(a, b);
        }
      }
    } else {
      for (let i = 0; i < es.length; i++) {
        for (let j = i + 1; j < es.length; j++) {
          this.pushApart(es[i], es[j]);
        }
      }
    }
  }

  private pushApart(a: Enemy, b: Enemy) {
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

  damageEnemy(e: Enemy, amount: number) {
    e.hp -= amount;
    e.flash = 0.18;
    this.dmgNumbers.spawn(e.x, e.y - e.def.size / 2, amount);
    this.particles.emit(e.x, e.y, {
      count: 3,
      speed: 220,
      life: 0.3,
      size: 7,
      color: [1, 0.9, 0.5],
      uv: UV.spark,
    });
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
            const targets = this.useSpatialHash
              ? this.hash.queryCircle(
                  this.playerX,
                  this.playerY,
                  s.radius + MAX_ENEMY_SIZE / 2,
                  this.scratch
                )
              : this.enemies;
            for (const e of targets) {
              if (
                Math.hypot(e.x - this.playerX, e.y - this.playerY) <
                s.radius + e.def.size / 2
              ) {
                this.damageEnemy(e, s.damage * this.damageMult);
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
            const targets = this.useSpatialHash
              ? this.hash.queryCircle(
                  ox,
                  oy,
                  (s.orbSize + MAX_ENEMY_SIZE) / 2,
                  this.scratch
                )
              : this.enemies;
            for (const e of targets) {
              if (this.time - e.lastOrbitHit < ORBIT_HIT_COOLDOWN) continue;
              if (
                Math.hypot(e.x - ox, e.y - oy) <
                (e.def.size + s.orbSize) / 2
              ) {
                e.lastOrbitHit = this.time;
                this.damageEnemy(e, s.damage * this.damageMult);
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

  private makeProjectile(
    angle: number,
    s: Record<string, number>,
    out: Projectile
  ): Projectile {
    out.x = this.playerX;
    out.y = this.playerY;
    out.dx = Math.cos(angle);
    out.dy = Math.sin(angle);
    out.damage = s.damage * this.damageMult;
    out.life = PROJECTILE_LIFE;
    out.size = s.size;
    out.speed = s.speed;
    out.pierce = s.pierce;
    if (!out.hitIds) out.hitIds = [];
    out.hitIds.length = 0;
    return out;
  }

  private fireProjectiles(s: Record<string, number>) {
    const target = this.nearestEnemy();
    const bx = target ? target.x - this.playerX : this.lastMoveX;
    const by = target ? target.y - this.playerY : this.lastMoveY;
    const baseAngle = Math.atan2(by, bx);
    for (let i = 0; i < s.count; i++) {
      const spread = (i - (s.count - 1) / 2) * 0.14;
      this.projectiles.push(
        this.makeProjectile(
          baseAngle + spread,
          s,
          this.projectilePool.pop() ?? ({} as Projectile)
        )
      );
    }
  }

  private fireNova(s: Record<string, number>) {
    for (let i = 0; i < s.count; i++) {
      const a = (i / s.count) * Math.PI * 2;
      this.projectiles.push(
        this.makeProjectile(
          a,
          s,
          this.projectilePool.pop() ?? ({} as Projectile)
        )
      );
    }
  }

  private updateProjectiles(dt: number) {
    const ps = this.projectiles;
    for (let i = ps.length - 1; i >= 0; i--) {
      const p = ps[i];
      p.x += p.dx * p.speed * dt;
      p.y += p.dy * p.speed * dt;
      p.life -= dt;
      if (p.life <= 0) {
        ps[i] = ps[ps.length - 1];
        ps.pop();
        this.projectilePool.push(p);
        continue;
      }
      const targets = this.useSpatialHash
        ? this.hash.queryCircle(
            p.x,
            p.y,
            p.size / 2 + MAX_ENEMY_SIZE / 2,
            this.scratch
          )
        : this.enemies;
      let dead = false;
      for (const e of targets) {
        if (p.hitIds.includes(e.id)) continue;
        if (Math.hypot(e.x - p.x, e.y - p.y) < (e.def.size + p.size) / 2) {
          this.damageEnemy(e, p.damage);
          p.hitIds.push(e.id);
          if (p.hitIds.length > p.pierce) {
            ps[i] = ps[ps.length - 1];
            ps.pop();
            this.projectilePool.push(p);
            dead = true;
            break;
          }
        }
      }
      if (dead) continue;
    }
  }

  private updateGems(dt: number) {
    const gs = this.gems;
    for (let i = gs.length - 1; i >= 0; i--) {
      const g = gs[i];
      const dx = this.playerX - g.x;
      const dy = this.playerY - g.y;
      const d = Math.hypot(dx, dy);
      if (d < this.pickupRadius) {
        const pull = 500 * dt;
        g.x += (dx / (d || 1)) * pull;
        g.y += (dy / (d || 1)) * pull;
      }
      if (d < PLAYER_SIZE / 2 + 10) {
        gs[i] = gs[gs.length - 1];
        gs.pop();
        this.gemPool.push(g);
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
      this.particles.emit(this.playerX, this.playerY, {
        count: 24,
        speed: 300,
        life: 0.6,
        size: 9,
        color: [0.4, 0.85, 1],
        uv: UV.spark,
      });
    }
  }

  private reapDead() {
    const es = this.enemies;
    for (let i = es.length - 1; i >= 0; i--) {
      const e = es[i];
      if (e.hp <= 0) {
        es[i] = es[es.length - 1];
        es.pop();
        this.enemyPool.push(e);
        this.kills++;

        const g = this.gemPool.pop() ?? ({} as Gem);
        g.x = e.x;
        g.y = e.y;
        g.xp = e.def.xp;
        this.gems.push(g);

        this.particles.emit(e.x, e.y, {
          count: e.def.boss ? 80 : 10,
          speed: e.def.boss ? 500 : 260,
          life: 0.5,
          size: e.def.boss ? 14 : 9,
          color: e.def.color,
          uv: UV.spark,
        });

        if (e.def.xp >= 5) {
          this.hitStop = Math.max(this.hitStop, 0.06);
          this.shake = Math.min(1, this.shake + 0.12);
        }

        if (e.def.boss) {
          this.boss = null;
          this.victory = true;
          this.shake = 1;
          this.hitStop = 0.3;
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
