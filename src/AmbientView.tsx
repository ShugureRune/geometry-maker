import { useMemo } from 'react';
import { Preview } from './Preview';
import { generateScene, RATIOS } from './scene';
import { densityCandidates, visibleScene } from './density';
import { schedule, progressAt } from './animation';
import { coloredBackground, reseedColors } from './colors';
import { ambientClock, ambientEnvelope, ambientSeed, type AmbientInput } from './ambient';
function Tile({input,index,progress,phase,opacity=1,scale=1}:{input:AmbientInput;index:number;progress:number;phase:number;opacity?:number;scale?:number}){
 const seed=ambientSeed(input.seed,index),s=input.settings;
 const generated=useMemo(()=>{const base=generateScene(seed,input.ratio,input.version);const candidates=densityCandidates(base,seed);return{scene:visibleScene(base,candidates,input.density),cues:schedule(candidates,seed,input.version)};},[seed,input.ratio,input.version,input.density]);
 const background=useMemo(()=>input.colors&&index!==0?coloredBackground(input.background,reseedColors(input.colors,seed)):input.background,[input.background,input.colors,seed]);
 const float=s.mode==='float'||s.mode==='combined';
 // A single transform moves every connected shape together, preserving junctions.
 const byId=new Map(generated.scene.shapes.map(shape=>[shape.id,shape]));
 const motion:Record<string,string>={};
 for(const shape of generated.scene.shapes){let root=shape;let depth=0;while(root.parent&&byId.has(root.parent)&&depth++<128)root=byId.get(root.parent)!;
 const rate=root.layer==='background'?1:root.layer==='midground'?2:3;
 const wave=phase*Math.PI*2*rate,unit=Math.min(generated.scene.width,generated.scene.height);
 motion[shape.id]=float?`translate(${Math.sin(wave)*s.floatAmount*unit*.004} ${(Math.cos(wave)-1)*s.floatAmount*unit*.003}) translate(${generated.scene.width/2} ${generated.scene.height/2}) rotate(${Math.sin(wave*Math.round(s.rotationSpeed))*s.rotation}) scale(${1+(1-Math.cos(wave))*.003*s.floatAmount}) translate(${-generated.scene.width/2} ${-generated.scene.height/2})`:'';
 motion[shape.id]+=` translate(${generated.scene.width*(1-scale)/2} ${generated.scene.height*(1-scale)/2}) scale(${scale})`;
 }
 const transform='';

 return <g opacity={opacity} transform={transform}><Preview scene={generated.scene} background={background} motion={motion} growth={progress>=1?undefined:Object.fromEntries(generated.scene.shapes.map(shape=>[shape.id,progressAt(generated.cues[shape.id],progress,input.animation.easingType)]))}/></g>;
}
export function AmbientView({input,seconds}:{input:AmbientInput;seconds:number}){
 const s=input.settings,c=ambientClock(s,seconds),[width,height]=RATIOS[input.ratio];
 const cycleGrowth=s.mode==='growth'||s.mode==='combined';
 const envelope=ambientEnvelope(s,seconds,input.animation.animationDuration,input.animation.playbackSpeed);
 const fade=envelope.fade,progress=envelope.progress;
 const exit=cycleGrowth||s.loop==='evolving'?fade:0;
 const nextIndex=s.loop==='perfect'?0:s.autoSeed?c.index+1:0;

 const scroll=s.mode==='scroll';
 const fraction=(c.phase*Math.max(1,Math.round(s.scrollSpeed)))%1;
 return <svg data-testid="ambient-preview" className="artwork" viewBox={`0 0 ${width} ${height}`} xmlns="http://www.w3.org/2000/svg" overflow="hidden" aria-label="自動待機画面">
  {scroll?<>
   {[{index:c.index,opacity:1},{index:nextIndex,opacity:s.loop==='evolving'?fade:0}].filter(layer=>layer.opacity>0).map((layer,k)=><g key={k} opacity={layer.opacity}>{(s.direction==='vertical'?[0]:[0,1,2]).flatMap(x=>(s.direction==='horizontal'?[0]:[0,1,2]).map(y=><g key={`${x}:${y}`} transform={`translate(${(x-(s.direction!=='vertical'?fraction*2:0))*width} ${(y-(s.direction!=='horizontal'?fraction*2:0))*height})`}><g transform={`translate(${Math.abs(x)%2?width:0} ${Math.abs(y)%2?height:0}) scale(${Math.abs(x)%2?-1:1} ${Math.abs(y)%2?-1:1})`}><Tile input={input} index={layer.index} progress={1} phase={0}/></g></g>))}</g>)}
  </>:<>
   <Tile input={input} index={c.index} progress={s.transitionType==='reverse'&&exit>0?1-exit:progress} phase={c.phase} opacity={1} scale={s.transitionType==='shrink'?1-exit*.08:1}/>
   {exit>0&&<Tile input={input} index={nextIndex} progress={cycleGrowth?0:1} phase={0} opacity={exit}/>}
  </>}
 </svg>;
}
