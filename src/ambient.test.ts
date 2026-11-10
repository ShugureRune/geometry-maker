import {renderToStaticMarkup} from 'react-dom/server';
import {createElement} from 'react';
import {AmbientView} from './AmbientView';
import {legacyColors,coloredBackground,reseedColors} from './colors';
import {defaults} from './animation';
import {expect,it} from 'vitest';
import {ambientClock,ambientEnvelope,ambientDefaults,ambientSeed,ambientSettings,ambientVideoSeconds} from './ambient';
it('accepts 0–360 degree headings and keeps old direction-only settings compatible',()=>{
 for(const angle of [0,45,90,180,270,360])expect(ambientSettings({scrollAngle:angle}).scrollAngle).toBe(angle);
 for(const angle of [-1,360.1,361,NaN,'90',Infinity])expect(()=>ambientSettings({scrollAngle:angle})).toThrow();
 expect(ambientSettings({direction:'diagonal'}).scrollAngle).toBeUndefined();
});
it('preserves deterministic initial seed and cycle sequence',()=>{const s={...ambientDefaults,enabled:true};expect(ambientSeed('test',0)).toBe('test');expect(ambientSeed('test',2)).toBe('test::ambient:2');expect(ambientClock(s,40).index).toBe(2);expect(ambientClock({...s,autoSeed:false},40).index).toBe(0);});
it('perfect loop clock returns exactly to its initial state',()=>{const s={...ambientDefaults,loop:'perfect' as const,speed:2};expect(ambientClock(s,0)).toEqual(ambientClock(s,s.duration/s.speed));expect(ambientVideoSeconds(s)).toBe(7);});
it('rejects invalid imported settings and fills old optional fields',()=>{expect(ambientSettings({})).toEqual(ambientDefaults);for(const bad of [{speed:0},{duration:NaN},{mode:'3d'},{enabled:'true'},{transition:99}])expect(()=>ambientSettings(bad)).toThrow();});

it('defaults scroll hero density to 100 and accepts up to 400 without changing regular density',()=>{
 expect(ambientDefaults.scrollDensity).toBe(100);
 expect(ambientSettings({}).scrollDensity).toBe(100);
 for(const density of [0,50,100,200,300,400]){
  const settings=ambientSettings({scrollDensity:density});
  expect(settings.scrollDensity).toBe(density);
  expect(ambientSettings(JSON.parse(JSON.stringify(settings))).scrollDensity).toBe(density);
 }
 expect(()=>ambientSettings({scrollDensity:401})).toThrow();
 expect(()=>ambientSettings({scrollDensity:-1})).toThrow();
});

it('hold duration changes the actual start of disappearance',()=>{const s={...ambientDefaults,interval:20,hold:5};expect(ambientEnvelope(s,8,6,1).fade).toBe(0);expect(ambientEnvelope({...s,hold:1},8,6,1).fade).toBeCloseTo(1/3);expect(ambientEnvelope(s,14,6,1).fade).toBe(1);});

it('preserves manually edited palette at the initial seed',()=>{const bg={mode:'solid' as const,solid:'#111526',colors:['#111526','#111526','#111526'] as [string,string,string],angle:0,glowIntensity:0};const colors={...legacyColors(bg),mode:'seed' as const};colors.slots.primary.color='#ff0000';const text=renderToStaticMarkup(createElement(AmbientView,{seconds:0,input:{seed:'neon-city',version:'2d-v5',ratio:'16:9',density:50,background:coloredBackground(bg,colors),colors,animation:defaults,settings:{...ambientDefaults,enabled:true,mode:'float'}}}));expect(text).toContain('stroke="#ff0000"');});

it('reverse growth retracts figures without fading the next scene over them',()=>{
 const background={mode:'solid' as const,solid:'#111526',colors:['#111526','#111526','#111526'] as [string,string,string],angle:0};
 const render=(mode:'growth'|'combined'|'float',transitionType:'reverse'|'crossfade'|'fade'|'shrink',seconds:number)=>
  renderToStaticMarkup(createElement(AmbientView,{seconds,input:{
   seed:'reverse-only-transition',version:'2d-v5',ratio:'16:9',density:50,background,
   animation:defaults,settings:{...ambientDefaults,enabled:true,mode,transitionType}
  }}));
 const backgrounds=(svg:string)=>(svg.match(/data-testid="background"/g)??[]).length;
 const shapes=(svg:string)=>(svg.match(/data-shape-id="/g)??[]).length;
 for(const mode of ['growth','combined','float'] as const){
  const before=render(mode,'reverse',10);
  const reversing=render(mode,'reverse',13.5);
  expect(backgrounds(reversing)).toBe(1);
  expect(shapes(reversing)).toBeLessThan(shapes(before));
  expect(backgrounds(render(mode,'reverse',14))).toBe(1);
  for(const other of ['crossfade','fade','shrink'] as const){
   expect(backgrounds(render(mode,other,13.5))).toBe(2);
  }
 }
});

it('smoothly crossfades only the background during reverse growth, for solid and gradient modes',()=>{
 const seed='reverse-bg-transition';
 for(const mode of ['solid','gradient'] as const){
  const base={mode,solid:'#111526',colors:['#112233','#334455','#556677'] as [string,string,string],angle:135};
  const colors={...legacyColors(base),mode:'seed' as const};
  const background=coloredBackground(base,reseedColors(colors,seed));
  const input={seed,version:'2d-v5' as const,ratio:'16:9' as const,density:50,colors,background,animation:defaults,
   settings:{...ambientDefaults,enabled:true,mode:'growth' as const,loop:'evolving' as const,transitionType:'reverse' as const}};
  const render=(seconds:number)=>renderToStaticMarkup(createElement(AmbientView,{seconds,input}));
  const before=render(10),middle=render(12.5),late=render(13.5),after=render(14);
  const overlay=(svg:string)=>svg.match(/<rect[^>]*data-testid="transition-background"[^>]*>/)?.[0];
  expect(overlay(before)).toBeUndefined();
  expect(overlay(after)).toBeUndefined();
  expect(overlay(middle)).toContain('opacity="0.5"');
  expect(overlay(late)).toContain('opacity="0.8333333333333334"');
  expect((middle.match(/data-testid="background"/g)??[])).toHaveLength(1);
  // Reverse growth is still a single scene; only its backdrop gets a second layer.
  expect((middle.match(/data-testid="preview"/g)??[])).toHaveLength(1);
  const next=coloredBackground(base,reseedColors(colors,ambientSeed(seed,1)));
  if(mode==='solid'){
   expect(overlay(middle)).toContain(`fill="${next.solid}"`);
   expect(overlay(middle)).not.toContain(`fill="${background.solid}"`);
   expect(after).toContain(`data-testid="background" width="1600" height="900" fill="${next.solid}"`);
  }else{
   expect(overlay(middle)).toContain('-next)');
   expect(middle).toContain('data-testid="transition-background-gradient"');
   for(const color of next.colors)expect(middle).toContain(`stop-color="${color}"`);
   expect(after).not.toContain('data-testid="transition-background-gradient"');
  }
 }
});
