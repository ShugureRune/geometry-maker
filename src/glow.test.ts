import {it,expect} from 'vitest';
import {darkTheme} from './themes';
import {legacyColors} from './colors';
import {generateScene,type Background} from './scene';
import {paintFor} from './paint';
import {parseSettings,settingsText} from './settings';
const bg:Background={mode:'solid',solid:'#111526',colors:['#111526','#222222','#333333'],angle:135};
it('themes respect locks and deterministic colors without changing mode or rerolls',()=>{
 const colors=legacyColors(bg);colors.slots.primary.locked=true;const before=JSON.stringify(colors);
 for(const theme of ['night','neon'] as const){const a=darkTheme(colors,'seed',theme);expect(a).toEqual(darkTheme(colors,'seed',theme));expect(a.slots.primary).toEqual(colors.slots.primary);expect(a.mode).toBe(colors.mode);expect(a.appearance).toBe('dark');}expect(JSON.stringify(colors)).toBe(before);
});
it('glow is bounded, monotonic, role weighted and off at zero on bright/dark backgrounds',()=>{
 for(const solid of ['#ffffff','#111526'])for(const role of ['hero','support','decoration'] as const){const shape={...generateScene('001','16:9').shapes[0],role};let previous=0;for(const glowIntensity of [0,25,50,75,100]){const p=paintFor(shape,{...bg,solid,glowIntensity},1600,900);expect(p.glow).toBe(glowIntensity>0);expect(p.glowOpacity).toBeGreaterThanOrEqual(previous);expect(p.glowOpacity).toBeLessThanOrEqual(.85);previous=p.glowOpacity;}}
});
it('JSON restores glow, accepts legacy absence and rejects invalid intensities',()=>{
 const settings={schemaVersion:1 as const,algorithmVersion:'2d-v5',seed:'s',aspectRatio:'16:9' as const,backgroundMode:'solid' as const,solidColor:bg.solid,gradientColors:bg.colors,gradientAngle:135,exportWidth:1920,exportHeight:1080};
 expect(parseSettings(settingsText(settings)).glowIntensity).toBeUndefined();for(const glowIntensity of [0,25,50,75,100,200])expect(parseSettings(settingsText({...settings,glowIntensity})).glowIntensity).toBe(glowIntensity);for(const glowIntensity of [-1,201,'50',NaN])expect(()=>parseSettings(JSON.stringify({...settings,glowIntensity}))).toThrow();
});
