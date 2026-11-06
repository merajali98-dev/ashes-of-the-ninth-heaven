# Sound palette and asset production

The game now has 60 named sound cues backed by 64 distinct local WAV recordings. Four frequently repeated cues have subtle alternate takes: UI click, selection, card draw, and light impact. The runtime files total **2,236,826 bytes (2.13 MiB)**. The full 19.92-second audition sequence is [`assets/audio/audition.wav`](../assets/audio/audition.wav).

These are rendered audio assets, not the previous live single-oscillator beeps. The production combines freely downloadable Kenney Foley with original deterministic digital sound design: inharmonic jade bells, layered pentatonic chimes, filtered air sweeps, low resonant pulses, crystalline grains, short reflected tails, and synthesized mythical-creature voices. No paid audio service, proprietary library, voice actor, or real animal recording was used. The creature sounds are stylized original DSP calls rather than claims of authentic animal recordings.

## Verified free sources and rights

The creator's official pages identify all three packs as CC0:

- [Interface Sounds, Kenney](https://kenney.nl/assets/interface-sounds): physical clicks, opens, closes, selection, and crystalline UI components.
- [Impact Sounds, Kenney](https://kenney.nl/assets/impact-sounds): metal, glass, punch, bell, and mining Foley.
- [RPG Audio, Kenney](https://kenney.nl/assets/rpg-audio): card/book handling, cloth, blade movement, and coins.

Each pack's included `License.txt` was read and copied into `assets/audio/licenses/kenney-*-CC0.txt`. CC0 permits commercial reuse and modification without mandatory attribution; Kenney is nevertheless credited here and in the manifest. The original project compositions remain under the project owner's control; `assets/audio/licenses/original-dsp-NOTICE.txt` deliberately makes no public-domain dedication of the owner's original work. Thus the statement “Kenney components are CC0” does not give away the project's original contributions.

Thirty selected original OGG clips are retained under `assets/audio/source/` for provenance and rebuilding; 24 are actually used in the final mixes. `assets/audio/manifest.json` records every source clip's SHA-256 hash, the primary source pages and license files, and the exact Foley clip IDs used by each cue. The six retained spare source clips are not referenced by runtime cues. Original downloaded ZIP archives are under `tmp/audio-source/`, outside the served game directories.

The official download site now obtains a fresh signed URL through its normal same-origin download flow. Old cached media links return the asset page rather than a ZIP. The production used the site's public “Continue without donating” workflow with a normal page session, then verified ZIP contents and the supplied license. Signed links are transient; the stable source pages above are the provenance references.

## Sound direction

| Family | Cues and design |
| --- | --- |
| Twelve card casts | `cast-strike`, `cast-ward`, `cast-mantra`, `cast-remedy`, `cast-hex`, `cast-formation`, `cast-stance`, `cast-counter`, `cast-pact`, `cast-ritual`, `cast-transmute`, `cast-finisher`. Each has a different arrangement and spectrum: blade air, crystal assembly, scripture arpeggio, soft petals, reversed whisper, low ground resonance, drawn steel, returning air, low covenant pulse, ticking chronoring, changing crystal, and an ascending celestial charge. |
| Combat facts | `impact-light`, `impact-heavy`, `blocked`, `shield-break`, `heal`, `status`, `tick`, `cleanse`, `dispel`, `recover`, `resonance`, `phase`, `ritual-resolve`, `pet-command`. Cast identity is anticipation; physical hits are separately scheduled at the actual visual release. |
| Interaction | `ui-click`, `ui-select`, `ui-open`, `ui-close`, `ui-error`, `card-draw`, `turn-end`, `turn-start`, `purchase`, `deck-save`, `deck-equip`, and `sound-preview`. There is no persistent hover noise. |
| Workshop and rewards | `forge`, `upgrade`, `salvage`, `reward`, `rest`, `victory`, `defeat`: physical handling and material textures with short original melodic accents. |
| Cultivation and pets | `hero-layer`, `hero-realm`, `pet-layer`, `pet-hatch`, `egg-crack`, `pet-evolve`, `pet-feed`: restrained ascending layer notices, larger gong/air/bell realm ceremonies, shell crack and awakening, and soft nourishment. |
| Eight spirit voices | `pet-azure-dragon`, `pet-vermilion-phoenix`, `pet-white-tiger`, `pet-black-tortoise`, `pet-nine-tail-fox`, `pet-jade-qilin`, `pet-kun-peng`, `pet-thunder-serpent`: low cloud growl, rising feather whistle, rough winter growl, deep stillwater hum, three-part spectral call, harmonic jade voice, airborne whale-like sweep, and electric sibilance. |

The eight species voices are quieter than principal attacks and have a 1.2-second cue cooldown. Repeated impacts and UI actions have shorter rate limits. Priorities and group gains are encoded in the manifest; scheduling, polyphony, mute, ducking, and bus volume belong to `js/audio-engine.js` and the controller.

## Production and objective verification

All final runtime recordings are little-endian PCM16, mono, **22,050 Hz**. This format decodes natively in the target browsers and keeps offline deployment small. Runtime cue durations are approximately 0.14–2.70 seconds. Four alternate recordings retain exactly their parent cue's duration. The audition is a separate longer demonstration and is not a triggered game cue.

- 64 runtime files have 64 unique SHA-256 hashes.
- Maximum rendered sample peak is 0.84 full scale, approximately −1.51 dBFS; alternate takes peak at 0.74.
- The quietest cue has RMS 0.05185; all cues are finite, nonempty, and contain nonzero signal by measurement.
- Every file has a short onset fade and release fade to avoid hard digital clicks. Quiet reflection tails remain inside the allocated clip duration.
- There is no runtime oscillator fallback, remote audio dependency, streaming music, or audio uploaded to an external generation service.

Detailed per-file duration, peak, RMS, and hashes are in `assets/audio/levels-report.json`. These measurements establish file integrity and headroom, not a substitute for listening on speakers and headphones. The audition allows a human to assess the palette and balance. Native browser decoding and integration checks are recorded separately by independent QA.

## Rebuild

1. Obtain the three official CC0 packs and extract them under `tmp/audio-source/interface`, `impact`, and `rpg`.
2. Run `python scripts/prepare-audio-sources.py` to stage the selected source clips and license notices.
3. With the game server running on port 4173, run `node scripts/decode-audio-sources.mjs`. This uses the local Playwright/Edge paths in that script to decode the OGG sources through the browser's native Web Audio decoder. Decoded float samples are temporary build inputs under `tmp/audio-source/decoded`.
4. Run `python scripts/build-audio.py` with Python 3 and NumPy. It writes the WAV files, four alternate takes, manifest, audition, and measurement report. No SciPy, FFmpeg, sound-generation API key, or paid service is required.

The seeded noise and specified arrangements are deterministic in the supplied NumPy/runtime environment. The existing shipped WAVs require no Python or build dependency to play.
