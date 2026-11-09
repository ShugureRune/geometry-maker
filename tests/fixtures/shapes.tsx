// Development-only renderer fixture, excluded from the production Vite entry.
import { createRoot } from 'react-dom/client';
import { Preview } from '../../src/Preview';
import { generateScene, NEW_SHAPE_KINDS, type Shape } from '../../src/scene';
const base=generateScene('atlas','4:5');
const shapes:Shape[]=NEW_SHAPE_KINDS.map((kind,i)=>({
 id:`atlas-${kind}`,kind,role:'hero',layer:'midground',group:`atlas-${i}`,
 x:200+(i%4)*400,y:150+Math.floor(i/4)*300,size:90,rotation:0,tone:'violet',
 opacity:.95,filled:['trapezoid','parallelogram','star','chevron','sector'].includes(kind),strokeWidth:2.5,fillOpacity:.3,
 glow:false,bleed:false,rings:3,
}));
const scene={...base,width:1600,height:1200,shapes};
const root=createRoot(document.getElementById('atlas')!);
function render(progress=1){root.render(<Preview scene={scene} background={{mode:'solid',solid:'#111526',colors:['#111526','#111526','#111526'],angle:0}} growth={Object.fromEntries(shapes.map(s=>[s.id,progress]))}/>);}
Object.assign(window,{atlasProgress:render});render();
