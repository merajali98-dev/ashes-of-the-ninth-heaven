# Spirit companion art

This game feature uses original built-in ImageGen artwork: one habitat map, eight unique eggs, and 24 creature state cutouts. It does not use the ChatGPT Work Pets plugin.

## Deployed assets

The map is `assets/art/pet-map.webp`, 1586 × 992 pixels. The eight landmarks follow the normalized coordinates in `js/pets.js`; the viewport preserves the map's aspect ratio. The background contains no baked-in creatures, eggs, labels, or UI markers, allowing actual game state to control every overlay.

Each species has four unique 512 × 512 RGBA WebP files at `assets/art/pet-<id>-<state>.webp`: `egg`, `young`, `adult`, and `ascended`. The transparent padding supports map, battle, hatching, and evolution presentation. Creature forms correspond to the runtime's young realms 0–2, adult realms 3–5, and ascended realms 6–9. Animation and intermediate realm halos are controlled by the game UI.

| Species ID | Habitat | Center x/y (%) |
| --- | --- | --- |
| azure-dragon | Cloudpeak Mountains | 18 / 22 |
| vermilion-phoenix | Cinder Caldera | 73 / 20 |
| white-tiger | Frostpine Ravine | 13 / 55 |
| black-tortoise | Stillwater Island | 78 / 76 |
| nine-tail-fox | Moonveil Grove | 44 / 55 |
| jade-qilin | Verdant Spring | 44 / 28 |
| kun-peng | Skyreef Expanse | 72 / 47 |
| thunder-serpent | Stormglass Marsh | 39 / 82 |

## Art direction and production

The art uses detailed original Chinese cultivation fantasy animals and a coherent dark CGI landscape. Eggs carry each species' colors and mineral motifs. Young creatures preserve recognizable anatomy while mature and ascended forms gain elaborate mane, feather, antler, shell, tail, and qi structures. Kun Peng visibly develops from skywhale into the great bird Peng. The map's snowy peaks, caldera, frostpine forest, lake, moon grove, jade garden, sky reef, and stormglass marsh remain distinct at a zoomed-out view.

The initial two creature atlases each contain four species in rows and four states in columns. Their variable-width subject groups were extracted using individually reviewed bounds instead of equal quarter cuts, then centered on transparent canvases. A background-extraction edit removed residual pale canvas haze from the second sheet. Close inspection identified three clipped outer boundaries, so the adult phoenix, ascended Kun Peng, and ascended thunder serpent received individual transparent repairs restoring full wings, tail, horns, and halos.

All generated originals remain in the tool's generated-images directory. Only final WebP assets are deployed. Source/crop/verification records are in `tmp/pet-art/`. Existing card, material, and cultivation assets were retained.

| Source | Original PNG |
| --- | --- |
| Habitat map | `exec-3569c7d9-387b-4153-b649-1a45b01f9f94.png` |
| Dragon, phoenix, tiger, tortoise sheet | `exec-9c098239-f78a-4a6e-9dc5-02e4675f716d.png` |
| Fox, qilin, Kun Peng, serpent sheet before alpha correction | `exec-99e5c7d1-02f0-4a59-9b84-e5fcbd1518f7.png` |
| Corrected second sheet | `exec-69115583-926e-47a7-8d53-0ef5b46cad4b.png` |
| vermilion-phoenix-adult repaired cutout | `exec-3b61ef2c-1398-4d94-9ee8-63985b9e64c7.png` |
| kun-peng-ascended repaired cutout | `exec-86685311-43f4-48a0-b505-133b3eea9ff7.png` |
| thunder-serpent-ascended repaired cutout | `exec-1813692e-6d77-437a-9567-edc08952e6d0.png` |

## Final verification

- All 33 deployed assets decode successfully and have distinct SHA-256 file hashes.
- All 32 egg/creature images have distinct decoded-pixel hashes and preserve RGBA transparency, with fully transparent corner pixels and at least 48.29% completely empty alpha.
- The map is 1586 × 992; all state sprites are 512 × 512. Combined deployed size is 2,749,404 bytes (2.62 MiB).
- The corrected atlases and all three repaired individual sprites were visually inspected. The repaired phoenix and Kun Peng have complete wings and tails; the serpent has complete horns and halo with transparent margins.
- Native browser integration checks confirmed the habitat placement and transparent dragon/tiger presentation without rectangular backdrops. All 33 asset paths were also fetched and decoded in the browser during integration QA; the final three repairs retain the same paths and dimensions.

## Exact source prompts

### Habitat map

```text
Use case: stylized-concept. Create ONE wide landscape 16:10 illustrated fantasy game habitat world map background, highest available resolution. Original dark Chinese xianxia cultivation world, premium contemporary 3D CGI donghua, physically based rock, snow, jade, water, mist and vegetation. Elevated isometric aerial camera looking down over one continuous coherent miniature continent; no horizon, no large sky band. The ENTIRE map fits the frame. Rich detailed cinematic environments but large readable landmarks. Midnight indigo, weathered antique gold architectural remnants, colored qi gently illuminating each biome. EXACT landmark center placements measured as percentages from image left and top: 
1 x18% y22% Cloudpeak Mountains: tall jagged mountain summit with pale cyan cloudlight, ancient stone terrace visibly open at target point. 
2 x73% y20% Cinder Caldera: volcanic crater with orange lava ring, black basalt shelves and brass-red ruins, open warm plateau at target point. 
3 x13% y55% Frostpine Ravine: snowy conifer forest and blue-white frozen cliffs, open snow clearing at target point. 
4 x78% y76% Stillwater Island: tranquil turquoise lake, tiny dark island crowned by jade stones, open flat island surface at target point. 
5 x44% y55% Moonveil Grove: violet moonlit willow and silverleaf forest, luminous mushrooms, silver lantern tree and open purple moss clearing at target point. 
6 x44% y28% Verdant Spring: lush jade Chinese garden with gold-roofed pavilion, green lotus pools, small open spring terrace at target point. 
7 x72% y47% Skyreef Expanse: floating limestone reef cliffs and suspended stone arches over blue cloud abyss, broad open floating ledge at target point. 
8 x39% y82% Stormglass Marsh: dark winding canyon opening into a marsh, pale cobalt stormglass crystal reeds and distant forked lightning, open dark wet stone clearing at target point. 
Connect regions organically with winding paths, streams, low bridges, mist-filled valleys and terrain transitions; natural map rather than eight rectangular panels. Leave breathing room near each landmark center for later game creature overlays. No living creatures, pets, monsters, eggs, people, icons, markers, labels, text, numbers, borders, UI, compass, or watermark anywhere. Background only.
```

### Creature atlas 1

```text
Use case: stylized-concept. Create ONE square RGBA game creature sprite atlas on a GENUINELY TRANSPARENT BACKGROUND. EXACT4x4 regular equal square cells,16 total, no gutters, no outlines or borders, NO text/labels/numbers/watermarks. Each cell contains ONE separate isolated complete 3D creature or egg, centered, all limbs/feathers/tails/halos inside central85%tile, fully visible, no overlap between cells. All surrounding space and between subjects must be truly transparent alpha, NOT white/black/checkerboard/background painting. No floor planes, no terrain, no pedestals, no rectangular backdrop. Premium detailed realistic3D CGI Chinese xianxia donghua fantasy animals, original designs, believable anatomy, physically based fur/scales/feathers/obsidian/jade, finely groomed details, warmgold/coolblue cinematic rimlight. Silhouette highly readable as a small game companion. Elegant, fantastical, appealing, dignified, not cartoon, not humanoid, no human faces, no gore. Within each row one species evolves across columns: column1 a unique whole unhatched egg; column2 small hatchling; column3 mature majestic evolved creature; column4 spectacular immortal final evolution with distinctly more elaborate anatomy, qi mantle and thin school-colored aureole. Maintain recognizable design lineage; growth is structural not mere recoloring. Qi glow must hug subject, not create square background. Requested true transparent background. Strict row-major cells:
Row1 column1: Azure Dragon egg: upright polished turquoise egg with gold branching cloud veins and a few tiny antler-shaped crystal projections, unbroken.
Row1 column2: Azure Dragon young: small graceful cyan Chinese river dragon, four short legs, long curved serpentine body, tiny gold antler buds and short silver whiskers, coiled upright.
Row1 column3: Azure Dragon adult: majestic long azure Chinese river dragon, four muscular clawed limbs, branching ivory-gold antlers, long flowing white mane and whiskers, dense iridescent cyan scales, elegant S-curve, NO wings.
Row1 column4: Azure Dragon ascended: sovereign cyan river dragon with massive branching golden antlers, pearl-white flowing mane, layered gold-jade scale armor ridges, luminous cloud ribbons and thin celestial gold-cyan halo, four limbs, coiled S-curve, no wings.
Row2 column1: Vermilion Phoenix egg: upright deep scarlet egg with glowing orange feather-shaped mineral patterns and a small flame wisplet at top, unbroken.
Row2 column2: Vermilion Phoenix young: small vermilion phoenix chick with soft rich red feathers, gold crest buds, two short brightgold tail feathers, wings slightly spread.
Row2 column3: Vermilion Phoenix adult: majestic vermilion phoenix in midair, wide articulated red-gold wings fully visible, elegant hooked beak, ornate crest and several long curling fire-tipped tail feathers.
Row2 column4: Vermilion Phoenix ascended: immortal phoenix with layered ruby-gold wings, crown of radiant crest feathers, extravagant long split tail plumes, gold-white flames edging feathers and a thin sun aureole, whole body and wings visible.
Row3 column1: White Tiger egg: upright pearl-white egg with bold dark-silver tiger stripe markings, silver frost filigree and icy-blue inner glow, unbroken.
Row3 column2: White Tiger young: small realistic fluffy white tiger cub, black-silver stripes, large rounded paws, icy-blue eyes, alert seated three-quarter pose.
Row3 column3: White Tiger adult: powerful adult white tiger with dense groomed white fur, silver-black stripes, pronounced shoulder musculature, long curved tail, pale metal-like forehead ridge, standing three-quarter pose.
Row3 column4: White Tiger ascended: immortal white tiger with broad silver mane, ornate silver-jade natural armor ridges along shoulders, silver-black striped luminous pelt, large gold-tipped claws, icy qi fur tufts and thin pale silver halo, standing proud.
Row4 column1: Black Tortoise egg: upright dark obsidian egg with turquoise hexagonal shell lattice, jade-green seams and a few crystalline nodules, unbroken.
Row4 column2: Black Tortoise young: small black tortoise hatchling with charming stout feet, dark glossy hexagonal shell, tiny jade mineral ridge and cyan eyes, complete body in three-quarter view.
Row4 column3: Black Tortoise adult: ancient powerful black tortoise with massive obsidian segmented shell, jade ridgeline growing like small island crags, bronze etched mineral edges, thick scaled limbs and short strong tail.
Row4 column4: Black Tortoise ascended: immortal black tortoise bearing a miniature jade mountain island naturally grown from enormous dark shell, turquoise luminous rivers along shell seams, gold-jade ridge crown, sturdy ancient face, thin stillwater qi aura.
```

### Creature atlas 2

```text
Use case: stylized-concept. Create ONE square RGBA game creature sprite atlas on a GENUINELY TRANSPARENT BACKGROUND. EXACT4x4 regular equal square cells,16 total, no gutters, no outlines or borders, NO text/labels/numbers/watermarks. Each cell contains ONE separate isolated complete 3D creature or egg, centered, all limbs/feathers/tails/halos inside central85%tile, fully visible, no overlap between cells. All surrounding space and between subjects must be truly transparent alpha, NOT white/black/checkerboard/background painting. No floor planes, no terrain, no pedestals, no rectangular backdrop. Premium detailed realistic3D CGI Chinese xianxia donghua fantasy animals, original designs, believable anatomy, physically based fur/scales/feathers/obsidian/jade, finely groomed details, warmgold/coolblue cinematic rimlight. Silhouette highly readable as a small game companion. Elegant, fantastical, appealing, dignified, not cartoon, not humanoid, no human faces, no gore. Within each row one species evolves across columns: column1 a unique whole unhatched egg; column2 small hatchling; column3 mature majestic evolved creature; column4 spectacular immortal final evolution with distinctly more elaborate anatomy, qi mantle and thin school-colored aureole. Maintain recognizable design lineage; growth is structural not mere recoloring. Qi glow must hug subject, not create square background. Requested true transparent background. Strict row-major cells:
Row1 column1: Nine-Tail Fox egg: upright silver-lilac egg wrapped in nine embossed flowing tail-like silver patterns, violet inner glow, unbroken.
Row1 column2: Nine-Tail Fox young: small silver fox kit with luminous violet eyes, large pointed ears and three fluffy tails fanning behind, delicate violet ear tips, seated three-quarter pose.
Row1 column3: Nine-Tail Fox adult: elegant mature silver nine-tailed fox, all nine fluffy tails arranged in clear broad fan behind body, fine violet markings and white-silver fur, graceful lifted paw.
Row1 column4: Nine-Tail Fox ascended: immortal silver nine-tailed fox with extravagant nine enormous long silky tails spread in a radiating fan, violet-gold fur tips, small jade forehead jewel, flowing purple moon qi and thin lunar halo, animal anatomy.
Row2 column1: Jade Qilin egg: upright jade-green egg with gold scale-like mineral lattice and tiny leaf-shaped crystal ridges, unbroken.
Row2 column2: Jade Qilin young: small graceful qilin fawn with jade-green scaled deer body, delicate hooves, fluffy pale mane and two small antler buds, curious three-quarter stance.
Row2 column3: Jade Qilin adult: majestic jade qilin with lean deer-horse body, overlapping emerald dragon scales, long branchlike gold antlers, flowing pale white mane, tufted tail and jade hooves.
Row2 column4: Jade Qilin ascended: immortal qilin with beautifully branching golden-jade antlers, elaborate luminous jade scales, white flowing mane and tail, fine gold leg and shoulder mineral armor, floating lotus-petal qi and thin green-gold aureole.
Row3 column1: Kun Peng egg: upright navy-blue egg with turquoise ocean swirls, silver feather patterns and soft luminous star pinpoints, unbroken.
Row3 column2: Kun Peng young: small friendly realistic skywhale hatchling floating in air, rounded blue-gray whale body, wide luminous cyan fins, tiny silver feather buds on fin edges, short tail, no legs.
Row3 column3: Kun Peng adult: evolving Kun Peng celestial skywhale with elongated deepblue whale body and great partly feathered wing-fins, silverwhite feather mantle across shoulders, strong broad tail, dynamic floating three-quarter pose.
Row3 column4: Kun Peng ascended: immortal great bird Peng, magnificent colossal eagle-like celestial bird with rich midnight-blue and silverwhite layered feathers, enormous elegant wings, gold-edged plumage, ocean-blue long flowing tail, subtle whale-like smooth chest crest preserving lineage, thin blue-gold heavenly halo.
Row4 column1: Thunder Serpent egg: upright dark cobalt egg with bright angular lightning-shaped silver cracks as mineral markings, small crystalline crown tip, unbroken.
Row4 column2: Thunder Serpent young: small horned blue-violet serpent hatchling, smooth narrow scaled legless body in upright coil, two tiny silver horns, curious brightblue eyes, no limbs and no wings.
Row4 column3: Thunder Serpent adult: powerful long legless thunder serpent coiled upright, cobalt-violet diamond scales, dramatic swept-back silver horns, broad crystalline neck frill, thin lightning tracing spine, no limbs.
Row4 column4: Thunder Serpent ascended: immortal legless storm serpent with elaborate silver-gold branching horns, layered crystalline cobalt neck frill and spine ridges, long sinuous violet-blue coils, electric-blue lightning tightly wrapping body and thin storm aureole, no limbs or wings.
```

### Second-sheet alpha correction

```text
Use case: background-extraction. Edit this existing 16-subject creature-and-egg atlas. Preserve EVERY creature and egg exactly: face, anatomy, fur, feather/scales, color, pose, halo, details, and each subject's current position and scale. Change ONLY the backdrop: REMOVE the pale white/gray rectangular background and all broad haze or ground shadows BETWEEN subjects. All empty space and gaps must have actual fully transparent alpha zero. Keep softly antialiased subject edges and tight creature qi effects. There must be NO white/gray matte, NO checkerboard, NO colored background, NO floor, NO added scene, NO labels. This is a production sprite atlas composited over a dark game world; the entire rectangular canvas must not appear as a translucent pale sheet. Isolated subjects with clean genuine transparent backgrounds, exact original16 subjects unchanged.
```
### Repair: vermilion-phoenix-adult

```text
Use case: precise-object-edit and background-extraction. This is a production game pet sprite. Preserve the reference creature's exact design, face, colors, pose, anatomy, scale/feather details, and stage identity. Repair only the clipped outer extremities/effect boundary and remove residual pale background haze. Restore both fully extended wing tips with natural feather anatomy. Restore the complete flowing flame-tipped tail. Keep the same vermilion-gold phoenix design. Whole bird fits fully within frame. Center the ONE isolated creature on a truly TRANSPARENT square RGBA canvas with generous 14% transparent padding on ALL four sides. Absolutely no part of the body, horns, wings, tail, or halo touches the image edges. Transparent alpha zero in all empty space; no rectangular white/gray matte, no backdrop, no ground shadow, no floor, no frame, no text, no additional creatures. Retain fine antialiased edges and tight colored qi around the creature. Premium original realistic 3D CGI Chinese cultivation fantasy quality.
```
### Repair: kun-peng-ascended

```text
Use case: precise-object-edit and background-extraction. This is a production game pet sprite. Preserve the reference creature's exact design, face, colors, pose, anatomy, scale/feather details, and stage identity. Repair only the clipped outer extremities/effect boundary and remove residual pale background haze. Restore complete wing tips on BOTH sides, all tail plumes, and the full thin blue-gold halo. Keep the same majestic midnight-blue and silver-white bird Peng design. Whole bird fits fully within frame. Center the ONE isolated creature on a truly TRANSPARENT square RGBA canvas with generous 14% transparent padding on ALL four sides. Absolutely no part of the body, horns, wings, tail, or halo touches the image edges. Transparent alpha zero in all empty space; no rectangular white/gray matte, no backdrop, no ground shadow, no floor, no frame, no text, no additional creatures. Retain fine antialiased edges and tight colored qi around the creature. Premium original realistic 3D CGI Chinese cultivation fantasy quality.
```
### Repair: thunder-serpent-ascended

```text
Use case: precise-object-edit and background-extraction. This is a production game pet sprite. Preserve the reference creature's exact design, face, colors, pose, anatomy, scale/feather details, and stage identity. Repair only the clipped outer extremities/effect boundary and remove residual pale background haze. Restore the entire upper golden horn crown and complete circular electric halo, without any flat cropped top edge. Keep the same violet-blue legless coiled horned serpent design. Whole serpent and effect halo fit fully within frame. Center the ONE isolated creature on a truly TRANSPARENT square RGBA canvas with generous 14% transparent padding on ALL four sides. Absolutely no part of the body, horns, wings, tail, or halo touches the image edges. Transparent alpha zero in all empty space; no rectangular white/gray matte, no backdrop, no ground shadow, no floor, no frame, no text, no additional creatures. Retain fine antialiased edges and tight colored qi around the creature. Premium original realistic 3D CGI Chinese cultivation fantasy quality.
```

