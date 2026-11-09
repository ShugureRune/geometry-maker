import {createRoot} from 'react-dom/client';
import {Preview} from '../../src/Preview';
import {generateScene,type Shape} from '../../src/scene';
const base=generateScene('stroke-test','16:9');
const shapes:Shape[]=['hero','support','decoration'].map((role,i)=>({id:`stroke-${role}`,kind:'line',role:role as Shape['role'],layer:'midground',x:200,y:200+i*250,size:1000,rotation:0,opacity:1,filled:false,fillOpacity:0,strokeWidth:4,tone:'neutral',glow:false,bleed:false,group:'test'}));
createRoot(document.getElementById('atlas')!).render(<Preview scene={{...base,shapes}} background={{mode:'solid',solid:'#000000',colors:['#000000','#000000','#000000'],angle:0,glowIntensity:0,figureColors:{primary:'#ffffff',support:'#ffffff',accent:'#ffffff'}}}/>);
