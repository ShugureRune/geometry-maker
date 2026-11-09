import {it,expect} from 'vitest';
import {generateScene,type Ratio} from './scene';
it('keeps two main figures independent without removing their own circuits and decorations',()=>{
 let pairs=0;
 for(let i=0;i<120;i++)for(const ratio of ['16:9','9:16','1:1'] as Ratio[]){
  const scene=generateScene(`independent-${i}`,ratio),heroes=scene.shapes.filter(s=>s.role==='hero');
  expect(scene.shapes.some(s=>s.id==='anchor-link')).toBe(false);
  if(heroes.length===2){pairs++;for(const h of heroes)expect(scene.shapes.some(s=>s.parent===h.id)).toBe(true);}
 }
 expect(pairs).toBeGreaterThan(10);
},30000);
