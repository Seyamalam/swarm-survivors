export class Input {
  private keys = new Set<string>();

  constructor(target: Window) {
    target.addEventListener("keydown", (e) => this.keys.add(e.key.toLowerCase()));
    target.addEventListener("keyup", (e) => this.keys.delete(e.key.toLowerCase()));
  }

  get moveX(): number {
    return (this.keys.has("d") || this.keys.has("arrowright") ? 1 : 0) -
      (this.keys.has("a") || this.keys.has("arrowleft") ? 1 : 0);
  }

  get moveY(): number {
    return (this.keys.has("s") || this.keys.has("arrowdown") ? 1 : 0) -
      (this.keys.has("w") || this.keys.has("arrowup") ? 1 : 0);
  }
}
