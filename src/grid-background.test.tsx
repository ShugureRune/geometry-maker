import {describe,expect,it} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {GridBackground} from './GridBackground';
import {gridAnimationDefaults,gridAnimationFrame,gridAnimationSeconds,gridBackgroundDefaults,validateGridBackground} from './grid-background';
import {Preview} from './Preview';
import {generateScene,type Background} from './scene';

const base: Background={mode:'solid',solid:'#111526',colors:['#101b2d','#241938','#102a30'],angle:135};
const make=(grid:Partial<typeof gridBackgroundDefaults>={})=>({...gridBackgroundDefaults,...grid,enabled:true});
describe('2D SVG grid background',()=>{
  it('is off by default, and absent from transparent geometry tiles',()=>{
    const scene=generateScene('grid-test','16:9');
    expect(renderToStaticMarkup(<Preview scene={scene} background={base}/>)).not.toContain('data-testid="grid-background"');
    expect(renderToStaticMarkup(<Preview scene={scene} background={{...base,grid:make()}} transparent/>)).not.toContain('data-testid="grid-background"');
  });
  it('draws lines between background and shapes with a compact repeated pattern',()=>{
    const scene=generateScene('grid-test','16:9');
    const html=renderToStaticMarkup(<Preview scene={scene} background={{...base,grid:make({type:'line',spacing:64,rotation:30,opacity:42})}}/>);
    expect(html).toContain('data-testid="grid-background"');
    expect(html).toContain('data-grid-type="line"');
    expect(html).toContain('patternUnits="userSpaceOnUse"');
    expect(html).toContain('patternTransform="rotate(30 ');
    expect(html).toContain('width="64" height="64"');
    expect(html).toContain('opacity="0.42"');
    expect(html.indexOf('data-testid="background"')).toBeLessThan(html.indexOf('data-testid="grid-background"'));
    expect(html.indexOf('data-testid="grid-background"')).toBeLessThan(html.indexOf('data-testid="shapes"'));
  });
  it('draws a rotated dot pattern with custom color and optional glow',()=>{
    const grid=make({type:'dot',thickness:2,colorMode:'custom',color:'#aabbcc',glow:60});
    const html=renderToStaticMarkup(<svg><GridBackground background={{...base,grid}} width={1920} height={1080}/></svg>);
    expect(html).toContain('data-grid-type="dot"');
    expect(html).toContain('cx="0" cy="0" r="2"');
    expect(html).toContain('fill="#aabbcc"');
    expect(html).toContain('feGaussianBlur');
  });
  it('animates scroll, rotation and pulse deterministically by explicit timestamp',()=>{
    const scroll=make({spacing:80,animation:{...gridAnimationDefaults,enabled:true,duration:8}});
    expect(gridAnimationFrame(scroll,0).moveX).toBe(0);
    expect(gridAnimationFrame(scroll,2).moveX).toBe(20);
    expect(gridAnimationFrame(scroll,8).moveX).toBe(0);
    expect(gridAnimationFrame({...scroll,animation:{...scroll.animation!,direction:'diagonal'}},2)).toMatchObject({moveX:20,moveY:20});
    expect(gridAnimationFrame({...scroll,animation:{...scroll.animation!,direction:'up'}},2)).toMatchObject({moveX:0,moveY:-20});
    const rotate=make({rotation:30,animation:{...gridAnimationDefaults,enabled:true,mode:'rotate',duration:8,reverse:true}});
    expect(gridAnimationFrame(rotate,4).rotation).toBe(-150);
    expect(gridAnimationFrame(rotate,8).rotation).toBe(30);
    const pulse=make({animation:{...gridAnimationDefaults,enabled:true,mode:'pulse'}});
    expect(gridAnimationFrame(pulse,0).opacityMultiplier).toBeCloseTo(.35);
    expect(gridAnimationFrame(pulse,4).opacityMultiplier).toBeCloseTo(1);
    expect(gridAnimationFrame(pulse,8).opacityMultiplier).toBeCloseTo(.35);
    expect(gridAnimationSeconds(scroll)).toBe(8);
    expect(gridAnimationSeconds(make())).toBe(0);
  });
  it('keeps static grids unchanged and renders SVG patterns at supplied timestamps',()=>{
    const staticGrid=make({animation:{...gridAnimationDefaults}});
    expect(gridAnimationFrame(staticGrid,3).moveX).toBe(0);
    const scene=generateScene('grid-motion','16:9');
    const moving=make({type:'dot',spacing:80,animation:{...gridAnimationDefaults,enabled:true,duration:8}});
    const first=renderToStaticMarkup(<Preview scene={scene} background={{...base,grid:moving}} gridSeconds={0}/>);
    const later=renderToStaticMarkup(<Preview scene={scene} background={{...base,grid:moving}} gridSeconds={2}/>);
    expect(first).toContain('data-grid-motion="scroll"');
    expect(first).toContain('patternTransform="rotate(0 960 540)"');
    expect(later).toContain('patternTransform="rotate(0 960 540) translate(20 0)"');
    expect(later).toContain('data-grid-motion="scroll"');
  });
  it('validates user data without changing the input',()=>{
    const grid=make({spacing:120,opacity:7});
    expect(validateGridBackground(grid)).toEqual(grid);
    for(const patch of [{spacing:0},{spacing:10000},{opacity:-1},{glow:101},{rotation:360},{color:'red'},{type:'perspective'},{enabled:'yes'},{thickness:Infinity}]){
      expect(()=>validateGridBackground({...grid,...patch})).toThrow();
    }
    expect(()=>validateGridBackground(null)).toThrow();
  });
});
