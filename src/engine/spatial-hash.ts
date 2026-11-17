export interface HashedEntity {
  x: number;
  y: number;
  def: { size: number };
}

export class SpatialHash<T extends HashedEntity> {
  private cells = new Map<number, T[]>();
  private cols: number;

  constructor(
    private cellSize: number,
    worldWidth = 10000
  ) {
    this.cols = Math.ceil(worldWidth / cellSize);
  }

  clear() {
    for (const bucket of this.cells.values()) bucket.length = 0;
  }

  private key(cx: number, cy: number): number {
    return (cy + this.cols / 2) * this.cols + (cx + this.cols / 2);
  }

  insert(e: T) {
    const cx = Math.floor(e.x / this.cellSize);
    const cy = Math.floor(e.y / this.cellSize);
    const k = this.key(cx, cy);
    let bucket = this.cells.get(k);
    if (!bucket) {
      bucket = [];
      this.cells.set(k, bucket);
    }
    bucket.push(e);
  }

  rebuild(entities: T[]) {
    this.clear();
    for (const e of entities) this.insert(e);
  }

  queryCircle(x: number, y: number, radius: number, out: T[]): T[] {
    out.length = 0;
    const x0 = Math.floor((x - radius) / this.cellSize);
    const x1 = Math.floor((x + radius) / this.cellSize);
    const y0 = Math.floor((y - radius) / this.cellSize);
    const y1 = Math.floor((y + radius) / this.cellSize);
    for (let cy = y0; cy <= y1; cy++) {
      for (let cx = x0; cx <= x1; cx++) {
        const bucket = this.cells.get(this.key(cx, cy));
        if (bucket) out.push(...bucket);
      }
    }
    return out;
  }
}
