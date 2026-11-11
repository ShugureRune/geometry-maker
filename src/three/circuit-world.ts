/** Deterministic, lightweight routing for the near-field 3D motherboard.
 * Coordinates are in the floor plane (X/Y); CircuitWorld rotates them into X/Z.
 * The distant micro-circuit remains the existing fragment shader.
 */
import type {FloorGridSettings} from './floor-grid';

export type CircuitPoint=readonly [number,number];
export type CircuitTrack={start:CircuitPoint;end:CircuitPoint;kind:'trunk'|'branch'};
export type CircuitChip={id:number;position:CircuitPoint;size:number;orientation:number};
export type CircuitRoute={chipId:number;points:readonly CircuitPoint[];length:number;offset:number};
export type CircuitLayout={
  coreHalf:number;
  chips:CircuitChip[];
  tracks:CircuitTrack[];
  routes:CircuitRoute[];
  junctions:CircuitPoint[];
};
export type CircuitSignal={position:CircuitPoint;visible:boolean;activation:number};

const distance=(a:CircuitPoint,b:CircuitPoint)=>Math.hypot(b[0]-a[0],b[1]-a[1]);
const unit=(spacing:number)=>Math.max(.65,Math.min(1.8,spacing/2.5));
export const circuitRouteLength=(points:readonly CircuitPoint[]):number=>
  points.slice(1).reduce((sum,point,i)=>sum+distance(points[i],point),0);

/** Cardinal trunks share copper. Branches emerge at distinct junctions instead
 * of drawing identical paths over one another (which used to cause overbright lines).
 * This layout intentionally stays stable when the figure seed changes.
 */
export function makeCircuitLayout(settings:FloorGridSettings,low=false):CircuitLayout{
  const empty:CircuitLayout={coreHalf:0,chips:[],tracks:[],routes:[],junctions:[]};
  if(!settings.enabled||settings.style!=='circuit'||!settings.circuitWorldEnabled||
    settings.circuitDensity<=0)return empty;
  const scale=unit(settings.spacing);
  const coreHalf=1.04*scale*settings.circuitCoreScale;
  const limit=Math.min(low?8:20,settings.circuitChipCount);
  const count=Math.max(0,Math.round(limit*Math.min(1,settings.circuitDensity/55)));
  const chips:CircuitChip[]=[],tracks:CircuitTrack[]=[],routes:CircuitRoute[]=[],junctions:CircuitPoint[]=[];
  const sign=(arm:number)=>arm===0||arm===2?1:-1;
  const horizontal=(arm:number)=>arm<2;
  const transform=(arm:number,along:number,across:number):CircuitPoint=>
    horizontal(arm)?[sign(arm)*along,across]:[across,sign(arm)*along];
  for(let arm=0;arm<4;arm++){
    const indices=Array.from({length:count},(_,i)=>i).filter(i=>i%4===arm);
    if(!indices.length)continue;
    const maxRing=Math.floor((indices[indices.length-1])/4);
    const start=transform(arm,coreHalf+.10*scale,0);
    const end=transform(arm,coreHalf+(1.42+maxRing*.82)*scale,0);
    tracks.push({start,end,kind:'trunk'});
    for(const id of indices){
      const ring=Math.floor(id/4);
      const side=ring%2===0?1:-1;
      const chipSize=scale*(.76+.11*(id%3));
      const branch=coreHalf+(1.42+ring*.82)*scale;
      const cross=side*(1.9+Math.floor(ring/2)*1.55)*scale;
      const reach=coreHalf+(3.00+ring*1.42)*scale;
      const position=transform(arm,reach,cross);
      const junction=transform(arm,branch,0);
      const corner=transform(arm,branch,cross);
      const chipEdge=transform(arm,reach-chipSize*.55,cross);
      tracks.push({start:junction,end:corner,kind:'branch'});
      tracks.push({start:corner,end:chipEdge,kind:'branch'});
      const points=[start,junction,corner,chipEdge];
      chips.push({id,position,size:chipSize,orientation:horizontal(arm)?0:Math.PI/2});
      routes.push({chipId:id,points,length:circuitRouteLength(points),offset:(id*1.37+arm*.4)*scale});
      junctions.push(junction,corner);
    }
  }
  return {coreHalf,chips,tracks,routes,junctions};
}
export function circuitPointAt(points:readonly CircuitPoint[],travel:number):CircuitPoint{
  if(points.length===0)return [0,0];
  let remaining=Math.max(0,travel);
  for(let i=1;i<points.length;i++){
    const start=points[i-1],end=points[i],len=distance(start,end);
    if(len<=0)continue;
    if(remaining<=len){
      const t=remaining/len;
      return [start[0]+(end[0]-start[0])*t,start[1]+(end[1]-start[1])*t];
    }
    remaining-=len;
  }
  return points[points.length-1];
}
/** Sample without advancing mutable clocks; PNG and JSON restores get exactly the
 * same positions and chip response at the same elapsed 3D time. */
export function circuitSignalAt(route:CircuitRoute,seconds:number,speed:number):CircuitSignal{
  if(speed<=0||!Number.isFinite(seconds))return {position:route.points[0]??[0,0],visible:false,activation:0};
  const length=route.length,cycle=length+1.45;
  const raw=seconds*speed*2.2+route.offset;
  const travel=((raw%cycle)+cycle)%cycle;
  const activation=travel>length?Math.sin(Math.PI*Math.min(1,(travel-length)/1.25)):0;
  return {
    position:circuitPointAt(route.points,Math.min(length,travel)),
    visible:travel<=length,
    activation:Math.max(0,activation),
  };
}
