export function startLoop(update: (dt: number) => void, render: () => void) {
  let last = performance.now();
  const frame = (now: number) => {
    const dt = Math.min((now - last) / 1000, 0.1);
    last = now;
    update(dt);
    render();
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}
