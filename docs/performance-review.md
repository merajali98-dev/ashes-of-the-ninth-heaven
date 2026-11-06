# Browser performance review

Reviewed and implemented November 5, 2026.

## Findings and implementation plan

1. **Battle selection rebuilt the whole app.** Every card click, number key, Escape, and cancelled drag recreated the shell, hand, portraits and target controls. It also resolved every card and simulated the entire next turn through `previewEndTurn`, even though combat state had not changed. Implemented a selection-only update in `game-hub.js`, sharing trajectory and cast-control markup with the full renderer. Hand and hero DOM nodes, decoded images, focus and hand scroll remain mounted. Actual combat actions continue through the authoritative rules, synchronous save, full screen render and existing animation lifecycle.
2. **All screen updates recreated the toolbar and navigation.** Implemented persistent shell/main nodes, with header and dock replacement only when their generated markup changes. Filters and transactions still generate fresh screen content, preventing stale prices, ownership, resource counts or forecasts.
3. **The local server resent every file on reload and served text uncompressed.** Added ETag and Last-Modified validation with 304 responses, and gzip streaming for supported text assets. Unversioned files use `Cache-Control: no-cache`, so the browser validates them and sees local edits immediately. WebP and audio are not recompressed. HEAD, MIME types and public-path restrictions remain covered.
4. **Every sound cloned the entire cue catalogue.** Playback and preloading now use a private cached catalogue. Public catalogue APIs still return detached copies. Existing decode deduplication, voice limits and cancellation remain in place.

## Measurements

Headless Microsoft Edge, same machine and seeded battle, 60 alternating select/deselect keyboard events per viewport, 4× CPU slowdown. Each sample includes synchronous event handling and forced layout, with one animation-frame boundary between events. These are selection latency measurements, not FPS or GPU benchmarks. Reduced motion was not enabled.

| Selection latency | Before | After |
| --- | ---: | ---: |
| Desktop 1440×1000 median | 19.8 ms | 5.5 ms |
| Desktop p95 | 83.7 ms | 19.6 ms |
| Mobile viewport 390×844 median | 30.2 ms | 4.0 ms |
| Mobile viewport p95 | 128.1 ms | 11.9 ms |
| Warm reload resource transfer, either viewport | 1,611,341 bytes | 18,900 bytes |

Desktop selection p95 fell 77%; mobile viewport p95 fell 91%. Warm reload transfer fell approximately 99%; the 63 resource requests still revalidate. Mobile viewport measurements use desktop Edge with CPU throttling, not a physical phone. Timing varies with machine load, browser and device. An earlier post-change run measured 27.0 ms desktop / 24.1 ms mobile p95; both runs improved substantially over the original implementation.

Raw measurements: `tmp/performance-before.json` and `tmp/performance-after.json`. The benchmark asserts that selection preserves the screen, hand and hero nodes, leaves the saved encounter unchanged, and matches the authoritative full renderer's hand, cast controls, targets and accessibility attributes.

## Verification and future profiling

- `npm test`: rules, saves, economic transactions, audio lifecycle and HTTP compression/cache regression coverage.
- `npm run test:performance`: isolated port-4184 browser benchmark plus selection equivalence and persistent-shell assertions on desktop/mobile viewports.
- `npm run test:browser`: existing motion, Workshop, pet, audio, expansion, tutorial and Treasury browser suites, with a managed port-4181 server. Tutorial and Treasury use their own ports.

Validation result: all 151 unit/integration tests and all seven browser suites passed. Motion checks now observe the brief reduced-motion receipt inside the page and test keyboard dismissal separately from screenshot encoding. Pet cooldown checks wait for the intentional combat animation input lock to finish. These changes retain the behavior assertions while removing timing assumptions from older tests.

The benchmark and existing browser suites require Playwright and Edge at the configured Windows paths. Actual gameplay and saved-game formats do not acquire dependencies.

Keep profiling focused on evidence: if a specific device still stutters during effects, capture a browser Performance trace of that action and inspect paint/raster/compositor time before changing the visuals. This pass leaves the existing effects and artwork intact. Additional full-screen DOM reconciliation, catalogue memoization or artwork resizing should be driven by traces showing they dominate remaining work; mutable game objects make broad caching vulnerable to stale state.
