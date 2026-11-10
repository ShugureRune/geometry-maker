import {describe,it,expect,vi} from 'vitest';
import {extractImagePalette,applyImagePalette,contrastRatio} from './image-palette';
import {legacyColors,coloredBackground,reseedColors,SLOTS} from './colors';
import {generateScene} from './scene';
import {parseSettings,settingsText} from './settings';

function makePixels(entries:{color:[number,number,number];count:number;alpha?:number}[]){
 return new Uint8ClampedArray(entries.flatMap(e=>Array.from({length:e.count},()=>[...e.color,e.alpha??255]).flat()));
}
const hex=/^#[a-f0-9]{6}$/i;
const picture=makePixels([
 {color:[25,45,70],count:900},
 {color:[235,150,70],count:260},
 {color:[55,187,161],count:160},
 {color:[222,88,180],count:80},
 {color:[240,241,242],count:40}
]);
const bg={mode:'gradient' as const,solid:'#111526',colors:['#111526','#223344','#667788'] as [string,string,string],angle:135};
const base=()=>legacyColors(bg);

describe('on-device image palette extraction',()=>{
 it('finds dominant colors, emits RGB hex swatches and readable stroke recommendations deterministically',()=>{
  const first=extractImagePalette(picture),second=extractImagePalette(picture);
  expect(first).toEqual(second);
  expect(first.swatches.length).toBeGreaterThanOrEqual(5);
  expect(first.swatches.length).toBeLessThanOrEqual(8);
  expect(first.solid).toMatch(hex);
  expect(first.solid).toEqual(first.gradient[0]);
  expect(first.swatches[0]).toBe('#192d46');
  for(const c of [...first.swatches,...first.gradient,...first.figures])expect(c).toMatch(hex);
  for(const figure of first.figures)for(const background of first.gradient)
   expect(contrastRatio(figure,background)).toBeGreaterThanOrEqual(4.4);
 });
 it.each([
  [255,255,255],[0,0,0],[119,119,119],[170,170,170],[248,45,108],[24,80,230],[22,165,85]
 ])('handles monochrome / near-monochrome photo RGB %d,%d,%d without invisible strokes',(r,g,b)=>{
  const palette=extractImagePalette(makePixels([{color:[r,g,b],count:300}]));
  expect(palette.swatches.length).toBeGreaterThanOrEqual(5);
  expect(palette.swatches.length).toBeLessThanOrEqual(8);
  for(const figure of palette.figures)for(const back of palette.gradient)
   expect(contrastRatio(figure,back)).toBeGreaterThanOrEqual(4.45);
 });
 it('ignores transparent pixels and produces a useful error for fully transparent uploads',()=>{
  const alpha=makePixels([
   {color:[255,0,0],count:700,alpha:0},
   {color:[19,80,140],count:80,alpha:255},
   {color:[0,255,0],count:20,alpha:20}
  ]);
  expect(extractImagePalette(alpha).solid).toBe('#13508c');
  expect(()=>extractImagePalette(makePixels([{color:[1,2,3],count:4,alpha:0}]))).toThrow();
  expect(()=>extractImagePalette(new Uint8ClampedArray([1,2]))).toThrow();
 });
 it('does not use time or unseeded randomness',()=>{
  const random=vi.spyOn(Math,'random').mockImplementation(()=>{throw Error('random');});
  const now=vi.spyOn(Date,'now').mockImplementation(()=>{throw Error('now');});
  try{expect(extractImagePalette(picture).swatches.length).toBeGreaterThanOrEqual(5);}
  finally{random.mockRestore();now.mockRestore();}
 });
 it('applies only requested slots while respecting manual locks',()=>{
  const palette=extractImagePalette(picture);
  const starting=base();
  starting.slots.gradient1.locked=true;
  starting.slots.primary.locked=true;
  const before=structuredClone(starting);
  const background=applyImagePalette(starting,palette,'background');
  expect(background.mode).toBe('manual');
  expect(background.slots.solid.color).toBe(palette.solid);
  expect(background.slots.gradient1).toEqual(before.slots.gradient1);
  expect(background.slots.primary).toEqual(before.slots.primary);
  expect(background.slots.support).toEqual(before.slots.support);
  const figures=applyImagePalette(starting,palette,'figures');
  expect(figures.slots.solid).toEqual(before.slots.solid);
  expect(figures.slots.gradient0).toEqual(before.slots.gradient0);
  expect(figures.slots.primary).toEqual(before.slots.primary);
  expect(figures.slots.support.color).toBe(palette.figures[1]);
  const all=applyImagePalette(starting,palette,'all');
  expect(all.slots.primary.locked).toBe(true);
  expect(all.slots.primary.color).toBe(before.slots.primary.color);
  for(const id of SLOTS)expect(all.edited).toContain(id);
  expect(starting).toEqual(before);
 });
 it('retains imported palette across seed changes, and persists through existing JSON without storing image bytes',()=>{
  const palette=extractImagePalette(picture);
  const applied=applyImagePalette(base(),palette,'all');
  expect(reseedColors(applied,'different-seed')).toEqual(applied);
  expect(coloredBackground(bg,applied).figureColors?.primary).toBe(palette.figures[0]);
  const settings={schemaVersion:1 as const,algorithmVersion:'2d-v5',seed:'same-seed',
   aspectRatio:'16:9' as const,backgroundMode:bg.mode,solidColor:palette.solid,
   gradientColors:palette.gradient,gradientAngle:135,exportWidth:1920,exportHeight:1080,colorSettings:applied};
  const json=settingsText(settings);
  expect(JSON.parse(json)).not.toHaveProperty('image');
  expect(JSON.parse(json)).not.toHaveProperty('preview');
  expect(parseSettings(json).colorSettings).toEqual(applied);
  expect(generateScene('same-seed','16:9')).toEqual(generateScene('same-seed','16:9'));
 });
});
