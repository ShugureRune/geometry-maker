import { describe, expect, it } from 'vitest';
import { ALGORITHM_VERSION } from './scene';
import { fileStem, parseSettings, resolutionError, settingsText, type ProjectSettings } from './settings';
const valid: ProjectSettings = { density:50, schemaVersion: 1, algorithmVersion: ALGORITHM_VERSION, seed: '心音-001', aspectRatio: '16:9', backgroundMode: 'gradient', solidColor: '#111526', gradientColors: ['#112233', '#334455', '#556677'], gradientAngle: 135, exportWidth: 1920, exportHeight: 1080 };
describe('portable, versioned settings', () => {
 it('round-trips all settings including empty and Unicode seeds', () => {
  for(const seed of ['', '心音🌱', ' 001 ']) expect(parseSettings(settingsText({...valid, seed}))).toEqual({...valid, seed});
 });
 it.each([
  ['density', -1], ['density', 101], ['density', 12.5], ['density', '50'], ['schemaVersion', 2], ['algorithmVersion', '2d-v3'], ['seed', 123], ['aspectRatio', '__proto__'],
  ['backgroundMode', 'texture'], ['solidColor', 'red'], ['gradientColors', ['#112233']],
  ['gradientAngle', 361], ['exportWidth', 255], ['exportHeight', 8193], ['exportWidth', 1024.5],
 ])('rejects invalid %s without accepting partial settings', (key, value) => {
  expect(() => parseSettings(JSON.stringify({...valid, [key]: value}))).toThrow();
 });
 it('rejects every missing required field, malformed and oversized files', () => {
  for(const key of Object.keys(valid).filter(key=>key!=='density')) {const copy: Record<string,unknown> = {...valid};delete copy[key]; expect(()=>parseSettings(JSON.stringify(copy))).toThrow();}
  for(const text of ['{','null','[]',' '.repeat(65537)]) expect(()=>parseSettings(text)).toThrow();
 });
 it('defaults legacy density to 50 and restores all levels', () => {
  const {density:_,...legacy}=valid; expect(parseSettings(JSON.stringify(legacy)).density).toBe(50);
  for(const density of [0,25,50,75,100])expect(parseSettings(settingsText({...valid,density})).density).toBe(density);
 });
 it('restores all visual themes through JSON and rejects unknown themes',()=>{
  expect(parseSettings(settingsText(valid)).visualTheme).toBeUndefined();
  for(const visualTheme of ['standard','pop','neon','minimal','pastel','cyber','retro','hologram','glitch','blueprint','wa','cosmic','luxury'] as const){
   expect(parseSettings(settingsText({...valid,visualTheme})).visualTheme).toBe(visualTheme);
  }
  expect(()=>parseSettings(JSON.stringify({...valid,visualTheme:'not-a-theme'}))).toThrow();
  expect(()=>parseSettings(JSON.stringify({...valid,visualTheme:123}))).toThrow();
 });
 it('round trips animation settings with legacy compatibility',()=>{const a={...valid,animationEnabled:true,animationDuration:12,playbackSpeed:2,easingType:'ease-out-in' as const};expect(parseSettings(settingsText(a))).toEqual(a);expect(parseSettings(settingsText(valid)).animationEnabled).toBeUndefined();expect(()=>parseSettings(JSON.stringify({...a,animationDuration:31}))).toThrow();});
 it('round-trips animated grid settings and rejects malformed motion',()=>{
  const gridBackground={
   enabled:true,type:'line' as const,colorMode:'custom' as const,color:'#aabbcc',opacity:65,
   spacing:60,thickness:2,glow:30,rotation:45,
   animation:{enabled:true,mode:'rotate' as const,duration:12,direction:'right' as const,reverse:true},
  };
  expect(parseSettings(settingsText({...valid,gridBackground})).gridBackground).toEqual(gridBackground);
  for(const animation of [
   {...gridBackground.animation,duration:0},
   {...gridBackground.animation,mode:'fake'},
   {...gridBackground.animation,direction:'center'},
   {...gridBackground.animation,reverse:0},
   {...gridBackground.animation,enabled:'true'},
   null,
  ])expect(()=>parseSettings(JSON.stringify({...valid,gridBackground:{...gridBackground,animation}}))).toThrow();
 });
 it('round-trips grid backgrounds and keeps older files compatible',()=>{
  const gridBackground={enabled:true,type:'dot' as const,colorMode:'custom' as const,color:'#aabbcc',opacity:65,spacing:60,thickness:2,glow:30,rotation:45};
  expect(parseSettings(settingsText({...valid,gridBackground})).gridBackground).toEqual(gridBackground);
  expect(parseSettings(settingsText(valid)).gridBackground).toBeUndefined();
  for(const invalid of [{...gridBackground,opacity:120},{...gridBackground,spacing:-1},{...gridBackground,type:'bad'},null]){
   expect(()=>parseSettings(JSON.stringify({...valid,gridBackground:invalid}))).toThrow();
  }
 });
 it('keeps resolutions bounded and filenames safe', () => {
  expect(resolutionError(256,8192)).toBeNull();expect(resolutionError(NaN,256)).not.toBeNull();
  expect(fileStem('../a/b:*?')).not.toMatch(/[/:*?]/);expect(fileStem('')).toContain('seed-empty');
 });
});
