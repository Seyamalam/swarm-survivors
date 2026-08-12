const SIM_HZ = 120;
const STEP = 1 / SIM_HZ;
const MAX_FRAME = 0.25;

export function startLoop(update: (dt: number) => void, render: () => void) {
  let last = performance.now();
  let acc = 0;
  const frame = (now: number) => {
    let elapsed = (now - last) / 1000;
    last = now;
    if (elapsed > MAX_FRAME) elapsed = MAX_FRAME;
    acc += elapsed;
    while (acc >= STEP) {
      update(STEP);
      acc -= STEP;
    }
    render();
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}
