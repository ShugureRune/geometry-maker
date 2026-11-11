/** Deterministic, lightweight routing for the near-field 3D motherboard.
 * Coordinates are in the floor plane (X/Y); CircuitWorld rotates them into X/Z.
 * The distant micro-circuit remains the existing fragment shader.
 */
import type {FloorGridSettings} from './floor-grid';

export type CircuitPoint=readonly [number,number];
export type CircuitTrack={start:CircuitPoint;end:CircuitPoint;kind:'trunk'|'branch'|'micro'};
export type CircuitPart={position:CircuitPoint;size:number;orientation:number;kind:'memory'|'smd'|'capacitor'};
export type CircuitChip={id:number;position:CircuitPoint;size:number;orientation:number};
export type CircuitRoute={chipId:number;points:readonly CircuitPoint[];length:number;offset:number};
export type CircuitLayout={
  coreHalf:number;
  chips:CircuitChip[];
  tracks:CircuitTrack[];
  microTracks:CircuitTrack[];
  parts:CircuitPart[];
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
  const empty:CircuitLayout={coreHalf:0,chips:[],tracks:[],microTracks:[],parts:[],routes:[],junctions:[]};
  if(!settings.enabled||settings.style!=='circuit'||!settings.circuitWorldEnabled||
    settings.circuitDensity<=0)return empty;
  const scale=unit(settings.spacing);
  // The processor now occupies a recognizable landmark instead of one small tile.
  const coreHalf=1.82*scale*settings.circuitCoreScale;
  // Instancing keeps twelve near-field packages affordable on mobile GPUs.
  const limit=Math.min(low?12:20,settings.circuitChipCount);
  const count=Math.max(0,Math.round(limit*Math.min(1,settings.circuitDensity/55)));
  const chips:CircuitChip[]=[],tracks:CircuitTrack[]=[],microTracks:CircuitTrack[]=[];
  const parts:CircuitPart[]=[],routes:CircuitRoute[]=[],junctions:CircuitPoint[]=[];
  const detail=Math.max(0,Math.min(1,settings.circuitDetail/100));
  const addMicro=(a:CircuitPoint,b:CircuitPoint)=>microTracks.push({start:a,end:b,kind:'micro'});

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
    // A bus of parallel hairline traces makes the main circuit feel multilayered.
    // The closer memory modules interrupt these lanes before the first junction.
    for(const side of [-1,1]){
      for(let lane=1;lane<=3;lane++){
        if(lane===3&&detail<.65)continue;
        const offset=side*(.19+.17*(lane-1))*scale;
        addMicro(transform(arm,coreHalf+.16*scale,offset),
          transform(arm,coreHalf+(1.35+maxRing*.82)*scale,offset));
      }
    }
    // Close-up memory banks sit around (not on top of) the processor.
    if(detail>.12)for(const side of [-1,1]){
      parts.push({kind:'memory',position:transform(arm,coreHalf+1.07*scale,side*.87*scale),
        size:.91*scale,orientation:horizontal(arm)?0:Math.PI/2});
    }
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
      // Four ultra-fine parallel copper lines on a branch, visible in close-ups.
      if(detail>.35){
        const laneStart=transform(arm,branch+.18*scale,side*.15*scale);
        const laneEnd=transform(arm,branch+.18*scale,cross-side*.15*scale);
        addMicro(laneStart,laneEnd);
        if(detail>.7){
          addMicro(transform(arm,branch-.17*scale,side*.15*scale),
            transform(arm,branch-.17*scale,cross-side*.15*scale));
        }
      }
      const points=[start,junction,corner,chipEdge];
      chips.push({id,position,size:chipSize,orientation:horizontal(arm)?0:Math.PI/2});
      routes.push({chipId:id,points,length:circuitRouteLength(points),offset:(id*1.37+arm*.4)*scale});
      junctions.push(junction,corner);
      const size=chipSize;
      // Passive devices and capacitors cluster beside the chips, rather than
      // appearing in an evenly spaced procedural grid.
      if((id*17+7)%29<detail*29){
        parts.push({kind:'smd',position:[
          position[0]+size*(horizontal(arm)?.05:.79),
          position[1]+size*(horizontal(arm)?.79:.05),
        ],size:.21*scale,orientation:chip.orientation});
        parts.push({kind:'smd',position:[
          position[0]-size*(horizontal(arm)?.05:.79),
          position[1]-size*(horizontal(arm)?.83:.05),
        ],size:.16*scale,orientation:chip.orientation});
      }
      if(detail>.42&&id%3===0){
        parts.push({kind:'capacitor',position:[
          position[0]+size*(horizontal(arm)?.87:-.63),
          position[1]+size*(horizontal(arm)?-.68:.87),
        ],size:.18*scale,orientation:0});
      }
    }
  }
  return {coreHalf,chips,tracks,microTracks,parts,routes,junctions};
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
