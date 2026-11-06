# Spirit sanctuary and battle companions

The sanctuary adds eight original companions inspired by mythological creatures. Players deliberately choose which egg to hatch; there are no random species rolls, paid rerolls, or real-time incubation waits. Every unhatched species remains visible as an egg in its own biome on one zoomed-out habitat map. Hatched creatures occupy those same places. Choosing a creature opens its growth, feeding, evolution, and battle-skill details.

## Eight lineages

| Companion | Lineage | Habitat | Battle identity |
| --- | --- | --- | --- |
| Azure Dragon | Astral Seal | Cloudpeak Mountains | Celestial damage, Ward, blessing removal, and exposed openings. |
| Vermilion Phoenix | Cinder Art | Cinder Caldera | Burn, restorative flame, and protective wings. |
| White Tiger | Iron Oath | Frostpine Ravine | Direct strikes, Guard, Weak, and Bleed. |
| Black Tortoise | Grave Tide | Stillwater Island | Sustained defense, Ward, cleansing, and regeneration. |
| Nine-Tail Fox | Hollow Veil | Moonveil Grove | Weak, Vulnerable, blessing removal, and spectral attacks. |
| Jade Qilin | Jade Sutra | Verdant Spring | Healing, cleansing, patient protection, and merciful judgment. |
| Kun Peng | Common Form | Skyreef Expanse | Balanced shelter, healing, cleansing, and broad attacks. |
| Thunder Serpent | Storm Script | Stormglass Marsh | Precise damage, Bleed, exposed openings, and returning thunder. |

Their identities are rooted in mythology rather than adaptations of named characters from a franchise. Each has four active abilities and three passive arts: **32 active abilities and 24 passives** in the complete registry.

## Deliberate hatching

The first hatch is free and can be any of the eight species. Every later hatch costs 250 jade, 12 Mortal Seal Jade, and eight tier-one essences of that creature's lineage. All species remain available from the beginning, so choosing a favorite does not require a lucky drop or a different earlier choice. Hatching never changes the selected battle companion automatically.

Hatching quotes list the exact cost, missing materials, and result before the confirmation. A successful hatch creates `{realm:0, essence:0}` for that species. Repeating the transaction fails without spending anything. Hatching is unavailable during an encounter or before swearing the oath.

## Cards become nourishment

Feeding destroys the explicitly selected number of card copies from the existing `known` inventory. It does not create a second ownership system. The quote lists owned copies, protected copies, safe surplus, selected quantity, and resulting pet essence. Quantities must be whole integers from one to 99.

| Card rarity | Cultivation essence per copy |
| --- | ---: |
| Common | 8 |
| Uncommon | 20 |
| Rare | 55 |
| Legendary | 140 |

Protection uses `reservedCopies`: the maximum number used by the active deck, any saved deck, or the editing draft. It is not the sum, since decks reuse the same inventory. The operation never automatically removes a card from a deck. A stale quote is recomputed when feeding commits, preventing a changed draft or inventory from invalidating a deck.

Card-family quality remains learned after feeding, just as it remains after salvage. Upgrading one family applies to every copy, so quality does not multiply feeding experience; doing so would allow a single shared refinement investment to multiply nourishment across unlimited reacquired copies. Feeding preserves the `cardLevels` and derived `upgrades` records. The UI should state this before consumption.

Pet essence is lifetime experience, capped at 6,470. A near-cap feed quote explicitly reports `gained` and `wasted` experience. It cannot destroy cards once the pet would gain zero experience. There is no hunger penalty, death timer, or loss of earned pet cultivation while away.

## The same ten realms and ninety layers

Pets use the hero's exact realm thresholds and nine derived layers: Qi Condensation, Foundation Establishment, Core Formation, Nascent Soul, Soul Transformation, Void Refinement, Body Integration, Mahayana, Tribulation Transcendence, and True Immortal. Feeding raises layers, but never silently crosses a main realm.

Evolution is a guaranteed manual breakthrough. It requires the next realm's lifetime essence threshold, the hero having reached that main realm, and half of the corresponding hero breakthrough jade cost, rounded up. Evolution spends jade and preserves all pet essence. Experience can be banked while waiting for the hero; there is no need to feed it a second time after the gate opens. True Immortal layer nine perfects at 6,470 essence.

Creature artwork has four states: unhatched egg, young (realms zero through two), adult (three through five), and ascended (six through nine). Each manual evolution is still presented as a full animated breakthrough, with current realm and layer made explicit. Realm-dependent aura and presentation can distinguish intermediate breakthroughs without claiming a separate illustration for each of the ninety levels.

## One companion in battle

Players may own all eight companions and deliberately equip exactly one, or choose to bring none. Encounter entry copies the selected companion into the battle snapshot. Subsequent sanctuary changes cannot alter that snapshot, and encounters predating the pet system remain unchanged with no pet attached. The companion stands beside the player, with no independent health pool, enemy targeting slot, extra lane, or minion board.

All four active skills appear with their unlock requirements. They unlock at pet realms zero, one, three, and six. Their individual cooldowns are two, three, four, and five owner turns. One active companion ability may be invoked in a player turn, regardless of which abilities are individually ready. Abilities cost no Qi; the once-per-turn limit and individual cooldowns are the action budget. A skill used on turn one with cooldown two becomes ready on turn three. Cooldowns and the last invocation turn are saved.

Passive arts unlock at realms zero, two, and five. Their triggers are opening, player turn-start, and player turn-end respectively. Each fires once at its scheduled point. They do not respond recursively to card plays, pet effects, rituals, stances, or Resonance. Effects use the canonical combat resolver so damage, healing, Guard, status prevention, cleansing, and phase seals behave consistently with cards.

The first passive is modest: one Ward, one Strength, a few Guard, one Weak, or a small heal. Repeated passives offer bounded defense, healing, or a small debuff; none generates Qi, card draw, recovery, permanent stacking Strength, or extra actions. Active effects scale by integer fractions of main realm, with no continuous stat explosion across all ninety layers. At realm nine, the largest single base effect is 20 damage; the returning-thunder attack has two nine-damage hits before ordinary combat modifiers. Timing and enemy phase seals still govern the actual outcome.

## State and APIs

`js/pets.js` imports content, cultivation, and deck reservations. It has no browser dependency and no import from progression or combat. Progression reexports these APIs and owns encounter integration.

```js
petVersion: 1
pets: { [speciesId]: {realm: 0, essence: 0} }
activePetId: null // or one owned speciesId
```

Exports include `spiritPets`, `petById`, `PET_MAP_ART`, `initializePets`, `validPets`, `petArt`, `petStatus`, `feedExperience`, `previewPet`, `snapshotPet`, `validPetSnapshot`, `quoteHatch`/`hatchPet`, `quoteFeed`/`feedPet`, `quoteEvolve`/`evolvePet`, and `equipPet`.

Quotes return `{ok, reason, jade, materials, result}` plus operation-specific information. Mutations recompute quotes and reject before spending or consuming inventory. A feed result reports `{petId, cardId, quantity, experience, essence, gained, wasted}`. A battle snapshot includes all four resolved active definitions with unlock flags, all three resolved passives, current realm/essence/level/art, and independent battle-owned `readyAt` and `lastAbilityTurn` fields.

Old saves missing all pet fields initialize an empty sanctuary and no active companion. Markerless partial pet fields throw instead of being silently overwritten. Current pet records validate species, main realm, hero realm cap, lifetime essence bounds, and selected ownership. Battle snapshot validation compares canonical resolved definitions, checks known unlocked cooldown IDs, bounds readiness by current turn plus cooldown, and rejects future last-action turns.

The map asset is `assets/art/pet-map.webp`. Each species uses `assets/art/pet-<id>-egg.webp`, `-young.webp`, `-adult.webp`, and `-ascended.webp`. The registry positions agree with the habitat UI: dragon northwest mountain, phoenix northeast caldera, tiger western ravine, fox central grove, qilin upper-central spring, Kun Peng eastern skyreef, tortoise southeast island, and serpent southern marsh.

## Core verification

`node --test tests/pets.test.js` passes twelve focused tests. They cover all eight full ability kits, distinct habitat and art identities, free deliberate selection of every first hatch, exact additional hatch costs, atomic rejections, protected-copy feeding, preservation of shared quality, capped and zero-value feeding, all ten realms for every species, deliberate one-pet selection, independent battle snapshots, canonical cooldown validation, and visual growth thresholds. Root's combat and browser tests cover timing, phase seals, animation, map interaction, and actual battle use after integration.
