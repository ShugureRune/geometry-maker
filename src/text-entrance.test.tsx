import {describe,it,expect} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {Preview} from './Preview';
import {generateScene} from './scene';
import {parseSettings,settingsText} from './settings';
import {textOverlayDefaults,validateTextOverlay,type TextOverlaySettings} from './text-overlay';
import {textEntranceEnd,textEntranceFrame} from './text-entrance';
import {videoTimeline} from './video-settings';

const text:TextOverlaySettings={...textOverlayDefaults,enabled:true,entrance:'fade',
 entranceDelay:1,entranceDuration:2,entranceEasing:'linear' as const,text:'こんにちは🌟\n世界'};
const background={mode:'solid' as const,solid:'#111526',colors:['#111526','#223344','#556677'] as [string,string,string],angle:135};
const scene=generateScene('entrance-test','16:9','2d-v5');
const markup=(s:typeof text,seconds?:number)=>
 renderToStaticMarkup(<Preview scene={scene} background={background} textOverlay={s} textSeconds={seconds}/>);

describe('independent, deterministic text entrance animation',()=>{
 it('respects delay, duration, easing and finishes precisely',()=>{
  expect(textEntranceFrame(text,0).opacity).toBe(0);
  expect(textEntranceFrame(text,1).opacity).toBe(0);
  expect(textEntranceFrame(text,2)).toMatchObject({progress:.5,opacity:.5,dx:0,dy:0,scale:1});
  expect(textEntranceFrame(text,3).opacity).toBe(1);
  expect(textEntranceFrame(text,100).opacity).toBe(1);
  expect(textEntranceEnd(text)).toBe(3);
  expect(textEntranceEnd({...text,entrance:'none'})).toBe(0);
  expect(textEntranceEnd({...text,enabled:false})).toBe(0);
  expect(textEntranceFrame({...text,entranceEasing:'ease-in'},2).opacity).toBe(.25);
 });
 it('animates both position and opacity while preserving the original text and seed',()=>{
  expect(textEntranceFrame({...text,entrance:'slide-up'},2)).toMatchObject({dy:text.fontSize*.4,opacity:.5});
  expect(textEntranceFrame({...text,entrance:'slide-left'},2)).toMatchObject({dx:text.fontSize*.5,opacity:.5});
  expect(textEntranceFrame({...text,entrance:'zoom'},2)).toMatchObject({scale:.775,opacity:.5});
  const sample=markup({...text,entrance:'slide-up',glowEnabled:true,strokeEnabled:true},2);
  expect(sample).toContain('data-text-progress="0.5"');
  expect(sample).toContain('data-testid="text-glow"');
  expect(sample).toContain('translate(0 ');
  expect(sample).toContain('こんにちは');
  expect(generateScene('entrance-test','16:9','2d-v5')).toEqual(scene);
 });
 it('reveal text by Unicode codepoints, preserving newlines and linked neon outline',()=>{
  const typer={...text,entrance:'typewriter' as const};
  expect(textEntranceFrame(typer,1).text).toBe('');
  expect(textEntranceFrame(typer,2).text).toBe(Array.from(text.text).slice(0,Math.floor(Array.from(text.text).length/2)).join(''));
  expect(textEntranceFrame(typer,3).text).toBe(text.text);
  const neon={...typer,fillMode:'transparent' as const,strokeEnabled:true,strokeColorMode:'text' as const,
   glowEnabled:true,glowTarget:'outline' as const};
  const halfway=markup(neon,2);
  expect(halfway).toContain('data-text-entrance="typewriter"');
  expect(halfway).toContain('fill="none"');
  expect(halfway).toContain('data-testid="text-glow"');
  expect(halfway).not.toContain('🌟');
 });
 it('always saves complete titles for still SVG and extends video timeline when necessary',()=>{
  const staticSvg=markup(text);
  expect(staticSvg).toContain(text.text.split('\n')[0]);
  expect(staticSvg).toContain('data-text-progress="1"');
  expect(staticSvg).toContain('opacity="1"');
  const end=textEntranceEnd(text);
  const duration=videoTimeline(Math.max(1,end),1,30);
  expect(duration.seconds).toBe(3);
  expect(duration.timeAt(duration.frameCount-1)).toBe(3);
 });
 it('round trips new entrance settings, restores old JSON and rejects invalid values',()=>{
  const base={schemaVersion:1 as const,algorithmVersion:'2d-v5',seed:'title-entrance',
   aspectRatio:'16:9' as const,backgroundMode:'solid' as const,solidColor:'#111526',
   gradientColors:background.colors,gradientAngle:135,exportWidth:1920,exportHeight:1080};
  const previous={...textOverlayDefaults} as Record<string,unknown>;
  for(const key of ['entrance','entranceDelay','entranceDuration','entranceEasing'])delete previous[key];
  expect(parseSettings(JSON.stringify({...base,textOverlay:previous})).textOverlay).toEqual(textOverlayDefaults);
  expect(parseSettings(settingsText({...base,textOverlay:text})).textOverlay).toEqual(text);
  expect(parseSettings(settingsText({...base,algorithmVersion:'2d-v4',textOverlay:text})).textOverlay).toEqual(text);
  for(const invalid of [{entrance:'javascript:'},{entranceDuration:0},{entranceDuration:8.1},
   {entranceDelay:-.1},{entranceDelay:11},{entranceEasing:'custom'},{entranceDuration:NaN}]){
   expect(()=>validateTextOverlay({...text,...invalid})).toThrow();
  }
 });
});
