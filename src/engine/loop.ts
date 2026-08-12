const SIM_HZ = 120;
const STEP = 1 / SIM_HZ;
const MAX_FRAME = 0.25;

export interface FrameTiming {
  updateMs: number;
  renderMs: number;
}

export function startLoop(
  update: (dt: number) => void,
  render: () => void,
  onFrame?: (timing: FrameTiming) => void
) {
  let last = performance.now();
  let acc = 0;
  const frame = (now: number) => {
    let elapsed = (now - last) / 1000;
    last = now;
    if (elapsed > MAX_FRAME) elapsed = MAX_FRAME;
    acc += elapsed;
    const u0 = performance.now();
    while (acc >= STEP) {
      update(STEP);
      acc -= STEP;
    }
    const u1 = performance.now();
    render();
    const u2 = performance.now();
    onFrame?.({ updateMs: u1 - u0, renderMs: u2 - u1 });
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}
