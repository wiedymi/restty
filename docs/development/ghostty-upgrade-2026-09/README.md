# Ghostty core update: September 2026

Baseline: Restty 0.2.7. Updated core: upstream `492300cad104195411d12217dd22f1cd05f31376` plus the browser graphics patch in the pinned submodule. Both core builds use ReleaseSafe. The new build uses Zig 0.16.0 and SIMD128.

## Chrome core measurements

Host: Apple M1 Pro, macOS 27.0 (26A5421a). Engine: Headless Chrome 151.0.7922.138, V8 15.1.206.17. Three runs; each workload has 20 warmup iterations and 80 measured samples. Grid: 80 × 24. Browser viewport and user agent are in each JSON report.

The table shows the median of the three runs' median/p95/p99 values, in milliseconds. Browser timer precision limits interpretation of very small differences.

| Workload | 0.2.7 median / p95 / p99 | Updated median / p95 / p99 |
| --- | --- | --- |
| ASCII write + render-state read | 0.30 / 0.40 / 0.60 | 0.10 / 0.20 / 0.20 |
| Unicode write + render-state read | 0.40 / 0.60 / 0.70 | 0.20 / 0.30 / 0.40 |
| Styled write + render-state read | 0.30 / 0.40 / 0.50 | 0.20 / 0.20 / 0.30 |
| Copy 2,000 rows | 3.60 / 3.90 / 4.10 | 0.50 / 0.60 / 0.70 |
| Resize retained history | 0.30 / 0.40 / 0.60 | 0.20 / 0.40 / 0.50 |

Each input sample writes 256 lines (12–14 KiB), updates the terminal's render state, and reads all visible codepoints into a checksum. Copy validates exact text. Resize alternates 60 and 80 columns. These are core integration measurements, not GPU frame-rate measurements.

Five filled terminals in one WASM instance used 28,704,768 bytes before and 6,684,672 bytes after: about 77% less linear memory. Each terminal writes 2,000 lines with a 1,000,000-byte scrollback limit. The fresh module changed from 1,245,184 to 327,680 bytes. These figures exclude GPU textures, fonts, and JavaScript heap memory.

Resize tail results varied: one new run had a 0.50 ms p95 versus the baseline's 0.40 ms; the other two matched at 0.40 ms. Do not claim a clear resize tail improvement. The separate Bun 1.4.2 report has large isolated tail spikes in both builds and is not a Safari result.

## Rendering checks

Chrome's SwiftShader software graphics mode renders Unicode text, search highlights, and animated Kitty images with both WebGL2 and WebGPU. The screenshots show the selected backend in the event output. The test page also checks for JavaScript errors. Both backends were checked with native animation-frame callbacks. These checks validate rendering correctness, not hardware GPU performance.

Safari automation was unavailable: WebDriver requires Allow Remote Automation, and the computer-control tool could not capture the Safari window. A first self-running Safari attempt stopped because the benchmark retained too little history; that fixture was corrected, but no completed Safari comparison is included. Safari UI and timing checks remain unverified.

## Repeat the checks

Prepare the old JavaScript adapters without rebuilding its WASM:

```sh
git worktree add --detach /tmp/restty-baseline v0.2.7
mkdir -p /tmp/restty-baseline-bundles
bun build /tmp/restty-baseline/src/wasm/runtime/restty-wasm.ts --target=browser --outfile=/tmp/restty-baseline-bundles/runtime.js
bun build /tmp/restty-baseline/src/runtime/create-runtime/runtime-reporting.ts --target=browser --outfile=/tmp/restty-baseline-bundles/reporting.js
bun run build:wasm
bun scripts/bench-wasm.ts /tmp/restty-baseline-bundles /tmp/restty-benchmark-results
```

Open `http://127.0.0.1:4319/` in each browser for core timings. Open `/smoke` and `/smoke?renderer=webgpu` for rendering checks. Test hosts without a display can add `timer=1` to drive the render callback with a timer; that does not test native animation-frame scheduling. Reports are saved in the output directory.

## Trade-offs and scope

- Keep Restty's bulk typed-array ABI and renderer. Upstream C API per-cell call benchmarks do not describe this adapter.
- Keep the browser graphics patch explicit and opt-in. Filesystem image media stays in the host transport; Wuffs validates and decodes direct PNG data in WASM.
- Keep browser selection gestures in Restty; upstream formatting now extracts the selected buffer without moving the viewport.
- Use upstream whole-terminal search and stream handling. Keep Restty device identity and reply-buffer limits.
- Relative placements rooted in normal placements work. Relative placements rooted in virtual placeholders still need renderer-specific positioning and are not included.
- SIMD128 changes the supported browser floor. Direct WASM hosts need `env.now_ms`; the standard JS loader supplies it.
