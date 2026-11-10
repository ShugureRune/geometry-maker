import {describe,it,expect} from 'vitest';
import {generateScene} from './scene';
import {densityCandidates,visibleScene} from './density';
import {legacyColors} from './colors';
import {applyThemePalette,themeScene,validVisualTheme,VISUAL_THEMES,THEME_PRESETS} from './themes';

const background={mode:'gradient' as const,solid:'#101820',colors:['#123456','#223344','#334455'] as [string,string,string],angle:135,lineWidth:125,glowIntensity:100};
describe('12 selectable visual themes',()=>{
 it('lists all twelve unique themes and standard with valid palette values',()=>{
  expect(VISUAL_THEMES).toHaveLength(13);
  expect(VISUAL_THEMES[0].id).toBe('standard');
  expect(new Set(VISUAL_THEMES.map(t=>t.id)).size).toBe(13);
  const colors=new Set<string>();
  for(const theme of VISUAL_THEMES){
   expect(validVisualTheme(theme.id)).toBe(true);
   if(theme.id==='standard')continue;
   const p=THEME_PRESETS[theme.id];
   for(const color of [p.solid,...p.colors,p.primary,p.support,p.accent])expect(color).toMatch(/^#[0-9a-f]{6}$/i);
   expect(p.glowIntensity).toBeGreaterThanOrEqual(0);
   expect(p.glowIntensity).toBeLessThanOrEqual(200);
   expect(p.lineWidth).toBeGreaterThanOrEqual(50);
   expect(p.lineWidth).toBeLessThanOrEqual(300);
   colors.add(p.primary);
  }
  expect(colors.size).toBe(12);
  expect(validVisualTheme('anything-else')).toBe(false);
 });
 it('updates unlocked slots and style settings without touching a locked user color',()=>{
  const original=legacyColors(background);
  original.slots.solid={...original.slots.solid,color:'#abcdef',locked:true};
  original.slots.primary={...original.slots.primary,color:'#fadbee',locked:true};
  for(const t of VISUAL_THEMES.filter(t=>t.id!=='standard')){
   const result=applyThemePalette(original,background,t.id);
   expect(result.background.solid).toBe('#abcdef');
   expect(result.background.figureColors?.primary).toBe('#fadbee');
   expect(result.colors.slots.primary.locked).toBe(true);
   expect(result.colors.mode).toBe('manual');
   expect(result.background.glowIntensity).toBe(THEME_PRESETS[t.id].glowIntensity);
   expect(result.background.lineWidth).toBe(THEME_PRESETS[t.id].lineWidth);
  }
  expect(original.slots.solid.color).toBe('#abcdef');
 });
 it('uses deterministic visual styles but preserves original scene and all main figures in v4 and v5',()=>{
  for(const version of ['2d-v4','2d-v5'] as const){
   const source=generateScene('twelve-themes-same-seed','16:9',version);
   const scene=visibleScene(source,densityCandidates(source,'twelve-themes-same-seed'),75);
   const original=structuredClone(scene);
   expect(themeScene(scene,'standard','seed')).toBe(scene);
   const main=scene.shapes.filter(s=>s.role==='hero').map(s=>s.id);
   const fingerprints=new Set<string>();
   for(const theme of VISUAL_THEMES.filter(t=>t.id!=='standard')){
    const a=themeScene(scene,theme.id,'seed');
    const b=themeScene(scene,theme.id,'seed');
    expect(a).toEqual(b);
    expect(a.shapes.filter(s=>s.role==='hero').map(s=>s.id)).toEqual(main);
    const ids=new Set(a.shapes.map(s=>s.id));
    for(const shape of a.shapes)if(shape.parent&&scene.shapes.some(s=>s.id===shape.parent))
     expect(ids.has(shape.parent)).toBe(true);
    fingerprints.add(JSON.stringify(a.shapes.map(s=>[s.id,s.strokeWidth,s.opacity,s.filled])));
   }
   expect(fingerprints.size).toBeGreaterThanOrEqual(10);
   expect(scene).toEqual(original);
  }
 });
});
