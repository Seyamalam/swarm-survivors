# Benchmark: naive vs optimized renderer + collision

Measured with `npm run benchmark` (headless Chromium, 1280x720, 8s samples, god-mode stress spawns).

> Note: headless Chromium renders via SwiftShader (software GL), so absolute FPS is CPU-bound.
> On real GPUs the optimized path holds much higher framerates — the meaningful column is the
> naive-vs-optimized ratio, especially update ms (collision/separation) which is GPU-independent.
> Update ms at low FPS also includes fixed-timestep catch-up ticks (120Hz accumulator).

| Mode      | Enemies | FPS | Update ms | Render ms |
| --------- | ------- | --- | --------- | --------- |
| naive     | 500     | 39  | 1.69      | 0.16      |
| naive     | 2000    | 3   | 261.72    | 0.58      |
| naive     | 5000    | 1   | 1652.16   | 1.24      |
| naive     | 10000   | 0   | 5800.7    | 1.67      |
| optimized | 500     | 70  | 0.52      | 0.07      |
| optimized | 2000    | 22  | 9.15      | 0.18      |
| optimized | 5000    | 5   | 148.67    | 0.32      |
| optimized | 10000   | 2   | 421.98    | 0.51      |

- **naive**: one draw call per sprite, O(n²) collision and separation
- **optimized**: single instanced draw call, spatial-hash collision, pooled entities, bloom enabled
