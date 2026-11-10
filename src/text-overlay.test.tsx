import {describe,it,expect} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {Preview} from './Preview';
import {generateScene} from './scene';
import {settingsText,parseSettings} from './settings';
import {textOverlayDefaults,validateTextOverlay} from './text-overlay';

const background={mode:'solid' as const,solid:'#111526',colors:['#111526','#223344','#556677'] as [string,string,string],angle:135};
const project={schemaVersion:1 as const,algorithmVersion:'2d-v5',seed:'text-overlay',aspectRatio:'16:9' as const,
 backgroundMode:'solid' as const,solidColor:'#111526',gradientColors:background.colors,gradientAngle:135,
 exportWidth:1920,exportHeight:1080};

describe('SVG text layer and portable settings',()=>{
 it('keeps old seed composition and old JSON behavior when text is disabled',()=>{
  const before=generateScene('unchanged','16:9','2d-v5');
  const markup=renderToStaticMarkup(<Preview scene={before} background={background}/>);
  const disabled=renderToStaticMarkup(<Preview scene={before} background={background} textOverlay={textOverlayDefaults}/>);
  expect(disabled).toBe(markup);
  expect(generateScene('unchanged','16:9','2d-v5')).toEqual(before);
  expect(parseSettings(settingsText(project)).textOverlay).toBeUndefined();
 });
 it('puts text in front of or behind shapes and escapes arbitrary text',()=>{
  const scene=generateScene('text','16:9','2d-v5');
  const settings={...textOverlayDefaults,enabled:true,text:'タイトル & <test>\nサブタイトル',strokeEnabled:true,shadowEnabled:true};
  const front=renderToStaticMarkup(<Preview scene={scene} background={background} textOverlay={settings}/>);
  expect(front).toContain('data-testid="text-overlay"');
  expect(front).toContain('タイトル &amp; &lt;test&gt;');
  expect(front).toContain('サブタイトル');
  expect(front).toContain('paint-order="stroke"');
  expect(front.indexOf('data-testid="text-overlay"')).toBeGreaterThan(front.indexOf('data-testid="shapes"'));
  const back=renderToStaticMarkup(<Preview scene={scene} background={background} textOverlay={{...settings,layer:'back'}}/>);
  expect(back.indexOf('data-testid="text-overlay"')).toBeLessThan(back.indexOf('data-testid="shapes"'));
  expect(back.indexOf('data-testid="text-overlay"')).toBeGreaterThan(back.indexOf('data-testid="background"'));
 });
 it('round-trips multiline CJK text and styles through schema v1',()=>{
  const textOverlay={...textOverlayDefaults,enabled:true,text:'急行 池袋\nShugure Rune',x:27,y:42,rotation:-12,
   layer:'back' as const,fontSize:112,shadowEnabled:true};
  const result=parseSettings(settingsText({...project,textOverlay}));
  expect(result.textOverlay).toEqual(textOverlay);
  expect(result.seed).toBe(project.seed);
  expect(result.algorithmVersion).toBe('2d-v5');
 });
 it('rejects invalid and unsafe text styles without losing legacy project support',()=>{
  const s={...textOverlayDefaults,enabled:true};
  for(const change of [{fontFamily:'url(https://example.com)'},{text:'x'.repeat(2001)},{text:'\n'.repeat(12)},
   {fontSize:-1},{x:101},{opacity:Infinity},{layer:'svg'},{color:'red'},{rotation:181}]){
   expect(()=>validateTextOverlay({...s,...change})).toThrow();
   expect(()=>parseSettings(JSON.stringify({...project,textOverlay:{...s,...change}}))).toThrow();
  }
  expect(validateTextOverlay({...s,extra:'ignore'})).toEqual(s);
 });
});
