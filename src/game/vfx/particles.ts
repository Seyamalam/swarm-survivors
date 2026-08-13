import type { UVRect } from "../../engine/renderer";

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  r: number;
  g: number;
  b: number;
  uv: UVRect;
}

export interface EmitOptions {
  count: number;
  speed: number;
  life: number;
  size: number;
  color: [number, number, number];
  uv: UVRect;
  baseAngle?: number;
  spread?: number;
}

const MAX_PARTICLES = 2048;

export class Particles {
  items: Particle[] = [];
  private freelist: Particle[] = [];

  emit(x: number, y: number, opts: EmitOptions) {
    for (let i = 0; i < opts.count; i++) {
      if (this.items.length >= MAX_PARTICLES) return;
      const angle =
        opts.baseAngle !== undefined
          ? opts.baseAngle +
            (Math.random() - 0.5) * (opts.spread ?? Math.PI * 2)
          : Math.random() * Math.PI * 2;
      const speed = opts.speed * (0.4 + Math.random() * 0.6);
      const p = this.freelist.pop() ?? ({} as Particle);
      p.x = x;
      p.y = y;
      p.vx = Math.cos(angle) * speed;
      p.vy = Math.sin(angle) * speed;
      p.maxLife = opts.life * (0.6 + Math.random() * 0.4);
      p.life = p.maxLife;
      p.size = opts.size * (0.7 + Math.random() * 0.6);
      [p.r, p.g, p.b] = opts.color;
      p.uv = opts.uv;
      this.items.push(p);
    }
  }

  update(dt: number) {
    const items = this.items;
    for (let i = items.length - 1; i >= 0; i--) {
      const p = items[i];
      p.life -= dt;
      if (p.life <= 0) {
        items[i] = items[items.length - 1];
        items.pop();
        this.freelist.push(p);
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 1 - Math.min(1, 3 * dt);
      p.vy *= 1 - Math.min(1, 3 * dt);
    }
  }
}
