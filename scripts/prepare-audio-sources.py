"""Stage selected verified Kenney CC0 Foley; no external code is executed."""
from pathlib import Path
import json,shutil,hashlib
ROOT=Path(__file__).resolve().parents[1]
selection={
 'interface':['click_001','click_002','select_001','open_001','close_001','confirmation_001','error_001','glass_001','pluck_001','switch_001'],
 'impact':['impactBell_heavy_000','impactGlass_heavy_000','impactGlass_light_000','impactMetal_light_000','impactMetal_medium_000','impactPunch_medium_000','impactPunch_heavy_000','impactWood_light_000','impactMining_000'],
 'rpg':['bookFlip1','bookFlip2','bookOpen','bookClose','cloth1','cloth2','drawKnife1','knifeSlice','handleCoins','metalClick','chop'],
}
sources=[]
for pack,names in selection.items():
 target=ROOT/'assets/audio/source'/pack;target.mkdir(parents=True,exist_ok=True)
 license_path=ROOT/'assets/audio/licenses'/f'kenney-{pack}-CC0.txt';license_path.parent.mkdir(parents=True,exist_ok=True)
 shutil.copyfile(ROOT/'tmp/audio-source'/pack/'License.txt',license_path)
 for name in names:
  src=ROOT/'tmp/audio-source'/pack/'Audio'/f'{name}.ogg';dest=target/src.name;shutil.copyfile(src,dest)
  sources.append({'id':f'{pack}/{name}','src':dest.relative_to(ROOT).as_posix(),'sha256':hashlib.sha256(dest.read_bytes()).hexdigest()})
(ROOT/'tmp/audio-source/selected.json').write_text(json.dumps(sources,indent=2),encoding='utf-8')
print(json.dumps({'selected':len(sources),'sourceBytes':sum((ROOT/x['src']).stat().st_size for x in sources)}))
