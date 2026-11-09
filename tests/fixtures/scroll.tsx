import {flushSync} from 'react-dom';
import {createRoot} from 'react-dom/client';
import {AmbientView} from '../../src/AmbientView';
import {ambientDefaults,type AmbientInput} from '../../src/ambient';
import {defaults} from '../../src/animation';
import {createVideoRenderer} from '../../src/video-frame';
import {exportVideo} from '../../src/video';
import {generateScene} from '../../src/scene';
import {densityCandidates} from '../../src/density';
import {createScrollWorld} from '../../src/scroll-world';
const root=createRoot(document.getElementById('atlas')!);
let camera:'parent'|'per-chunk'='parent';
let input:AmbientInput={seed:'scroll-gallery',version:'2d-v5',ratio:'16:9',density:50,background:{mode:'gradient',solid:'#101020',colors:['#101020','#201830','#122838'],angle:135,glowIntensity:100},animation:{...defaults,animationEnabled:true,animationDuration:2},settings:{...ambientDefaults,enabled:true,mode:'scroll',direction:'horizontal',duration:14}};
function artwork(){const scene=generateScene(input.seed,input.ratio,input.version);return{scene,candidates:densityCandidates(scene,input.seed),seed:input.seed,background:input.background,animation:input.animation,ambient:input};}
Object.assign(window,{
 scrollFrame:(t:number,patch:Partial<AmbientInput>={},mode:'parent'|'per-chunk'='parent')=>{camera=mode;input={...input,...patch,settings:{...input.settings,...patch.settings}};root.render(<AmbientView input={input} seconds={t} scrollCamera={camera}/>);},
 scrollBenchmark:async(mode:'parent'|'per-chunk')=>{const samples:number[]=[];for(let i=0;i<140;i++){await new Promise(requestAnimationFrame);const start=performance.now();flushSync(()=>root.render(<AmbientView input={input} seconds={10+i/30} scrollCamera={mode}/>));if(i>=20)samples.push(performance.now()-start);}samples.sort((a,b)=>a-b);return{mode,mean:samples.reduce((a,b)=>a+b)/samples.length,p95:samples[Math.floor(samples.length*.95)]};},
 scrollSvg:(t:number)=>createVideoRenderer(artwork())(t,800,450),
 scrollCache:()=>{const world=createScrollWorld(input);for(let t=0;t<=3600;t+=60)world.frame(t,input.settings);return world.cache.size;},
 scrollExport:async(format:'webm'|'mp4')=>{const blob=await exportVideo(artwork(),{exportVideoFormat:format,exportVideoWidth:256,exportVideoHeight:256,exportVideoFps:24},new AbortController().signal,()=>{});const bytes=new Uint8Array(await blob.arrayBuffer());let text='';for(const byte of bytes)text+=String.fromCharCode(byte);return btoa(text);},
});
root.render(<AmbientView input={input} seconds={0}/>);
