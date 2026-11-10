import {describe,it,expect} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {Preview} from './Preview';
import {generateScene} from './scene';
import {settingsText,parseSettings} from './settings';
import {textOverlayDefaults,validateTextOverlay,type TextOverlaySettings} from './text-overlay';

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


describe('palette-linked text ink and independent glow',()=>{
 const scene=generateScene('color-link','16:9','2d-v5');
 const paletteBackground={...background,figureColors:{primary:'#fa45ca',support:'#49dfee',accent:'#a7ed63'}};
 const title={...textOverlayDefaults,enabled:true,text:'タイトル'};
 const draw=(settings:typeof title,backgroundColor=paletteBackground)=>
  renderToStaticMarkup(<Preview scene={scene} background={backgroundColor} textOverlay={settings}/>);
 it('keeps plain titles unchanged and adds a glow only when enabled',()=>{
  const plain=draw(title);
  expect(plain).not.toContain('data-testid="text-glow"');
  const glow=draw({...title,glowEnabled:true,glowStrength:155,glowBlur:14});
  expect(glow).toContain('data-testid="text-glow"');
  expect(glow).toContain('feGaussianBlur');
  expect(glow).toContain('stdDeviation="14"');
  expect(glow).toContain('slope="2.55"');
  expect(draw({...title,glowEnabled:true,glowStrength:0})).not.toContain('data-testid="text-glow"');
  expect(draw({...title,glowEnabled:true,glowColorMode:'custom',glowColor:'#ff2200'})).toContain('fill="#ff2200"');
 });
 it('resolves role colors at render time and reacts to theme / palette changes',()=>{
  const roles=[['primary','#fa45ca'],['support','#49dfee'],['accent','#a7ed63']] as const;
  for(const [mode,color] of roles){
   const markup=draw({...title,colorMode:mode,glowEnabled:true});
   expect(markup).toContain('data-text-color-mode="'+mode+'"');
   expect(markup).toContain('fill="'+color+'"');
  }
  const revised={...paletteBackground,figureColors:{...paletteBackground.figureColors,primary:'#22dd44'}};
  expect(draw({...title,colorMode:'primary'},revised)).toContain('fill="#22dd44"');
  expect(draw({...title,colorMode:'solid',color:'#f12345'},revised)).toContain('fill="#f12345"');
  expect(generateScene('color-link','16:9','2d-v5')).toEqual(scene);
 });
 it('uses the same gradient direction and source role colors, with no external assets',()=>{
  const markup=draw({...title,colorMode:'gradient',glowEnabled:true,glowColorMode:'text'});
  expect(markup).toContain('data-testid="text-gradient"');
  expect(markup).toContain('gradientUnits="userSpaceOnUse"');
  expect(markup).toMatch(/stop-color="#fa45ca"|stopColor="#fa45ca"/);
  expect(markup).toContain('fill="url(#text-');
  expect(markup).toContain('data-testid="text-glow"');
  expect(markup).not.toContain('https://');
 });
 it('validates new options, restores older text JSON and still permits v4',()=>{
  const old={...textOverlayDefaults} as Record<string,unknown>;
  for(const key of ['colorMode','glowEnabled','glowColorMode','glowColor','glowStrength','glowBlur'])delete old[key];
  const restored=parseSettings(JSON.stringify({...project,textOverlay:old}));
  expect(restored.textOverlay).toEqual(textOverlayDefaults);
  const updated={...title,colorMode:'gradient' as const,glowEnabled:true,
   glowColorMode:'custom' as const,glowColor:'#b3ddee',glowStrength:170,glowBlur:24};
  expect(parseSettings(settingsText({...project,textOverlay:updated})).textOverlay).toEqual(updated);
  expect(parseSettings(settingsText({...project,algorithmVersion:'2d-v4',textOverlay:updated})).algorithmVersion).toBe('2d-v4');
  for(const change of [{colorMode:'rainbow'},{glowEnabled:'yes'},{glowColorMode:'external'},
   {glowColor:'rebeccapurple'},{glowStrength:201},{glowStrength:-1},{glowBlur:41},
   {glowBlur:Number.POSITIVE_INFINITY}])expect(()=>validateTextOverlay({...updated,...change})).toThrow();
 });
});


describe('hollow outline-only neon titles',()=>{
 const scene=generateScene('hollow-title-seed','16:9','2d-v5');
 const backgroundWithInk={...background,figureColors:{primary:'#ee44ca',support:'#44ddcc',accent:'#ffbb55'}};
 const hollow:TextOverlaySettings={...textOverlayDefaults,enabled:true,text:'中抜き Neon',colorMode:'primary',
  fillMode:'transparent',strokeEnabled:true,strokeColorMode:'text',
  strokeWidth:9,glowEnabled:true,glowTarget:'outline',glowColorMode:'text',glowStrength:140};
 const render=(settings:TextOverlaySettings=hollow)=>renderToStaticMarkup(<Preview scene={scene} background={backgroundWithInk} textOverlay={settings}/>);
 it('keeps all text interiors transparent in the sharp text and in the glow mask',()=>{
  const markup=render();
  expect(markup).toContain('data-text-fill-mode="transparent"');
  expect(markup).toContain('data-text-glow-target="outline"');
  const text=markup.slice(markup.indexOf('data-testid="text-overlay"'));
  const glow=text.slice(text.indexOf('data-testid="text-glow"'),text.indexOf('</g>',text.indexOf('data-testid="text-glow"')));
  expect(glow).toContain('fill="none"');
  expect(glow).toContain('stroke="#ee44ca"');
  expect(glow).toContain('stroke-width="9"');
  expect(glow).not.toContain('fill="#ee44ca"');
  const normal=text.slice(text.indexOf('</g>',text.indexOf('data-testid="text-glow"'))+4);
  expect(normal).toContain('fill="none"');
  expect(normal).toContain('stroke="#ee44ca"');
  expect(scene).toEqual(generateScene('hollow-title-seed','16:9','2d-v5'));
 });
 it('supports linked gradient outline and custom-color outline-only glow',()=>{
  const gradient=render({...hollow,colorMode:'gradient'});
  expect(gradient).toContain('data-testid="text-gradient"');
  expect(gradient).toContain('fill="none"');
  expect(gradient).toContain('stroke="url(#text-');
  const custom=render({...hollow,glowColorMode:'custom',glowColor:'#aabbff',glowTarget:'both'});
  const glow=custom.slice(custom.indexOf('data-testid="text-glow"'),custom.indexOf('</g>',custom.indexOf('data-testid="text-glow"')));
  expect(glow).toContain('stroke="#aabbff"');
  expect(glow).toContain('fill="none"');
  expect(glow.match(/<text /g)?.length).toBe(1);
  expect(custom).toContain('stroke="#ee44ca"');
 });
 it('allows normal filled text to glow on fill, outline or both',()=>{
  const normal={...hollow,fillMode:'solid' as const};
  const fill=render({...normal,glowTarget:'fill'});
  const fillGlow=fill.slice(fill.indexOf('data-testid="text-glow"'),fill.indexOf('</g>',fill.indexOf('data-testid="text-glow"')));
  expect(fillGlow).toContain('fill="#ee44ca"');
  expect(fillGlow).toContain('stroke="none"');
  const both=render({...normal,glowTarget:'both'});
  const bothGlow=both.slice(both.indexOf('data-testid="text-glow"'),both.indexOf('</g>',both.indexOf('data-testid="text-glow"')));
  expect(bothGlow.match(/<text /g)?.length).toBe(2);
  const noOutline=render({...normal,glowTarget:'outline',strokeEnabled:false});
  expect(noOutline).not.toContain('data-testid="text-glow"');
  expect(render({...hollow,strokeEnabled:false,glowTarget:'fill'})).not.toContain('data-testid="text-glow"');
 });
 it('preserves existing project JSON and strictly validates new options',()=>{
  const old={...textOverlayDefaults} as Record<string,unknown>;
  for(const key of ['fillMode','strokeColorMode','glowTarget'])delete old[key];
  const parsed=parseSettings(JSON.stringify({...project,textOverlay:old}));
  expect(parsed.textOverlay).toEqual(textOverlayDefaults);
  const roundTrip=parseSettings(settingsText({...project,textOverlay:hollow}));
  expect(roundTrip.textOverlay).toEqual(hollow);
  expect(parseSettings(settingsText({...project,algorithmVersion:'2d-v4',textOverlay:hollow})).textOverlay).toEqual(hollow);
  for(const patch of [{fillMode:'url(https://example.com)'},{strokeColorMode:'rainbow'},
   {glowTarget:'text'},{fillMode:null},{glowTarget:100}]){
   expect(()=>validateTextOverlay({...hollow,...patch})).toThrow();
  }
 });
});
