import {renderToStaticMarkup} from 'react-dom/server';
import {createElement} from 'react';
import {AmbientView} from './AmbientView';
import {legacyColors,coloredBackground} from './colors';
import {defaults} from './animation';
import {expect,it} from 'vitest';
import {ambientClock,ambientEnvelope,ambientDefaults,ambientSeed,ambientSettings,ambientVideoSeconds} from './ambient';
it('preserves deterministic initial seed and cycle sequence',()=>{const s={...ambientDefaults,enabled:true};expect(ambientSeed('test',0)).toBe('test');expect(ambientSeed('test',2)).toBe('test::ambient:2');expect(ambientClock(s,40).index).toBe(2);expect(ambientClock({...s,autoSeed:false},40).index).toBe(0);});
it('perfect loop clock returns exactly to its initial state',()=>{const s={...ambientDefaults,loop:'perfect' as const,speed:2};expect(ambientClock(s,0)).toEqual(ambientClock(s,s.duration/s.speed));expect(ambientVideoSeconds(s)).toBe(7);});
it('rejects invalid imported settings and fills old optional fields',()=>{expect(ambientSettings({})).toEqual(ambientDefaults);for(const bad of [{speed:0},{duration:NaN},{mode:'3d'},{enabled:'true'},{transition:99}])expect(()=>ambientSettings(bad)).toThrow();});

it('hold duration changes the actual start of disappearance',()=>{const s={...ambientDefaults,interval:20,hold:5};expect(ambientEnvelope(s,8,6,1).fade).toBe(0);expect(ambientEnvelope({...s,hold:1},8,6,1).fade).toBeCloseTo(1/3);expect(ambientEnvelope(s,14,6,1).fade).toBe(1);});

it('preserves manually edited palette at the initial seed',()=>{const bg={mode:'solid' as const,solid:'#111526',colors:['#111526','#111526','#111526'] as [string,string,string],angle:0,glowIntensity:0};const colors={...legacyColors(bg),mode:'seed' as const};colors.slots.primary.color='#ff0000';const text=renderToStaticMarkup(createElement(AmbientView,{seconds:0,input:{seed:'neon-city',version:'2d-v5',ratio:'16:9',density:50,background:coloredBackground(bg,colors),colors,animation:defaults,settings:{...ambientDefaults,enabled:true,mode:'float'}}}));expect(text).toContain('stroke="#ff0000"');});
