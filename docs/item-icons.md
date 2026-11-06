# Item and skill icon pass

The inventory uses a dedicated original illustration for every item. `itemIcon(item)` in `js/item-art.js` resolves all 231 IDs to square isolated prop art. The first 32 signature items use `assets/art/icon-<id>.webp`; the other 199 use `assets/art/item-<id>.webp`. `itemArt(item)` retains the original larger detail illustrations. The 117 techniques use their existing individual square CGI illustrations through `cardArt(card)`.

The item pass adds 199 square inventory icons and reshoots the 32 signature items as square isolated objects. Weapons, armor, accessories, relics, talismans, medicines, materials, and manuals each have a distinct prop design. Materials use loose fibers, shards, minerals, or vessels appropriate to their lore. Manuals use individual symbolic cover ornaments that describe the technique being taught.

## Generation brief

Built-in ImageGen generated thirteen four-by-four icon sheets and two additional square sheets for the signature items. Each tile was a separate original subject, with the full object centered and a safe margin for use at 48 pixels. The shared prompt specified premium dark xianxia CGI, sculptural geometry, physically based jade, silk, glass, and metal, a quiet charcoal background, dramatic soft rim lighting, and one clear readable silhouette. Content names, types, schools, and descriptions supplied the individual row-major prompts. The signature pass used the original art as an identity reference and required an overall 1:1 canvas with sixteen square cells.

School palettes keep related objects recognizable. Iron uses silver and blue, Ember copper and vermillion, Tide turquoise and pearl, Shade violet and black, Lotus ivory and jade, Thunder indigo and electrical silver, and Star midnight gold and brass. The render brief excludes interface frames, labels, and readable lettering so the game can supply its own rarity frames and controls.

## Integration checks

Every atlas was visually inspected for the correct subject order and clean tile edges. Crops trim the sheet seams, then use WebP compression for local delivery. The mapping is updated only after its files exist. All 231 item paths and all 117 technique paths are checked for existence, image decoding, and unique file content.
