# Forbidden Lineages card art

Original art is generated with the built-in ImageGen tool as individual 4-by-4 atlas deliverables, matching the established game production pipeline. Each cell has its own authored technique subject. Final square WebP crops are saved as `assets/art/card-<id>.webp`; original sheets remain in the tool's generated-images directory.

The render brief uses premium contemporary Chinese 3D CGI cultivation imagery, realistic faces and hair, physically based metal and jade, layered silk, cinematic light, legible central subjects, and the existing midnight-indigo school palettes. Dark titles are interpreted through qi, objects, armor, and architecture without graphic injury. No labels or interface decorations appear in the artwork.

The completed library contains 480 new illustrations: 60 each for Iron Oath, Cinder Art, Grave Tide, Hollow Veil, Jade Sutra, Storm Script, Astral Seal, and Common Form. These join the original 117 card images for 597 distinct card illustrations. The consuming manifest is `js/expansion-art.js`.

The [complete final source prompt set](expansion-art-prompts.md) records every atlas call, including all 480 individual scene directives. Built-in ImageGen was used throughout; no fallback API or CLI generation was used.

## Final verification

- All 480 expansion WebP files decode successfully; all 480 file hashes and decoded-pixel hashes are distinct.
- All 597 original plus expansion card files exist and have distinct SHA-256 hashes.
- The expansion manifest contains exactly 480 authored IDs, with no missing or unexpected entries.
- Every final crop is square: 360 at 309 × 309 pixels and 120 at 310 × 310 pixels, matching the resolution of the existing card library. The total expansion art download size is 16,312,164 bytes (15.56 MiB).
- All 30 source sheets were visually checked for distinct subjects, row-major order, consistent CGI style, and tile boundaries. Seams are trimmed from each final crop; fractional grid rounding is corrected with a centered square crop.
- Existing card files were retained. Every new card resolves to its own illustration rather than a shared school fallback.

## Source sheets and crop order

The 30 approved source sheets were visually checked for subject order and regular cell boundaries. Each row-major cell is saved under its matching card ID. The original source sheets are kept outside the repository and are not duplicated in served assets.

| Atlas | Original PNG | First card | Last card |
| --- | --- | --- | --- |
| 1 | exec-363e0bb2-65a9-4dd3-bf6f-c272ac025291.png | iron-black-wax-citation | iron-nail-the-heel |
| 2 | exec-54912c37-a7c1-4912-ad1d-ad99657008aa.png | iron-read-the-accusation | iron-purchase-the-missing-page |
| 3 | exec-447457a4-e09e-4e72-a18c-51a8b7f4ac30.png | iron-no-heir-to-the-debt | iron-annul-the-immortal-patent |
| 4 | exec-e554e892-bcda-4923-9c36-b4e0ae606bc9.png | iron-rebind-the-ash-docket | ember-incense-for-the-unburied |
| 5 | exec-46c59b2d-6453-4aee-bf14-fdbd40672c8b.png | ember-scald-the-ancestral-seal | ember-bitter-ash-mudra |
| 6 | exec-8a87bb5b-149c-443f-af5e-d131bf4a1fed.png | ember-dance-inside-the-furnace | ember-seal-the-coal-jar |
| 7 | exec-bf553f6d-9cc3-4da2-ac03-4823c4952672.png | ember-buried-brazier-vigil | ember-break-the-firing-rod |
| 8 | exec-1200f85a-2882-453f-ad94-d19ea9210455.png | ember-pour-the-crucible-dry | tide-reed-mat-infirmary |
| 9 | exec-5d674320-10e1-4972-9154-a586414cc4e2.png | tide-two-bank-markers | tide-pebble-against-the-flood |
| 10 | exec-81ca92de-89c9-48b2-aaeb-f42a7f6982e1.png | tide-catch-the-undertow | tide-bury-the-anchor-upright |
| 11 | exec-633b6be8-c8d6-4379-8fc2-66bb0b383453.png | tide-send-the-return-ferry | tide-no-boat-returns-from-this-dawn |
| 12 | exec-0f80ad59-f0c6-417d-b8f6-9b75db6aa68b.png | tide-hook-the-waterline | shade-two-bells-before-dawn |
| 13 | exec-2f797f60-13d6-494a-9e94-8d4357709835.png | shade-curtain-of-borrowed-titles | shade-break-the-general-mask |
| 14 | exec-ebb94219-1714-47f4-a496-abd47a09e6d7.png | shade-rent-a-living-face | shade-restitch-the-discarded-role |
| 15 | exec-ad8549f2-0da8-4ff7-bfee-d3ebe189977f.png | shade-rub-out-the-honorific | shade-wash-away-the-stage-blood |
| 16 | exec-456930ad-e0e5-47e2-b910-14d97a18bba5.png | lotus-inkless-rebuke | lotus-brush-held-level |
| 17 | exec-c955d160-e712-402b-b333-09a83cf5f2e5.png | lotus-heel-against-the-archive-door | lotus-copy-the-ledger-onto-skin |
| 18 | exec-b964cc83-5937-4899-adc8-31b0fa1fdeba.png | lotus-offer-a-night-of-sleep | lotus-separate-the-voice-from-the-seal |
| 19 | exec-ecdc7d4e-ea97-4ee9-a59f-bc78d184c1e3.png | lotus-retrieve-the-unsent-confession | thunder-storm-tax-stamp |
| 20 | exec-117854eb-86ed-41f7-ad7b-34ce2d50b33d.png | thunder-frayed-harness-writ | thunder-read-the-spark-gap |
| 21 | exec-57752b49-2bf5-43f4-bd61-095dabd56ee9.png | thunder-courier-without-a-footfall | thunder-count-the-distant-flashes |
| 22 | exec-a5d95166-5f79-41de-bad1-cec1fd5381ef.png | thunder-send-the-empty-capsule | thunder-receipt-in-the-rain |
| 23 | exec-eac14d15-f160-4394-9586-d91e6a96e2b0.png | thunder-cut-the-returning-arc | star-observatory-chalk-ring |
| 24 | exec-a3fb58ce-6ad6-4654-a7ad-0391d1889231.png | star-broken-sundial-court | star-second-hand-correction |
| 25 | exec-c01ee24f-4266-4678-99f0-9f71492696ee.png | star-deflect-along-the-ecliptic | star-sentence-of-the-empty-throne |
| 26 | exec-cc54ddde-6bfa-4c35-942b-850cf0b64b5d.png | star-return-of-the-lost-minute | star-yu-shuang-closes-the-sky |
| 27 | exec-2e6f6697-1fbb-4aca-bc59-76f1db26319b.png | star-surveyor-needle-thrust | neutral-soup-pot-at-the-crossroads |
| 28 | exec-6f0bbe7c-f271-4071-8970-b25581c93954.png | neutral-thorn-hedge-switchback | neutral-turn-the-coffin-on-its-side |
| 29 | exec-0f17b5fa-1dc2-498a-a9ba-3d623a3b61ca.png | neutral-prick-the-shared-thumb | neutral-knock-the-gilt-from-the-buckle |
| 30 | exec-34947836-fe6d-4542-8472-3162610bbc61.png | neutral-rub-out-the-borrowed-seal | neutral-honey-on-the-cracked-lip |

