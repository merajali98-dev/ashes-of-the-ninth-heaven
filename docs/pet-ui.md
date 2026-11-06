# Spirit sanctuary interface

The sanctuary is one illustrated, zoomed-out world. Eight persistent biome nodes show an egg until that species is hatched, then its living creature. Dragon Peak, the Cinder Caldera, Whitepine Ridge, the Blackwater Basin, Moonblossom Grove, Jade Meadows, the Cloud Sea, and Thunderfall Cliffs occupy different locations. The world is browsable without owning a pet; selecting a biome explains its species, hatch cost, temperament, abilities, and cultivation.

Desktop uses a broad map with a selected-species panel alongside it. Mobile keeps the overview within the viewport and places the detail panel below. Zoom controls enlarge the map inside a pannable viewport, never the page. A list view offers an equivalent keyboard and screen-reader route to all eight species. Names, ownership, selected companion, and egg/creature state are always explicit.

Feeding starts from a picker of owned techniques with safe surplus counts. Each entry shows the card's artwork, rarity, family level, reserved count, and nourishment per copy. The quote names the exact card and quantity, the copies destroyed, cultivation gained, current versus resulting progress, and the fact that shared card quality remains learned. Confirmation revalidates the transaction in the rules layer. An active encounter blocks hatch, feed, evolution, and companion switching.

Each creature follows the same ten realms and nine layers as the hero. A progress bar shows the current layer; a realm threshold has a clear manual evolution action and the hero's cultivation cap is explained beside it. Hatching and evolution use a dedicated cinematic layer: dimmed world, rotating seal rings, cracked egg or spirit cocoon, rising particles, a timed light burst, creature reveal, and a readable completion plaque. The final state is saved before the celebration begins. Reduced-motion mode replaces travel, flashing, and spinning with a restrained reveal and the same result text.

The combat companion panel stays on the player's side without becoming another target or combatant. It shows the selected species portrait, realm, passive summary, and active ability buttons. Each active ability presents its actual effect, turn cooldown, unlock condition, and availability reason. The owner-turn countdown is visible on each cooldown badge. A pet action never consumes or changes the selected card target.

## UI controller contract

The renderer exposes `petHabitat(game, ui)`, `petDetails(game, id)`, `petFeedPicker(game, id, ui)`, `petFeedPreview(game, id, cardId, quantity)`, `petHatchPreview(game, id)`, `petEvolutionPreview(game, id)`, and `battlePetPanel(combat)`. `showPetCelebration(...)` owns the temporary hatch/evolution presentation only; the controller performs and saves the transaction first.

Actions are `pet-select`, `pet-view` (map/list), `pet-map-zoom`, `pet-hatch-preview`, `pet-hatch`, `pet-feed-picker`, `pet-feed-preview`, `pet-feed-confirm`, `pet-evolve-preview`, `pet-evolve`, `pet-equip`, `pet-unequip`, and `pet-ability`. Feeding forms submit stable pet/card identifiers and an integer quantity; quote calculations remain in the model. The controller preserves the selected species after mutations and restores focus after dialogs close.

## Visual verification

Verify the egg and creature states of all eight nodes, selected versus travelling companion, material and progression blockers, no safe-feed copies, exact feed quote, all ability cooldown states, hatch/evolution cleanup, saved selection, and 390-pixel layout. The map, controls, dialog actions, and bottom dock must remain reachable without horizontal page overflow.

Pre-art layout smoke checks passed in Edge: eight map nodes, eight ledger entries, no JavaScript errors, and 390-pixel page width. The pet battle layout was checked at 1440×1000 and 390×844. A pet-specific compact arena keeps the entire hand in view: desktop hand bottom 978.625 pixels; mobile hand bottom 843 pixels. Thirty-two individually drawn SVG command seals replace generic attack/spell glyphs, with matching sigils in the habitat ability catalogue. Realm halos grow between the three major creature forms. Cinematic presentation makes the background app inert, traps focus on its Skip/Continue button, handles Escape, restores interaction on cleanup, and honors reduced motion. Final illustrated habitat and combat screenshots must be reviewed after art staging completes.

After rendering the habitat, the controller calls `bindPetMapControls(root)` to enable mouse-drag panning on empty map space when zoomed. Native touch scrolling and keyboard scrolling remain available. The controller calls `clearPetCelebration()` during navigation and saves hatch/evolution state before `showPetCelebration(...)`.
