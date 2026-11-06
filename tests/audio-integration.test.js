import assert from 'node:assert/strict';
import test from 'node:test';
import * as rules from '../js/progression.js';
import {readFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';

const read=game=>rules.readSave(null,JSON.stringify(game));

test('legacy sound choice survives migration and new volume settings are independently owned',()=>{
  for(const sound of [false,true]) {
    const game=rules.freshGame(93);rules.begin(game,'Legacy listener');game.sound=sound;delete game.audioSettings;
    const result=read(game);assert.equal(result.warning,undefined);assert.equal(result.game.sound,sound);
    assert.deepEqual(result.game.audioSettings,rules.DEFAULT_AUDIO_SETTINGS);
    result.game.audioSettings.master=0;assert.equal(rules.DEFAULT_AUDIO_SETTINGS.master,.65);
    assert.equal(rules.freshGame(94).audioSettings.master,.65);
  }
});

test('all five zero-to-one audio channels round-trip without changing the active encounter',()=>{
  const game=rules.freshGame(95);rules.begin(game,'Careful listener');rules.encounter(game,'blank-writ');
  game.sound=true;game.audioSettings={master:0,combat:1,ui:.31,progression:.72,pets:.57};
  const restored=read(game);assert.equal(restored.warning,undefined);
  assert.deepEqual(restored.game.audioSettings,game.audioSettings);assert.deepEqual(restored.game.active,game.active);
  assert.equal(restored.game.sound,true,'zero volume remains a preference rather than rewriting the sound toggle');
});

test('malformed volume preferences are rejected rather than silently enabling loud audio',()=>{
  const baseline=rules.freshGame(96);rules.begin(baseline,'Valid listener');
  for(const key of Object.keys(rules.DEFAULT_AUDIO_SETTINGS))for(const value of [-.01,1.01,'0.5',null,{},NaN,Infinity]) {
    const game=structuredClone(baseline);game.audioSettings[key]=value;
    assert.ok(read(game).warning,`${key} ${String(value)}`);
  }
  for(const audioSettings of [null,[],{},'quiet']) {
    const game=structuredClone(baseline);game.audioSettings=audioSettings;assert.ok(read(game).warning);
  }
});

test('every cue and variation resolves to a distinct bundled PCM file with matching measured provenance',()=>{
  const manifest=JSON.parse(readFileSync(new URL('../assets/audio/manifest.json',import.meta.url),'utf8'));
  const report=JSON.parse(readFileSync(new URL('../assets/audio/levels-report.json',import.meta.url),'utf8'));
  assert.equal(manifest.version,1);assert.ok(Object.keys(manifest.cues).length>=60);
  for(const id of ['forge','upgrade','salvage','reward','rest','purchase'])assert.equal(manifest.cues[id].group,'ui',id+' follows the interface/workshop slider');
  for(const id of ['card-draw','victory','defeat'])assert.equal(manifest.cues[id].group,'combat',id+' follows the combat slider');
  for(const id of ['hero-layer','hero-realm','pet-layer','pet-evolve'])assert.equal(manifest.cues[id].group,'progression',id+' follows the cultivation slider');
  const paths=new Set(Object.values(manifest.cues).flatMap(cue=>[cue.src,...(cue.variants||[])]));
  const hashes=[];
  for(const path of paths) {
    assert.match(path,/^assets\/audio\/[a-z0-9-]+\.wav$/);
    const bytes=readFileSync(new URL('../'+path,import.meta.url));
    assert.equal(bytes.toString('ascii',0,4),'RIFF',path);assert.equal(bytes.toString('ascii',8,12),'WAVE',path);
    const hash=createHash('sha256').update(bytes).digest('hex');hashes.push(hash);
    const entry=report.cues.find(entry=>entry.sha256===hash);assert.ok(entry,path);
    assert.ok(entry.peak>0&&entry.peak<1&&entry.rms>0&&entry.duration>0,path);
  }
  assert.equal(new Set(hashes).size,paths.size);
  for(const name of ['kenney-impact-CC0.txt','kenney-interface-CC0.txt','kenney-rpg-CC0.txt','original-dsp-NOTICE.txt'])assert.ok(existsSync(new URL('../assets/audio/licenses/'+name,import.meta.url)),name);
});
