# Cultivation and material art

The expansion adds nine breakthrough avatars and 45 raw-material icons, generated using built-in ImageGen. The original realm-zero Shen Luo portrait remains unchanged. Final images are local WebP assets under `assets/art/`; no external URL or shared placeholder is required.

## Breakthrough identity and progression

The existing `assets/art/portrait-shen-luo.webp` was inspected and passed as the identity reference. All nine new portraits retain Shen Luo's face, brown eyes, eyebrow scar, black high ponytail, and crimson scarf. Armor structure, shoulder silhouettes, crowns, and halo geometry become more elaborate at each breakthrough. The framing keeps the face central for circular hero-avatar presentation.

| Realm | Visual evolution | Asset |
| --- | --- | --- |
| Foundation Establishment | Simple silver plates, jade clasp, faint jade ring | `cultivation-foundation-establishment.webp` |
| Core Formation | Layered pauldrons, luminous jade core, double halo | `cultivation-core-formation.webp` |
| Nascent Soul | Carved jade guards, soul echo, raised collar | `cultivation-nascent-soul.webp` |
| Soul Transformation | Dragon-scale armor, gold brow ornament, meridian light | `cultivation-soul-transformation.webp` |
| Void Refinement | Floating segmented plates, starfield mantle, fractured orbits | `cultivation-void-refinement.webp` |
| Body Integration | Articulated celestial plate and wing-shaped shoulders | `cultivation-body-integration.webp` |
| Mahayana | Gold-and-jade ceremonial mantle, inner-heaven pavilions | `cultivation-mahayana.webp` |
| Tribulation Transcendence | Storm-forged silver, crystalline jade spikes, lightning halo | `cultivation-tribulation-transcendence.webp` |
| True Immortal | Ornate ivory-silver and gold armor, imperial jade, ninefold aureole | `cultivation-true-immortal.webp` |

## Material identities

Nine material families have five distinct potency tiers each: Mortal, Spirit, Earth, Heaven, and Immortal. Complexity grows from a rough fragment through crystal clusters to floating cores and satellite crystals. Each family keeps its color and recognizable mineral silhouette. Icons have a dark background, clear contrast, and no UI labels.

| Family | Visual identity | ID pattern |
| --- | --- | --- |
| Seal Jade | Celadon lozenge with gold mineral veins | `seal-jade-1` through `seal-jade-5` |
| Oathsteel Essence | Silver hematite wedge with red seams | `essence-iron-1` through `essence-iron-5` |
| Cinder Essence | Orange volcanic flame geode | `essence-ember-1` through `essence-ember-5` |
| Frosttide Essence | Cyan sea crystal with salt-white ridges | `essence-tide-1` through `essence-tide-5` |
| Umbral Essence | Smoky violet crescent crystal | `essence-shade-1` through `essence-shade-5` |
| Verdant Essence | Jade lotus-petal crystal growth | `essence-lotus-1` through `essence-lotus-5` |
| Storm Essence | Cobalt crystal with lightning fractures | `essence-thunder-1` through `essence-thunder-5` |
| Astral Essence | Gold meteorite with star-filled indigo core | `essence-star-1` through `essence-star-5` |
| Mortal Essence | Amber quartz growing from warm earthen stone | `essence-neutral-1` through `essence-neutral-5` |

Every material resolves to `assets/art/material-<id>.webp`, matching `materials[].art` and `materials[].icon` in `js/economy.js`.

## Production and verification

- Four original atlas assets were generated: one 3 × 3 portrait progression sheet, and three 4 × 4 material sheets with fifteen used cells and one empty cell each.
- All four sheets were visually inspected for subject order, identity continuity, clear progression, and regular crop boundaries.
- All 54 final WebP files decode successfully. File SHA-256 hashes and decoded-pixel SHA-256 hashes are distinct for all 54 assets.
- All nine portraits are 414 × 414 pixels. Material icons comprise 36 at 309 × 309 and nine at 310 × 310. Crops remove the atlas seams and correct fractional grid rounding to exact squares.
- All realm and material registry paths exist. Total size is 1,530,426 bytes (1.46 MiB).
- The original portrait and existing item/card assets were retained. No material icon reuses an old item image.

Original sheets remain in the tool's generated-images directory. Reproducible staging and verification records are in `tmp/cultivation-art/`.

| Source | Original PNG | Cell order |
| --- | --- | --- |
| Portrait progression | `exec-36af6849-30e5-4515-a001-9b95a726eda7.png` | Realms 1–9, row-major |
| Material atlas 1 | `exec-275d7532-c04a-4b26-a594-5d3c10c96908.png` | seal-jade-1 through essence-ember-5, row-major; last cell unused |
| Material atlas 2 | `exec-904c207e-f5a6-460c-b273-eea51832ee48.png` | essence-tide-1 through essence-lotus-5, row-major; last cell unused |
| Material atlas 3 | `exec-82b22be9-730f-483d-9d58-d187ea014d5f.png` | essence-thunder-1 through essence-neutral-5, row-major; last cell unused |

## Final source prompts

### Breakthrough portrait atlas

```text
Use case: identity-preserve. Deliver ONE square 3-by-3 character progression atlas, EXACTLY nine equal square portrait cells, perfectly regular grid, edge to edge, no gutters, no text, no labels, no numerals, no watermark. Input image1 is the SAME hero Shen Luo identity reference, not a scene to copy. Preserve his exact recognizable face, East Asian features, strong straight brows, brown eyes, subtle thin scar crossing left eyebrow, long black hair in high ponytail, confident stern young adult expression and crimson scarf in ALL9cells. Every cell is a centered head-and-shoulders bust, face in same position and scale, enough negative space around head for circular avatar cropping; show shoulder armor within lower third. Keep same facial identity and age throughout, no beard, no different characters. Premium realistic contemporary Chinese3D CGI donghua, physically based engraved metals/jade, individual hair, woven silk, midnight indigo backdrop, dramatic readable lighting. Each breakthrough meaningfully improves armor structure, crown, mantle and halo geometry, not only colors. All costumes original dark cultivation fantasy. Grid strict row-major:
1 top-left Foundation Establishment: charcoal armored robes, simple newly forged silver shoulder plates with narrow gold trim, small jade clasp, crimson scarf, one thin faint jade ring behind head; grounded restrained warrior.
2 top-center Core Formation: layered dark breastplate with luminous jade core inset at sternum, heavier silver pauldrons with gold ridges, two concentric faint golden rings, evolved jade hairpin.
3 top-right Nascent Soul: exquisite carved jade shoulder guards mounted in silver, raised gorget, translucent jade soul silhouette of same face subtly behind, three clean thin halo rings, modest crown.
4 middle-left Soul Transformation: articulated silver-and-jade dragon-scale armor, flowing dark silk mantle, angular gold brow ornament, luminous meridian traces along armor only, four separated halo rings.
5 middle-center Void Refinement: midnight obsidian armor with floating silver segmented pauldrons, subtle violet starfield in the black mantle, long jade crown prongs, five fragmented orbital rings with dark celestial void between them.
6 middle-right Body Integration: fully integrated silver celestial plate with jade inlays and articulated wing-shaped shoulder edges, fitted gold collar, powerful sculpted crown, six luminous geometrical halo rings, embodied composed authority.
7 bottom-left Mahayana: majestic ornate gold-and-jade layered armor over midnight silk, broad ceremonial shoulder mantle, a miniature inner heavenly pavilion subtly in seven interlocking halo rings, elegant tall imperial hair crown.
8 bottom-center Tribulation Transcendence: storm-forged white-silver armor with intricate black-gold seams, jagged lightning-shaped jade pauldrons, crystalline crown, eight bold orbital rings with electric-blue lightning contained behind head, red scarf remains visible.
9 bottom-right True Immortal: ultimate pristine ivory silver and antique gold celestial armor, richly faceted imperial jade chest and collar, ornate layered lotus-wing shoulder mantle, highest refined gold/jade crown, precisely nine nested halo rings behind head forming spectacular immortal aureole, radiant gold/jade motes. Face remains SAME human Shen Luo, clear natural skin and brown eyes, no helmet or face covering. Lastportraitstrongerandvisuallymoreelaboratethanallprevious. NO duplicate cells or pasted repeated artwork.
```

### Material atlas 1

```text
Use case: stylized-concept. Create ONE square 4x4 game RAW MATERIAL ICON ATLAS. Exactly16 equally sized squarecells in strictrowmajororder. Cells1–15 each a DIFFERENT standalone 3D rawmaterial illustration; cell16 pure dark indigo empty. No margins or gutters, no frames, no labels, no text, no numerals, no watermark. Each material alone centered occupying75%tile, fully contained in square, strong clean silhouette readable at40px, generousnegativebackground, no human hands, no characters, no scenery, no pedestal. Premium physically based realistic3DCGI xianxia donghua, crystalline mineral inclusions, richspecularfacets, oblique coolblue+warmgold cinematic lighting, softshadow on midnightindigobackground. Eachfamilyretainsits distinctive silhouette/color across5tiers. Tiergrowthmustbevisiblethroughaddedmass,crystalstructure,facets,orbitals—notmererecolor. Raw magical gemstones and crystallized essences, NOT jewelry, weapons, UI badges or outlinedvectoricons. Highest square resolution target2048. Render independently: 
Row1 column1: Mortal Seal Jade. Familyappearance: seal-jade: pale luminous celadon translucent lozenge of raw jade with naturally square core and mineral inclusions, weathered gold veins; no readable carvings. Mortal tier1: one small rough simple fragment, minimal faint glow, very few facets, clearly primitive.
Row1 column2: Spirit Seal Jade. Familyappearance: seal-jade: pale luminous celadon translucent lozenge of raw jade with naturally square core and mineral inclusions, weathered gold veins; no readable carvings. Spirit tier2: two or three joined polished crystalline points on original raw base, brighter innercore, slightly larger sophisticated shape.
Row1 column3: Earth Seal Jade. Familyappearance: seal-jade: pale luminous celadon translucent lozenge of raw jade with naturally square core and mineral inclusions, weathered gold veins; no readable carvings. Earth tier3: substantial complex branching crystalcluster with intricate metallic mineral veins and deeply luminous central gemstone, robust multilayer structure.
Row1 column4: Heaven Seal Jade. Familyappearance: seal-jade: pale luminous celadon translucent lozenge of raw jade with naturally square core and mineral inclusions, weathered gold veins; no readable carvings. Heaven tier4: rare luminous levitating crystal heart with separated smaller orbital shards and one subtle energy ring, intricate facets, visiblymorecomplexthantier3.
Row2 column1: Immortal Seal Jade. Familyappearance: seal-jade: pale luminous celadon translucent lozenge of raw jade with naturally square core and mineral inclusions, weathered gold veins; no readable carvings. Immortal tier5: magnificent large intricate sacred crystalline lattice, several levitating satellite gems, fine metallic natural filigree veins, two luminous halo arcs and dazzling bright core, unmistakablythehighestgrade.
Row2 column2: Mortal Oathsteel Essence. Familyappearance: Oathsteel Essence: jagged dense silver hematite raw crystal, a shield-like wedge silhouette, charcoal basalt root, faint red seams. Mortal tier1: one small rough simple fragment, minimal faint glow, very few facets, clearly primitive.
Row2 column3: Spirit Oathsteel Essence. Familyappearance: Oathsteel Essence: jagged dense silver hematite raw crystal, a shield-like wedge silhouette, charcoal basalt root, faint red seams. Spirit tier2: two or three joined polished crystalline points on original raw base, brighter innercore, slightly larger sophisticated shape.
Row2 column4: Earth Oathsteel Essence. Familyappearance: Oathsteel Essence: jagged dense silver hematite raw crystal, a shield-like wedge silhouette, charcoal basalt root, faint red seams. Earth tier3: substantial complex branching crystalcluster with intricate metallic mineral veins and deeply luminous central gemstone, robust multilayer structure.
Row3 column1: Heaven Oathsteel Essence. Familyappearance: Oathsteel Essence: jagged dense silver hematite raw crystal, a shield-like wedge silhouette, charcoal basalt root, faint red seams. Heaven tier4: rare luminous levitating crystal heart with separated smaller orbital shards and one subtle energy ring, intricate facets, visiblymorecomplexthantier3.
Row3 column2: Immortal Oathsteel Essence. Familyappearance: Oathsteel Essence: jagged dense silver hematite raw crystal, a shield-like wedge silhouette, charcoal basalt root, faint red seams. Immortal tier5: magnificent large intricate sacred crystalline lattice, several levitating satellite gems, fine metallic natural filigree veins, two luminous halo arcs and dazzling bright core, unmistakablythehighestgrade.
Row3 column3: Mortal Cinder Essence. Familyappearance: Cinder Essence: angular orange ember geode, a flame-shaped natural rawcrystal, dark volcanic crust and brass mineral inclusions. Mortal tier1: one small rough simple fragment, minimal faint glow, very few facets, clearly primitive.
Row3 column4: Spirit Cinder Essence. Familyappearance: Cinder Essence: angular orange ember geode, a flame-shaped natural rawcrystal, dark volcanic crust and brass mineral inclusions. Spirit tier2: two or three joined polished crystalline points on original raw base, brighter innercore, slightly larger sophisticated shape.
Row4 column1: Earth Cinder Essence. Familyappearance: Cinder Essence: angular orange ember geode, a flame-shaped natural rawcrystal, dark volcanic crust and brass mineral inclusions. Earth tier3: substantial complex branching crystalcluster with intricate metallic mineral veins and deeply luminous central gemstone, robust multilayer structure.
Row4 column2: Heaven Cinder Essence. Familyappearance: Cinder Essence: angular orange ember geode, a flame-shaped natural rawcrystal, dark volcanic crust and brass mineral inclusions. Heaven tier4: rare luminous levitating crystal heart with separated smaller orbital shards and one subtle energy ring, intricate facets, visiblymorecomplexthantier3.
Row4 column3: Immortal Cinder Essence. Familyappearance: Cinder Essence: angular orange ember geode, a flame-shaped natural rawcrystal, dark volcanic crust and brass mineral inclusions. Immortal tier5: magnificent large intricate sacred crystalline lattice, several levitating satellite gems, fine metallic natural filigree veins, two luminous halo arcs and dazzling bright core, unmistakablythehighestgrade.
Row4 column4: plain midnightindigo empty unused cell.
```

### Material atlas 2

```text
Use case: stylized-concept. Create ONE square 4x4 game RAW MATERIAL ICON ATLAS. Exactly16 equally sized squarecells in strictrowmajororder. Cells1–15 each a DIFFERENT standalone 3D rawmaterial illustration; cell16 pure dark indigo empty. No margins or gutters, no frames, no labels, no text, no numerals, no watermark. Each material alone centered occupying75%tile, fully contained in square, strong clean silhouette readable at40px, generousnegativebackground, no human hands, no characters, no scenery, no pedestal. Premium physically based realistic3DCGI xianxia donghua, crystalline mineral inclusions, richspecularfacets, oblique coolblue+warmgold cinematic lighting, softshadow on midnightindigobackground. Eachfamilyretainsits distinctive silhouette/color across5tiers. Tiergrowthmustbevisiblethroughaddedmass,crystalstructure,facets,orbitals—notmererecolor. Raw magical gemstones and crystallized essences, NOT jewelry, weapons, UI badges or outlinedvectoricons. Highest square resolution target2048. Render independently: 
Row1 column1: Mortal Frosttide Essence. Familyappearance: Frosttide Essence: cyan ice-blue teardrop sea crystal, translucent salt-white ridges and waterdroplets. Mortal tier1: one small rough simple fragment, minimal faint glow, very few facets, clearly primitive.
Row1 column2: Spirit Frosttide Essence. Familyappearance: Frosttide Essence: cyan ice-blue teardrop sea crystal, translucent salt-white ridges and waterdroplets. Spirit tier2: two or three joined polished crystalline points on original raw base, brighter innercore, slightly larger sophisticated shape.
Row1 column3: Earth Frosttide Essence. Familyappearance: Frosttide Essence: cyan ice-blue teardrop sea crystal, translucent salt-white ridges and waterdroplets. Earth tier3: substantial complex branching crystalcluster with intricate metallic mineral veins and deeply luminous central gemstone, robust multilayer structure.
Row1 column4: Heaven Frosttide Essence. Familyappearance: Frosttide Essence: cyan ice-blue teardrop sea crystal, translucent salt-white ridges and waterdroplets. Heaven tier4: rare luminous levitating crystal heart with separated smaller orbital shards and one subtle energy ring, intricate facets, visiblymorecomplexthantier3.
Row2 column1: Immortal Frosttide Essence. Familyappearance: Frosttide Essence: cyan ice-blue teardrop sea crystal, translucent salt-white ridges and waterdroplets. Immortal tier5: magnificent large intricate sacred crystalline lattice, several levitating satellite gems, fine metallic natural filigree veins, two luminous halo arcs and dazzling bright core, unmistakablythehighestgrade.
Row2 column2: Mortal Umbral Essence. Familyappearance: Umbral Essence: dark amethyst crescent-shaped rawcrystal with violet smoky core and fine ivory mineral ribs. Mortal tier1: one small rough simple fragment, minimal faint glow, very few facets, clearly primitive.
Row2 column3: Spirit Umbral Essence. Familyappearance: Umbral Essence: dark amethyst crescent-shaped rawcrystal with violet smoky core and fine ivory mineral ribs. Spirit tier2: two or three joined polished crystalline points on original raw base, brighter innercore, slightly larger sophisticated shape.
Row2 column4: Earth Umbral Essence. Familyappearance: Umbral Essence: dark amethyst crescent-shaped rawcrystal with violet smoky core and fine ivory mineral ribs. Earth tier3: substantial complex branching crystalcluster with intricate metallic mineral veins and deeply luminous central gemstone, robust multilayer structure.
Row3 column1: Heaven Umbral Essence. Familyappearance: Umbral Essence: dark amethyst crescent-shaped rawcrystal with violet smoky core and fine ivory mineral ribs. Heaven tier4: rare luminous levitating crystal heart with separated smaller orbital shards and one subtle energy ring, intricate facets, visiblymorecomplexthantier3.
Row3 column2: Immortal Umbral Essence. Familyappearance: Umbral Essence: dark amethyst crescent-shaped rawcrystal with violet smoky core and fine ivory mineral ribs. Immortal tier5: magnificent large intricate sacred crystalline lattice, several levitating satellite gems, fine metallic natural filigree veins, two luminous halo arcs and dazzling bright core, unmistakablythehighestgrade.
Row3 column3: Mortal Verdant Essence. Familyappearance: Verdant Essence: natural jade-green petal-shaped crystalcluster, lotus-like mineral growth, pale gold veins. Mortal tier1: one small rough simple fragment, minimal faint glow, very few facets, clearly primitive.
Row3 column4: Spirit Verdant Essence. Familyappearance: Verdant Essence: natural jade-green petal-shaped crystalcluster, lotus-like mineral growth, pale gold veins. Spirit tier2: two or three joined polished crystalline points on original raw base, brighter innercore, slightly larger sophisticated shape.
Row4 column1: Earth Verdant Essence. Familyappearance: Verdant Essence: natural jade-green petal-shaped crystalcluster, lotus-like mineral growth, pale gold veins. Earth tier3: substantial complex branching crystalcluster with intricate metallic mineral veins and deeply luminous central gemstone, robust multilayer structure.
Row4 column2: Heaven Verdant Essence. Familyappearance: Verdant Essence: natural jade-green petal-shaped crystalcluster, lotus-like mineral growth, pale gold veins. Heaven tier4: rare luminous levitating crystal heart with separated smaller orbital shards and one subtle energy ring, intricate facets, visiblymorecomplexthantier3.
Row4 column3: Immortal Verdant Essence. Familyappearance: Verdant Essence: natural jade-green petal-shaped crystalcluster, lotus-like mineral growth, pale gold veins. Immortal tier5: magnificent large intricate sacred crystalline lattice, several levitating satellite gems, fine metallic natural filigree veins, two luminous halo arcs and dazzling bright core, unmistakablythehighestgrade.
Row4 column4: plain midnightindigo empty unused cell.
```

### Material atlas 3

```text
Use case: stylized-concept. Create ONE square 4x4 game RAW MATERIAL ICON ATLAS. Exactly16 equally sized squarecells in strictrowmajororder. Cells1–15 each a DIFFERENT standalone 3D rawmaterial illustration; cell16 pure dark indigo empty. No margins or gutters, no frames, no labels, no text, no numerals, no watermark. Each material alone centered occupying75%tile, fully contained in square, strong clean silhouette readable at40px, generousnegativebackground, no human hands, no characters, no scenery, no pedestal. Premium physically based realistic3DCGI xianxia donghua, crystalline mineral inclusions, richspecularfacets, oblique coolblue+warmgold cinematic lighting, softshadow on midnightindigobackground. Eachfamilyretainsits distinctive silhouette/color across5tiers. Tiergrowthmustbevisiblethroughaddedmass,crystalstructure,facets,orbitals—notmererecolor. Raw magical gemstones and crystallized essences, NOT jewelry, weapons, UI badges or outlinedvectoricons. Highest square resolution target2048. Render independently: 
Row1 column1: Mortal Storm Essence. Familyappearance: Storm Essence: cobalt blue zigzag rawcrystal, forked lightning-shaped fractures, silver inclusions. Mortal tier1: one small rough simple fragment, minimal faint glow, very few facets, clearly primitive.
Row1 column2: Spirit Storm Essence. Familyappearance: Storm Essence: cobalt blue zigzag rawcrystal, forked lightning-shaped fractures, silver inclusions. Spirit tier2: two or three joined polished crystalline points on original raw base, brighter innercore, slightly larger sophisticated shape.
Row1 column3: Earth Storm Essence. Familyappearance: Storm Essence: cobalt blue zigzag rawcrystal, forked lightning-shaped fractures, silver inclusions. Earth tier3: substantial complex branching crystalcluster with intricate metallic mineral veins and deeply luminous central gemstone, robust multilayer structure.
Row1 column4: Heaven Storm Essence. Familyappearance: Storm Essence: cobalt blue zigzag rawcrystal, forked lightning-shaped fractures, silver inclusions. Heaven tier4: rare luminous levitating crystal heart with separated smaller orbital shards and one subtle energy ring, intricate facets, visiblymorecomplexthantier3.
Row2 column1: Immortal Storm Essence. Familyappearance: Storm Essence: cobalt blue zigzag rawcrystal, forked lightning-shaped fractures, silver inclusions. Immortal tier5: magnificent large intricate sacred crystalline lattice, several levitating satellite gems, fine metallic natural filigree veins, two luminous halo arcs and dazzling bright core, unmistakablythehighestgrade.
Row2 column2: Mortal Astral Essence. Familyappearance: Astral Essence: antique-gold star-shaped meteorite geode, indigo cosmic mineral core, bright stellar pinpoints. Mortal tier1: one small rough simple fragment, minimal faint glow, very few facets, clearly primitive.
Row2 column3: Spirit Astral Essence. Familyappearance: Astral Essence: antique-gold star-shaped meteorite geode, indigo cosmic mineral core, bright stellar pinpoints. Spirit tier2: two or three joined polished crystalline points on original raw base, brighter innercore, slightly larger sophisticated shape.
Row2 column4: Earth Astral Essence. Familyappearance: Astral Essence: antique-gold star-shaped meteorite geode, indigo cosmic mineral core, bright stellar pinpoints. Earth tier3: substantial complex branching crystalcluster with intricate metallic mineral veins and deeply luminous central gemstone, robust multilayer structure.
Row3 column1: Heaven Astral Essence. Familyappearance: Astral Essence: antique-gold star-shaped meteorite geode, indigo cosmic mineral core, bright stellar pinpoints. Heaven tier4: rare luminous levitating crystal heart with separated smaller orbital shards and one subtle energy ring, intricate facets, visiblymorecomplexthantier3.
Row3 column2: Immortal Astral Essence. Familyappearance: Astral Essence: antique-gold star-shaped meteorite geode, indigo cosmic mineral core, bright stellar pinpoints. Immortal tier5: magnificent large intricate sacred crystalline lattice, several levitating satellite gems, fine metallic natural filigree veins, two luminous halo arcs and dazzling bright core, unmistakablythehighestgrade.
Row3 column3: Mortal Mortal Essence. Familyappearance: Mortal Essence: warm amber diamondlike quartz within earth-brown stone, humble natural clay-colored crust and soft lamplight core. Mortal tier1: one small rough simple fragment, minimal faint glow, very few facets, clearly primitive.
Row3 column4: Spirit Mortal Essence. Familyappearance: Mortal Essence: warm amber diamondlike quartz within earth-brown stone, humble natural clay-colored crust and soft lamplight core. Spirit tier2: two or three joined polished crystalline points on original raw base, brighter innercore, slightly larger sophisticated shape.
Row4 column1: Earth Mortal Essence. Familyappearance: Mortal Essence: warm amber diamondlike quartz within earth-brown stone, humble natural clay-colored crust and soft lamplight core. Earth tier3: substantial complex branching crystalcluster with intricate metallic mineral veins and deeply luminous central gemstone, robust multilayer structure.
Row4 column2: Heaven Mortal Essence. Familyappearance: Mortal Essence: warm amber diamondlike quartz within earth-brown stone, humble natural clay-colored crust and soft lamplight core. Heaven tier4: rare luminous levitating crystal heart with separated smaller orbital shards and one subtle energy ring, intricate facets, visiblymorecomplexthantier3.
Row4 column3: Immortal Mortal Essence. Familyappearance: Mortal Essence: warm amber diamondlike quartz within earth-brown stone, humble natural clay-colored crust and soft lamplight core. Immortal tier5: magnificent large intricate sacred crystalline lattice, several levitating satellite gems, fine metallic natural filigree veins, two luminous halo arcs and dazzling bright core, unmistakablythehighestgrade.
Row4 column4: plain midnightindigo empty unused cell.
```

