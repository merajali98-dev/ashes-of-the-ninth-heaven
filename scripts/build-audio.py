"""Render the game's original, layered 22.05 kHz PCM16 sound palette.

Inputs are the selected Kenney CC0 Foley decoded by decode-audio-sources.mjs.
All music-like fragments, modal instruments, air textures and creature voices
below are original deterministic DSP compositions, not AI or animal recordings.
"""
from pathlib import Path
import hashlib,json,math,wave
import numpy as np

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'assets/audio';OUT.mkdir(parents=True,exist_ok=True)
SR=22050
SOURCES=ROOT/'tmp/audio-source/decoded'
notes=[146.83,174.61,196.,220.,261.63,293.66,349.23,392.,440.,523.25,587.33]
source_cache={}
used_sources=set()
def sample(name):
 used_sources.add(name)
 if name not in source_cache:
  a=np.fromfile(SOURCES/(name.replace('/','--')+'.f32'),dtype='<f4').astype(float)
  nz=np.where(abs(a)>0.0001)[0]
  if len(nz):a=a[max(0,nz[0]-80):min(len(a),nz[-1]+220)]
  source_cache[name]=a
 return source_cache[name]
def buf(d):return np.zeros(int(SR*d),dtype=float)
def add(y,a,at=0,gain=1,rate=1):
 if rate!=1:a=np.interp(np.arange(0,len(a),rate),np.arange(len(a)),a)
 start=max(0,int(at*SR));length=min(len(a),len(y)-start)
 if length>0:y[start:start+length]+=a[:length]*gain
def foley(y,name,at=0,gain=.5,rate=1,reverse=False):
 a=sample(name);add(y,a[::-1] if reverse else a,at,gain,rate)
def env(d,attack=.008,decay=5):
 t=np.arange(int(SR*d))/SR
 return t,np.minimum(1,t/max(.001,attack))*np.exp(-t*decay)
def bell(freq,d=.6,brightness=.45):
 t,e=env(d,.003,5/d)
 a=np.sin(2*np.pi*freq*t)*e
 for ratio,level,fall in [(2.756,brightness,8/d),(5.404,brightness*.4,13/d),(8.93,brightness*.13,18/d)]:
  a+=level*np.sin(2*np.pi*freq*ratio*t)*np.exp(-t*fall)*np.minimum(1,t/.002)
 return a
def pad(freq,d=1,vibrato=3):
 t,e=env(d,.12,2/d)
 phase=2*np.pi*(freq*t+np.sin(t*2*np.pi*vibrato)*.17)
 return (np.sin(phase)+.24*np.sin(phase*2.003)+.11*np.sin(phase*3.009))*e
def air(d,rng,brightness=1,fall=False):
 t=np.arange(int(SR*d))/SR;n=rng.normal(0,1,len(t))
 smooth=np.convolve(n,np.ones(19)/19,'same')
 high=n-np.convolve(n,np.ones(4)/4,'same')
 e=np.sin(np.pi*np.minimum(1,t/d))**1.8
 if fall:e=(1-np.exp(-t*90))*np.exp(-t*9/d)
 return (smooth*.8+high*.10*brightness)*e
def thump(freq,d=.3):
 t,e=env(d,.001,12)
 phase=2*np.pi*(freq*t+freq*.18*(1-np.exp(-t*30))/30)
 return np.sin(phase)*e
def reverb(y,amount=.12):
 clean=y.copy()
 for delay,level in [(.043,.55),(.079,.39),(.131,.29),(.211,.18),(.317,.1)]:
  add(y,clean,delay,amount*level)
def chord(y,steps,at=0,gain=.15,spacing=.085,octave=1):
 for i,note in enumerate(steps):add(y,bell(notes[note]*octave,.65,.29),at+i*spacing,gain)
def voice(kind,rng):
 d=1.05;t=np.arange(int(d*SR))/SR
 if kind=='azure-dragon':
  phase=2*np.pi*(76*t+23*np.sin(t*np.pi)/np.pi);a=(np.sin(phase)+.45*np.sin(phase*2)+.22*np.sin(phase*3))*np.sin(np.pi*t/d)**1.4
  a+=air(d,rng,.4)*.9
 elif kind=='vermilion-phoenix':
  a=np.sin(2*np.pi*(850*t+240*t*t+.8*np.sin(2*np.pi*6*t)))*np.sin(np.pi*t/d)**2*.65+air(d,rng,1)*.55
 elif kind=='white-tiger':
  phase=2*np.pi*(112*t-19*t*t+1.3*np.sin(2*np.pi*17*t));a=np.tanh(2*np.sin(phase))*.6*np.sin(np.pi*t/d)**1.4+air(d,rng,.4)*.9
 elif kind=='black-tortoise':a=pad(82,d,2)*.8+pad(164,d,2)*.25+air(d,rng,.2)*.35
 elif kind=='nine-tail-fox':
  a=buf(d)
  for at,f in [(.02,680),(.23,940),(.47,760)]:add(a,bell(f,.3,.12),at,.6)
  a+=air(d,rng,.5)*.3
 elif kind=='jade-qilin':a=pad(220,d,3)*.4+bell(440,d,.35)*.7+bell(660,d,.15)*.2
 elif kind=='kun-peng':a=np.sin(2*np.pi*(125*t+72*t*t+1.4*np.sin(t*15)))*np.sin(np.pi*t/d)**1.5+air(d,rng,.4)*.8
 else:
  a=air(d,rng,2)*1.6+(np.sin(2*np.pi*(178*t+58*t*t))+.2*np.sin(2*np.pi*1400*t))*np.sin(np.pi*t/d)**2*.4
 return a

recipes={}
def cue(name,group,duration,design,gain=.75):recipes[name]=(group,duration,design,gain)
for kind in ['strike','ward','mantra','remedy','hex','formation','stance','counter','pact','ritual','transmute','finisher']:
 cue('cast-'+kind,'combat',.84 if kind in ['formation','ritual','finisher'] else .64,'cast:'+kind,.72)
for name,d in [('impact-light',.34),('impact-heavy',.57),('blocked',.40),('shield-break',.68),('heal',.75),('status',.52),('tick',.3),('cleanse',.66),('dispel',.59),('recover',.65),('resonance',1.15),('phase',1.15),('ritual-resolve',.85),('pet-command',.45)]:cue(name,'combat',d,name,.7)
for name,d in [('ui-click',.14),('ui-select',.23),('ui-open',.28),('ui-close',.24),('ui-error',.28),('card-draw',.23),('turn-end',.40),('turn-start',.55),('purchase',.55),('forge',.8),('upgrade',.85),('salvage',.62),('reward',.9),('deck-save',.5),('deck-equip',.55),('rest',1.05),('victory',1.7),('defeat',1.35),('sound-preview',.75)]:cue(name,'ui' if name.startswith(('ui-','deck-')) or name in ['purchase','card-draw'] else 'combat' if name.startswith('turn-') else 'progression',d,name,.65)
for name,d in [('hero-layer',1.1),('hero-realm',2.7),('pet-layer',1.05),('pet-hatch',2.0),('egg-crack',.45),('pet-evolve',2.7),('pet-feed',.65)]:cue(name,'pets' if name.startswith('pet-') or name=='egg-crack' else 'progression',d,name,.8)
pet_ids=['azure-dragon','vermilion-phoenix','white-tiger','black-tortoise','nine-tail-fox','jade-qilin','kun-peng','thunder-serpent']
for name in pet_ids:cue('pet-'+name,'pets',1.22,'voice:'+name,.55)

def render(name,group,d,design):
 rng=np.random.default_rng(int(hashlib.sha256(name.encode()).hexdigest()[:8],16));y=buf(d)
 if design.startswith('cast:'):
  kind=design[5:]
  add(y,air(min(.51,d),rng,.8),.01,.6)
  if kind=='strike':foley(y,'rpg/knifeSlice',.01,.28,1.15);add(y,bell(740,.45,.2),.09,.1)
  elif kind=='ward':foley(y,'impact/impactGlass_light_000',.04,.11,.8);chord(y,[2,5],.015,.12,.09,2)
  elif kind=='mantra':chord(y,[0,2,4,5],.01,.12,.055,2);add(y,pad(196,.6),0,.1)
  elif kind=='remedy':chord(y,[2,4,6],.02,.1,.075,2);foley(y,'rpg/cloth1',0,.18,1.2)
  elif kind=='hex':add(y,pad(174.61,.63,7)[::-1],0,.25);add(y,pad(246.94,.63,5),0,.08);add(y,air(.55,rng,.5),0,.35)
  elif kind=='formation':add(y,pad(98,.8),0,.23);chord(y,[0,2,4],.02,.08,.09);foley(y,'impact/impactBell_heavy_000',.03,.07,.7,True)
  elif kind=='stance':foley(y,'rpg/drawKnife1',0,.25,1.08);add(y,bell(523,.55,.2),.06,.12);add(y,air(.35,rng),.15,.4)
  elif kind=='counter':foley(y,'rpg/knifeSlice',0,.2,1.3,True);foley(y,'rpg/drawKnife1',.15,.23,1.3);add(y,bell(660,.4,.15),.02,.08)
  elif kind=='pact':add(y,thump(61,.5),.01,.3);add(y,pad(146.83,.63,7)[::-1],0,.21);add(y,air(.6,rng,.4),0,.5)
  elif kind=='ritual':
   for i in range(3):foley(y,'interface/click_002',i*.105,.06,1+i*.12)
   chord(y,[4,2,0],.07,.1,.08,2);add(y,pad(130.81,.8),0,.12)
  elif kind=='transmute':foley(y,'interface/glass_001',.01,.17,.8,True);chord(y,[0,4,2,6],.03,.08,.065,2)
  else:add(y,pad(73.4,.82),0,.3);add(y,air(.65,rng,1.3),.02,1);chord(y,[0,2,4,5],.03,.1,.075)
  reverb(y,.1)
 elif design.startswith('voice:'):
  add(y,voice(design[6:],rng),0,.6);reverb(y,.13)
 elif name in ['impact-light','impact-heavy']:
  heavy=name.endswith('heavy');foley(y,'impact/impactPunch_heavy_000' if heavy else 'impact/impactPunch_medium_000',0,.65,.82 if heavy else 1.1)
  add(y,thump(54 if heavy else 95,.45),0,.45);add(y,air(.2,rng,1,True),0,.3)
 elif name=='blocked':foley(y,'impact/impactMetal_medium_000',0,.6,.9);add(y,bell(320,.4,.27),0,.22)
 elif name in ['shield-break','egg-crack']:
  foley(y,'impact/impactGlass_heavy_000' if name=='shield-break' else 'impact/impactGlass_light_000',0,.7,.8 if name=='shield-break' else 1.1)
  add(y,air(.22,rng,1.5,True),0,.4);add(y,bell(520,.4,.5),0,.09)
 elif name in ['heal','cleanse','recover','dispel','status']:
  chord(y,[2,4,5] if name in ['heal','cleanse','recover'] else [5,2,0],0,.18,.075,2)
  add(y,air(.42,rng,.5),0,.5)
  if name=='dispel':foley(y,'interface/glass_001',0,.28,1.2)
  reverb(y,.14)
 elif name=='tick':add(y,thump(135,.2),0,.4);add(y,air(.14,rng,.5,True),0,.6)
 elif name in ['resonance','phase','ritual-resolve']:
  add(y,bell(146.83 if name=='phase' else 293.66,1.1,.6),0,.5)
  chord(y,[0,2,4,5] if name!='phase' else [5,4,0],.04,.16,.08,2);add(y,air(.7,rng),0,.5);reverb(y,.17)
 elif name=='pet-command':add(y,air(.38,rng),0,.8);add(y,bell(392,.4,.2),0,.16)
 elif name.startswith('ui-'):
  source={'ui-click':'click_001','ui-select':'select_001','ui-open':'open_001','ui-close':'close_001','ui-error':'error_001'}[name]
  foley(y,'interface/'+source,0,.45,.9)
  if name=='ui-select':add(y,bell(587,.2,.15),0,.08)
 elif name=='card-draw':foley(y,'rpg/bookFlip1',0,.55,1.15);foley(y,'rpg/cloth2',.02,.14,1.1)
 elif name in ['turn-end','turn-start']:
  foley(y,'rpg/bookClose' if name=='turn-end' else 'rpg/bookOpen',0,.35,1.3)
  chord(y,[2,0] if name=='turn-end' else [2,4],.03,.12,.09)
 elif name=='purchase':foley(y,'rpg/handleCoins',0,.55,1.2);add(y,bell(659,.5,.3),.03,.16)
 elif name in ['forge','upgrade','salvage']:
  foley(y,'impact/impactMining_000' if name=='forge' else 'impact/impactMetal_light_000' if name=='upgrade' else 'impact/impactGlass_light_000',0,.5,.85)
  chord(y,[0,4,5] if name!='salvage' else [5,2,0],.08,.16,.065,2);add(y,air(.45,rng,.7),.07,.5);reverb(y,.12)
 elif name in ['deck-save','deck-equip']:
  foley(y,'rpg/bookClose',0,.3,1.3);chord(y,[0,4] if name=='deck-save' else [2,5],.03,.15,.08,2)
 elif name=='rest':add(y,pad(196,1.0),0,.26);chord(y,[2,4],.02,.12,.15);add(y,air(.8,rng,.2),0,.2)
 elif name in ['reward','victory','defeat','sound-preview']:
  steps=[0,2,4,5] if name!='defeat' else [4,2,0]
  chord(y,steps,.02,.24,.13 if name!='sound-preview' else .09,2)
  if name=='victory':add(y,pad(146.83,1.6),0,.18);chord(y,[5,7,9],.5,.14,.14)
  if name=='defeat':add(y,pad(73.4,1.3),0,.25)
  reverb(y,.2)
 elif name in ['hero-layer','pet-layer']:
  chord(y,[2,4,5,7],.02,.2,.1,2 if name=='pet-layer' else 1)
  add(y,air(.64,rng,.5),0,.5);add(y,bell(146.83,.8,.5),.02,.18);reverb(y,.17)
 elif name in ['hero-realm','pet-evolve','pet-hatch']:
  add(y,pad(73.4,d-.1),0,.26);add(y,air(min(1.2,d-.1),rng,.8),0,.65)
  chord(y,[0,2,4,5,7],.05,.19,.12,1)
  add(y,bell(146.83,d-.3,.6),.22,.28);chord(y,[5,7,9],.7,.19,.14,1)
  if name=='pet-hatch':foley(y,'impact/impactGlass_light_000',.32,.18,.8)
  reverb(y,.25)
 elif name=='pet-feed':foley(y,'rpg/bookFlip2',0,.35,.9);add(y,air(.45,rng,.4),.06,.6);chord(y,[2,4],.08,.13,.1,2)
 else:raise ValueError(name)
 y-=np.mean(y)
 y=np.tanh(y*1.2)
 # Small fades prevent clicks; preserve full designed tail, then trim digital silence.
 fade=min(len(y)//2,int(.004*SR));y[:fade]*=np.linspace(0,1,fade);y[-int(.018*SR):]*=np.linspace(1,0,int(.018*SR))
 peak=max(float(np.max(abs(y))),1e-9);target=.74 if group=='ui' else .80 if group=='pets' else .84
 y*=target/peak
 nz=np.where(abs(y)>1e-5)[0]
 if len(nz):y=y[max(0,nz[0]-44):min(len(y),nz[-1]+88)]
 return y

manifest={'version':1,'sampleRate':SR,'format':'PCM16 mono WAV','cues':{},'sources':[
 {'id':'kenney-interface','author':'Kenney','title':'Interface Sounds','url':'https://kenney.nl/assets/interface-sounds','license':'CC0-1.0','licenseFile':'assets/audio/licenses/kenney-interface-CC0.txt'},
 {'id':'kenney-impact','author':'Kenney','title':'Impact Sounds','url':'https://kenney.nl/assets/impact-sounds','license':'CC0-1.0','licenseFile':'assets/audio/licenses/kenney-impact-CC0.txt'},
 {'id':'kenney-rpg','author':'Kenney','title':'RPG Audio','url':'https://kenney.nl/assets/rpg-audio','license':'CC0-1.0','licenseFile':'assets/audio/licenses/kenney-rpg-CC0.txt'},
 {'id':'original-dsp','author':'Ashes of the Ninth Heaven project','title':'Original procedural compositions and sound design','license':'LicenseRef-Project-Original','licenseFile':'assets/audio/licenses/original-dsp-NOTICE.txt'},
]}
waves={};metrics=[]
def save(path,y):
 with wave.open(str(path),'wb') as f:f.setnchannels(1);f.setsampwidth(2);f.setframerate(SR);f.writeframes(np.rint(np.clip(y,-.999,.999)*32767).astype('<i2').tobytes())
for name,(group,d,design,gain) in recipes.items():
 used_sources.clear()
 y=render(name,group,d,design);save(OUT/(name+'.wav'),y);waves[name]=y
 duration=len(y)/SR
 manifest['cues'][name]={'src':f'assets/audio/{name}.wav','duration':round(duration,6),'gain':gain,'group':group,'cooldownMs':1200 if design.startswith('voice:') else 90 if group=='ui' else 120,'priority':4 if name in ['hero-realm','pet-evolve','pet-hatch','victory'] else 1 if group=='ui' else 2,'design':design,'sourceClips':sorted(used_sources)}
 # Playback buses follow the mixer labels independently of rendering recipes.
 if name in ['forge','upgrade','salvage','reward','rest']:
  manifest['cues'][name]['group']='ui'
 if name in ['card-draw','victory','defeat']:
  manifest['cues'][name]['group']='combat'
 if name in ['pet-layer','pet-evolve']:
  manifest['cues'][name]['group']='progression'
 metrics.append({'id':name,'duration':duration,'peak':float(np.max(abs(y))),'rms':float(np.sqrt(np.mean(y*y))),'sha256':hashlib.sha256((OUT/(name+'.wav')).read_bytes()).hexdigest()})
for name,rate in [('ui-click',.96),('ui-select',1.045),('card-draw',.945),('impact-light',1.06)]:
 base=waves[name];alt=np.interp(np.arange(len(base))*rate,np.arange(len(base)),base,left=0,right=0)
 fade=min(250,len(alt)//3);alt[:55]*=np.linspace(0,1,55);alt[-fade:]*=np.linspace(1,0,fade)
 alt*=.74/max(float(np.max(abs(alt))),1e-9)
 variant=name+'-alternate';save(OUT/(variant+'.wav'),alt)
 manifest['cues'][name]['variants']=[f'assets/audio/{name}.wav',f'assets/audio/{variant}.wav']
 metrics.append({'id':variant,'duration':len(alt)/SR,'peak':float(np.max(abs(alt))),'rms':float(np.sqrt(np.mean(alt*alt))),'sha256':hashlib.sha256((OUT/(variant+'.wav')).read_bytes()).hexdigest()})
audition_order=['ui-select','card-draw','cast-strike','impact-heavy','cast-ward','blocked','shield-break','cast-hex','cast-ritual','cast-transmute','cast-finisher','impact-heavy','hero-layer','pet-azure-dragon','pet-vermilion-phoenix','pet-hatch','hero-realm']
audition=np.concatenate([np.concatenate([waves[name]*manifest['cues'][name]['gain']*.65,buf(.28)]) for name in audition_order]);save(OUT/'audition.wav',audition)
manifest['audition']={'src':'assets/audio/audition.wav','duration':round(len(audition)/SR,6),'sequence':audition_order}
manifest['sourceClips']=json.loads((ROOT/'tmp/audio-source/selected.json').read_text(encoding='utf-8'))
(OUT/'manifest.json').write_text(json.dumps(manifest,indent=2),encoding='utf-8')
(OUT/'levels-report.json').write_text(json.dumps({'sampleRate':SR,'cues':metrics,'uniqueHashes':len(set(x['sha256'] for x in metrics)),'totalCueBytes':sum((OUT/(x['id']+'.wav')).stat().st_size for x in metrics),'auditionDuration':len(audition)/SR},indent=2),encoding='utf-8')
license_dir=OUT/'licenses';license_dir.mkdir(exist_ok=True)
(license_dir/'original-dsp-NOTICE.txt').write_text('Original sound design and deterministic DSP compositions created for the Ashes of the Ninth Heaven project.\nThe project owner controls licensing and distribution of these original contributions. No public-domain dedication of the project owner\'s original work is made here.\nKenney Foley components are CC0 1.0 Universal and retain the separately supplied notices.\nNo AI audio generation service, proprietary sample library, voice actor recording, or real animal recording was used.\n',encoding='utf-8')
print(json.dumps({'cues':len(recipes),'files':len(metrics),'uniqueHashes':len(set(x['sha256'] for x in metrics)),'cueBytes':sum((OUT/(x['id']+'.wav')).stat().st_size for x in metrics),'auditionSeconds':len(audition)/SR,'minimumRms':min(x['rms'] for x in metrics),'maximumPeak':max(x['peak'] for x in metrics)}))
