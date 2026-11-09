import {createRoot} from 'react-dom/client';
import {Preview} from '../../src/Preview';
import {generateScene,type Shape} from '../../src/scene';
const base=generateScene('fill','1:1');
const kinds:Shape['kind'][]=['triangle','diamond','rectangle','hexagon','band','trapezoid','parallelogram','pentagon','star'];
const shapes:Shape[]=kinds.map((kind,i)=>({id:`fill-${i}`,group:`fill-${i}`,kind,role:'hero',layer:'midground',x:200+i%3*400,y:150+Math.floor(i/3)*300,size:100,rotation:0,opacity:.8,filled:true,fillOpacity:.25+i*.025,strokeWidth:2,tone:'violet',glow:false,bleed:false}));
const root=createRoot(document.getElementById('atlas')!);
Object.assign(window,{fillFrame:(progress:number,glowIntensity:number)=>root.render(<Preview scene={{...base,width:1200,height:900,shapes}} background={{mode:'solid',solid:'#111526',colors:['#111526','#111526','#111526'],angle:0,glowIntensity}} growth={Object.fromEntries(shapes.map(s=>[s.id,progress]))}/>)});
(window as unknown as {fillFrame:(p:number,g:number)=>void}).fillFrame(1,0);
