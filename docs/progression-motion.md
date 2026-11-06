# Cultivation transition direction

Cultivation effects are disposable presentation derived from two copied snapshots. They never grant experience, change a realm, consume resources, or enter a save. Loading a chronicle initializes the controller's baseline; it does not replay old gains.

`captureProgression(game)` returns `{hero,pets}`. Each subject contains its actual realm, inner layer, global level, lifetime essence, progress fraction, perfection, name, portrait and color. `progressionChanges(before,after)` emits copied records for layer gains, realm gains and final perfection. New hatch ownership is quiet here because the pet hatching cinematic handles it. Several skipped layers become one explicit `Layer I → VI · +5 layers` notification.

`playProgressionEffects({before,after,root,action,skipPetRealm,onComplete})` returns `{duration,finished,cancel}`. Ordinary layer advancement displays a portrait seal, qi ribbon, rising level number and an illuminated progress track, plus a ring around a visible character/pet portrait. It lasts 1.8 seconds, allows gameplay to continue, and batches simultaneous subjects in one stack. Final perfection has its own gold treatment. A new nonempty advancement replaces the prior presentation; unrelated successful trades do not clear an existing gain.

Character breakthroughs use a 2.8-second celestial ceremony with the previous portrait dissolving into the new armor, five unfolding orbit rings, twenty qi stars, the old and new realm names, level/layer change and precise intrinsic maximum-vitality increase. Continue or Escape finishes early. The ceremony saves and restores the prior app `inert` state and focus, traps its own Tab key, and cancels cleanly on navigation. Reduced motion uses static readable transitions and shorter display periods.

The controller should pass `skipPetRealm:true` for `pet-evolve` while continuing to use `showPetCelebration` for the existing pet evolution cinematic. Pet feeding still invokes these ordinary layer effects, including multi-layer gains. `clearProgressionEffects()` cancels timers, WAAPI animations, fixed overlays, inert state and focus handling. DOM access occurs only when playing effects, so the snapshot and delta helpers are importable in Node tests.

Load `css/progression-fx.css` after existing game styles. Layer selectors are `#progression-layer-fx [data-progression-kind][data-progression-subject]`; the realm ceremony is `#progression-realm`. Neither effect clones interactive game controls or intercepts small-gain gameplay.
