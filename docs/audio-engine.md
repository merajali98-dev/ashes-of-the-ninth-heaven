# Local sound playback and mixing

`js/audio-engine.js` plays bundled samples through Web Audio. Importing the module creates no audio device, performs no request, and starts no sound. `game.sound` remains the opt-in switch controlled by the application; the engine itself starts disabled. No runtime synthesis, remote generation service, or oscillator fallback is used.

## Controller API

```js
configureAudio({
  enabled: game.sound,
  masterVolume: .65,
  combatVolume: .8,
  uiVolume: .55,
  progressionVolume: .8,
  petsVolume: .8,
});
await unlockAudio(); // call from the user's pointer or keyboard gesture
void preloadSounds();
const sound = playSound('cast-strike', {
  delay: 300, // milliseconds from this request, not from decode completion
  scope: 'combat:17',
  volume: .8,
  pitch: 1.02, // playback-rate ratio, bounded to .75–1.35
  pan: -.2, // optional stereo position, -1–1
});
await sound.ended; // resolves to {status, reason, cue}; it never rejects
stopAudioScope('combat:17');
stopAllAudio();
```

The controller schedules the cast, release, impact, and ceremony cues at their visual milestones. A scoped cancellation stops both future scheduled sources and sounds already playing. It also invalidates requests waiting for the catalogue or a decode. Muting or setting the master volume to zero performs the same hard cancellation across every scope. Re-enabling audio never resurrects those requests.

`preloadSounds(cueIds?)` loads the catalogue and decodes the requested cues, or the complete collection, with four concurrent workers. It is a no-op until audio has been enabled and unlocked. All file fetch/decode promises are cached by source path. A failed file is removed from the cache so a later explicit play can retry. Catalogue and sample failures resolve quietly as unavailable sounds rather than breaking an interaction or creating an unhandled promise.

## Timing and budgets

Every request records an absolute wall-clock deadline. Buffer loading does not move an impact later: a sound more than 150 ms late is discarded unless that cue explicitly defines another bounded tolerance. Sources ready early use `AudioBufferSourceNode.start()` with the exact remaining delay. Finishing a sound uses the native `onended` event plus a bounded watchdog for interrupted devices.

The mixer permits twelve simultaneous or scheduled voices and at most 48 outstanding requests. When full, a higher-priority cue can replace the oldest lowest-priority voice; an equally important or weaker new cue is dropped. Per-cue intervals prevent rapid UI chatter. Repeated cues can select deterministic variants without touching the game's random-number state.

Five user controls feed a master gain and four category gains: combat, interface, cultivation, and pets. Values are bounded to 0–1. Zero volume prevents new playback and cancels existing requests in the affected category. Per-clip gains and additional output headroom feed a dynamics compressor. Major cues duck the interface group to 45% of its configured volume, restoring it when those cues finish or are cancelled. This keeps purchases and clicks from covering a breakthrough.

## Catalogue and diagnostics

The lazy catalogue is `assets/audio/manifest.json`, with `version: 1` and a `cues` record. Each cue uses a local `assets/audio/<filename>.wav`, `.ogg`, or `.mp3` path, an optional variants list, category, gain, priority, cooldown in milliseconds, and duration. External/traversing file paths are rejected. `loadAudioCatalog()` explicitly loads detached metadata; `getAudioCatalog()` reads the already-loaded copy without fetching.

`getAudioDiagnostics()` returns detached settings, device state, current/pending/peak voice counts, cache size, counters, and the last 128 request lifecycle events. Events distinguish requested, loading, scheduled, started, completed, cancelled, dropped, and failed states. They are diagnostic presentation data and never enter a game save.

## Verification

`node --test tests/audio.test.js` passes nine tests using an injected clock, fetch implementation, and audio graph. Tests cover silent imports and muted calls, exact scheduling, one decode per file, cancellation during deferred decode, no late burst after unmuting, scoped voice cancellation, stale deadlines, zero-volume controls, voice priorities, cooldowns, nonfatal loading failures, safe local metadata, and bounded detached diagnostics. Browser QA separately checks native decoding and source-start calls; a mock graph does not establish subjective listening quality.

Asset production, source licenses, sound design, and measured sample characteristics belong to `docs/audio-assets.md`.
