# Sound overhaul verification

Independent verification on Windows / native Microsoft Edge, 5 November 2026.

## Automated coverage

- The complete Node test suite passes: 139 tests. Audio tests cover legacy preference migration, validation, five volume channels, decode cancellation, scheduling, voice limits, variants, asset integrity, and mixer category assignments.
- All 60 named cues and their 64 unique WAV files have valid PCM headers, distinct SHA-256 hashes matching the production report, nonzero RMS, and source/license records. Native Edge independently fetched and decoded every deployed WAV with correct audio MIME types and finite, nonzero samples.
- Twelve real card casts start twelve distinct category recordings. Impact sounds follow the corresponding visual release timing; saved combat state matches the same single rules-engine action exactly.
- Native sources stop on scoped cancellation. Muting during deferred decoding and unmuting does not resurrect an obsolete request. Zero master volume prevents playback; muting combat leaves UI sounds available. Overlapping requests remain within the 12-voice cap. Round-robin variants produce different actual native PCM.
- Real shop purchases retain their success cue while the inspection dialog refreshes. Companion commands, species calls, feeding, pet layer growth/evolution, hero layers and breakthroughs produce their assigned cues. Skipping growth ceremonies clears pending/active voices. Reloading a progressed save does not replay the celebration.
- Five sliders persist immediately and respond to keyboard arrows at a 390-pixel viewport without overflowing. Fresh and legacy-muted games remain silent; an enabled save does not autoplay on reload. Missing audio is a recoverable presentation failure.
- Hatching starts its real ceremony, shell-crack, and species sources; native audio-clock scheduling follows the approximately 900 ms and 1800 ms visual phases. Opening Settings during a card's windup cancels its pending impact. Workshop, outcome/draw, and pet-growth cues obey their corrected UI, combat, and progression mute groups.
- The existing motion browser regression also passes all twelve card types, input cancellation, progression, and mobile checks.

The final complete sound browser run exited successfully with zero JavaScript or HTTP errors.

## Native output measurements

A native AnalyserNode was inserted transparently between the real compressor and AudioContext destination. Real source PCM, source start/stop events, and output samples were observed; playback was not replaced with a mock oscillator.

With the default mixer restored (master 0.65, combat 0.8, UI 0.55, progression 0.8, pets 0.8), an isolated complete preview measured peak **0.209175**, sampled RMS **0.040932**, and completed naturally. The 2048-frame analyser was sampled every 4 ms for approximately 983 ms.

A Finisher plus its delayed heavy impact measured peak **0.368516**, sampled RMS **0.063557**. A capped overlapping burst measured peak **0.643852**, sampled RMS **0.138090**. These runs produced materially nonzero output without reaching digital clipping. Browser analyser sampling overlaps frames and includes silent portions; these are reproducible diagnostic measurements, not calibrated loudness or listening-quality ratings.

No human listening assessment is claimed. The audition montage is available at `assets/audio/audition.wav` for listening review. Provenance and rebuilding details are in `docs/audio-assets.md`.

## Reproduction

Run `node --test`. For native browser verification, start a separate local server with `PORT=4181`, then run `node tests/audio-browser.mjs`. That script uses the installed Edge and bundled Playwright paths documented in its imports. It writes desktop/mobile mixer screenshots under `tmp/audio-browser/`, checks HTTP/browser errors, and prints asset, cast, and native output statistics.

The independent QA server is stopped after verification; the user's development server on port 4173 is managed separately.
