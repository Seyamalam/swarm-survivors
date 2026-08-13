export interface DamageNumber {
  x: number;
  y: number;
  life: number;
  maxLife: number;
  value: number;
  r: number;
  g: number;
  b: number;
}

const MAX_NUMBERS = 128;
const RISE_SPEED = 90;
const LIFETIME = 0.7;

export class DamageNumbers {
  items: DamageNumber[] = [];
  private freelist: DamageNumber[] = [];

  spawn(
    x: number,
    y: number,
    value: number,
    color: [number, number, number] = [1, 0.95, 0.6]
  ) {
    if (this.items.length >= MAX_NUMBERS) return;
    const n = this.freelist.pop() ?? ({} as DamageNumber);
    n.x = x + (Math.random() - 0.5) * 16;
    n.y = y;
    n.value = Math.round(value);
    n.maxLife = LIFETIME;
    n.life = LIFETIME;
    [n.r, n.g, n.b] = color;
    this.items.push(n);
  }

  update(dt: number) {
    const items = this.items;
    for (let i = items.length - 1; i >= 0; i--) {
      const n = items[i];
      n.life -= dt;
      if (n.life <= 0) {
        items[i] = items[items.length - 1];
        items.pop();
        this.freelist.push(n);
        continue;
      }
      n.y -= RISE_SPEED * dt;
    }
  }
}
