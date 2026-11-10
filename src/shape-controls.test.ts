import {describe,it,expect} from 'vitest';
import {generateScene,type Ratio} from './scene';
import {shapeBounds,crossesRect,contoursOf,worldPoint} from './geometry';
import {createScrollWorld} from './scroll-world';
import {ambientDefaults,type AmbientInput} from './ambient';
import {defaults} from './animation';
import {legacyColors} from './colors';
import {parseSettings,settingsText} from './settings';
import {
 ALL_SHAPE_KINDS,SHAPE_LABELS,SHAPE_FAMILIES,BASIC_SHAPE_KINDS,EXTENDED_SHAPE_KINDS,
 validateShapeKinds,resolveAllowedShapeKind,isAllShapeKindsEnabled
} from './shape-controls';

describe('v5 shape kind selection and replacement',()=>{
 it('covers all real kinds exactly once, and validates imports',()=>{
  expect(new Set(ALL_SHAPE_KINDS).size).toBe(ALL_SHAPE_KINDS.length);
  expect([...BASIC_SHAPE_KINDS,...EXTENDED_SHAPE_KINDS].sort()).toEqual([...ALL_SHAPE_KINDS].sort());
  expect(SHAPE_FAMILIES.flatMap(f=>f.kinds).sort()).toEqual([...ALL_SHAPE_KINDS].sort());
  for(const kind of ALL_SHAPE_KINDS)expect(SHAPE_LABELS[kind].length).toBeGreaterThan(0);
  expect(validateShapeKinds(['octagon','hexagon'])).toEqual(['octagon','hexagon']);
  expect(isAllShapeKindsEnabled(ALL_SHAPE_KINDS)).toBe(true);
  expect(isAllShapeKindsEnabled(['circle'])).toBe(false);
  for(const bad of [[],['octagon','octagon'],['not-a-shape'],['__proto__'],[1],null,'circle']){
   expect(()=>validateShapeKinds(bad)).toThrow();
  }
 });
 it('prefers same-family and near-kind replacements, deterministically',()=>{
  expect(resolveAllowedShapeKind('octagon',['hexagon'],'seed','hero-0')).toBe('hexagon');
  expect(['hexagon','circle']).toContain(resolveAllowedShapeKind('gear',['hexagon','circle'],'seed','support-0'));
  expect(resolveAllowedShapeKind('orbit',['arc','line'],'seed','hero-1')).toBe('arc');
  expect(resolveAllowedShapeKind('wave',['circle'],'seed','detail-1')).toBe('circle');
  expect(resolveAllowedShapeKind('octagon',['octagon'],'seed','hero-0')).toBe('octagon');
  expect(resolveAllowedShapeKind('octagon',undefined,'seed','hero-0')).toBe('octagon');
  expect(()=>resolveAllowedShapeKind('octagon',[],'seed','hero-0')).toThrow();
  const results=Array.from({length:30},(_,i)=>resolveAllowedShapeKind('octagon',['hexagon','pentagon','diamond'],'seed',String(i)));
  expect(results).toEqual(Array.from({length:30},(_,i)=>resolveAllowedShapeKind('octagon',['hexagon','pentagon','diamond'],'seed',String(i))));
  expect(new Set(results).size).toBeGreaterThan(1);
 });
 it('leaves the original v5 exactly unchanged with all kinds enabled, and v4 unchanged even when restricted',()=>{
  for(const ratio of ['16:9','9:16','1:1'] as Ratio[]){
   for(let i=0;i<15;i++){
    const seed='shapes-default-'+i;
    expect(generateScene(seed,ratio,'2d-v5',ALL_SHAPE_KINDS)).toEqual(generateScene(seed,ratio,'2d-v5'));
    expect(generateScene(seed,ratio,'2d-v4',['circle'])).toEqual(generateScene(seed,ratio,'2d-v4'));
   }
  }
 });
 it('replaces disabled figures with enabled kinds, retaining readable title space, boundaries and parent links',()=>{
  const configurations=[
   ['circle'],
   ['hexagon','pentagon','circle'],
   ['triangle','line'],
   ['gear','orbit','shield'],
   ['octagon'],
   BASIC_SHAPE_KINDS,
   EXTENDED_SHAPE_KINDS,
   ALL_SHAPE_KINDS.filter(k=>k!=='octagon'&&k!=='gear'&&k!=='orbit')
  ] as const;
  for(const allowed of configurations)for(const ratio of ['16:9','9:16','1:1'] as Ratio[]){
   for(let i=0;i<12;i++){
    const seed='shape-allowlist-'+i,scene=generateScene(seed,ratio,'2d-v5',allowed);
    expect(generateScene(seed,ratio,'2d-v5',allowed)).toEqual(scene);
    expect(scene.shapes.some(s=>s.role==='hero')).toBe(true);
    const ids=new Set(scene.shapes.map(s=>s.id));
    for(const shape of scene.shapes){
     expect(allowed).toContain(shape.kind);
     if(shape.parent)expect(ids.has(shape.parent)).toBe(true);
     expect(crossesRect(shape,scene.composition.quiet,scene.composition.unit*.01)).toBe(false);
     const b=shapeBounds(shape);
     expect([b.x,b.y,b.width,b.height].every(Number.isFinite)).toBe(true);
     if(!shape.bleed){
      expect(b.x).toBeGreaterThanOrEqual(-1e-7);
      expect(b.y).toBeGreaterThanOrEqual(-1e-7);
      expect(b.x+b.width).toBeLessThanOrEqual(scene.width+1e-7);
      expect(b.y+b.height).toBeLessThanOrEqual(scene.height+1e-7);
     }
    }
   }
  }
 },30000);
 it('attaches any retained branch to actual replacement hero outlines',()=>{
  const allowed=['hexagon','branch-circuit','dot'] as const;
  let count=0;
  for(let i=0;i<60;i++){
   const scene=generateScene('connected-'+i,'16:9','2d-v5',allowed);
   const byId=new Map(scene.shapes.map(s=>[s.id,s]));
   for(const branch of scene.shapes.filter(s=>s.kind==='branch-circuit'&&s.id.includes('-branch-'))){
    const parent=byId.get(branch.parent!)!;
    const start=worldPoint(branch,contoursOf(branch)[0].points[0]);
    const min=Math.min(...contoursOf(parent).flatMap(c=>c.points.map(p=>{const w=worldPoint(parent,p);return Math.hypot(w.x-start.x,w.y-start.y);})));
    expect(min).toBeLessThan(1e-7);count++;
   }
  }
  expect(count).toBeGreaterThan(0);
 },30000);
 it('generates a usable scene with each individual kind as the only allowed kind',()=>{
  for(const allowed of ALL_SHAPE_KINDS){
   for(const ratio of ['16:9','1:1','9:16'] as Ratio[]){
    for(let i=0;i<5;i++){
     const scene=generateScene('only-kind-'+i,ratio,'2d-v5',[allowed]);
     expect(scene.shapes.length).toBeGreaterThan(0);
     expect(scene.shapes.some(s=>s.role==='hero')).toBe(true);
     expect(scene.shapes.every(s=>s.kind===allowed)).toBe(true);
     expect(scene.composition.quiet.width*scene.composition.quiet.height/(scene.width*scene.height)).toBeGreaterThan(.01);
    }
   }
  }
 },30000);
 it('round trips shape selections in settings JSON while retaining old files',()=>{
  const base={schemaVersion:1 as const,algorithmVersion:'2d-v5',seed:'shape-setting',aspectRatio:'16:9' as const,
   backgroundMode:'solid' as const,solidColor:'#101820',gradientColors:['#123456','#234567','#345678'] as [string,string,string],
   gradientAngle:135,exportWidth:1920,exportHeight:1080};
  expect(parseSettings(settingsText(base)).enabledShapeKinds).toBeUndefined();
  expect(parseSettings(settingsText({...base,enabledShapeKinds:['circle','octagon']})).enabledShapeKinds).toEqual(['circle','octagon']);
  for(const bad of [[],['circle','circle'],['wrong'],[null]]){
   expect(()=>parseSettings(JSON.stringify({...base,enabledShapeKinds:bad}))).toThrow();
  }
 });
 it('applies custom kinds to scroll groups without showing disallowed main or decorations',()=>{
  const bg={mode:'solid' as const,solid:'#101820',colors:['#112233','#223344','#334455'] as [string,string,string],angle:135};
  const input:AmbientInput={seed:'shape-scroll',version:'2d-v5',ratio:'16:9',density:80,background:bg,
   animation:defaults,colors:legacyColors(bg),
   enabledShapeKinds:['hexagon','circle','dot'],
   settings:{...ambientDefaults,enabled:true,mode:'scroll',loop:'evolving',scrollDensity:100}};
  const world=createScrollWorld(input);
  const groups=world.frame(8,input.settings).groups;
  expect(groups.length).toBeGreaterThan(0);
  for(const group of groups){
   expect(group.scene.shapes.filter(s=>s.role==='hero').length).toBeGreaterThan(0);
   expect(group.scene.shapes.every(s=>input.enabledShapeKinds!.includes(s.kind))).toBe(true);
  }
 });
});
