import {seededRandom} from '../scene';

/** Cosmic-web VOID MODE: hundreds to a few thousand geometric solids follow
 * 3D filaments around genuinely empty volumes. Positions are deterministic;
 * GPU instancing batches the actual 3D solids into just three draw calls.
 */
export const VOID_LOW_BASE_COUNT=400;
export const VOID_HIGH_BASE_COUNT=1400;
export const VOID_LOW_MAX_COUNT=800;
export const VOID_HIGH_MAX_COUNT=2800;
export const VOID_KNOT_COUNT=56;
export const VOID_EMPTY_CENTER:[number,number,number]=[0,0,-115];
export const VOID_EMPTY_RADII:[number,number,number]=[23,19,35];

export function voidFigureCount(density:number,low:boolean):number{
  if(!Number.isFinite(density))return 0;
  const safe=Math.max(0,Math.min(200,density));
  const base=low?VOID_LOW_BASE_COUNT:VOID_HIGH_BASE_COUNT;
  return Math.min(low?VOID_LOW_MAX_COUNT:VOID_HIGH_MAX_COUNT,
    Math.round(base*safe/100));
}
export type VoidField={
  count:number;
  /** x, y, z, radius per figure; shape types stored separately. */
  figures:Float32Array;
  shapes:Uint8Array;
  colorMix:Float32Array;
  /** Individual physical segments of the cosmic filaments. */
  filaments:Float32Array;
  /** 3D junctions; primary figures are moved onto these knots. */
  knots:Float32Array;
  shapeCounts:[number,number,number];
};
type Point=[number,number,number];
type Strand={a:Point;b:Point;bend:Point};
const distance=(a:Point,b:Point)=>Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2]);
const inVoid=(p:Point)=>{
  const dx=(p[0]-VOID_EMPTY_CENTER[0])/VOID_EMPTY_RADII[0];
  const dy=(p[1]-VOID_EMPTY_CENTER[1])/VOID_EMPTY_RADII[1];
  const dz=(p[2]-VOID_EMPTY_CENTER[2])/VOID_EMPTY_RADII[2];
  return dx*dx+dy*dy+dz*dz<1;
};
const onStrand=(link:Strand,t:number):Point=>{
  const arc=Math.sin(Math.PI*t);
  return [
    link.a[0]+(link.b[0]-link.a[0])*t+link.bend[0]*arc,
    link.a[1]+(link.b[1]-link.a[1])*t+link.bend[1]*arc,
    link.a[2]+(link.b[2]-link.a[2])*t+link.bend[2]*arc,
  ];
};

/** These filaments are a sparse 3D graph, *not* a uniform point cloud.
 * Each point sits close to a graph edge or a knot, leaving conspicuous empty
 * regions between threads. A fixed central ellipsoid is deliberately vacant.
 */
export function generateVoidField(seed:string,count:number):VoidField{
  const safeCount=Number.isFinite(count)?Math.max(0,Math.min(VOID_HIGH_MAX_COUNT,Math.floor(count))):0;
  const empty:VoidField={count:0,figures:new Float32Array(0),
    shapes:new Uint8Array(0),colorMix:new Float32Array(0),
    filaments:new Float32Array(0),knots:new Float32Array(0),shapeCounts:[0,0,0]};
  if(safeCount===0)return empty;
  const random=seededRandom('cosmic-void-v1:'+seed);
  const knots:Point[]=[];
  // A few dozen separated knots span a volume much deeper than the main 3D
  // composition. Even at maximum density the central region remains empty.
  for(let i=0;i<VOID_KNOT_COUNT;i++){
    let p:Point=[0,0,-150];
    for(let attempt=0;attempt<100;attempt++){
      p=[(random()-.5)*165,(random()-.5)*116,-35-random()*200];
      if(!inVoid(p)&&knots.every(previous=>distance(previous,p)>17))break;
    }
    knots.push(p);
  }
  const strands:Strand[]=[];
  const seen=new Set<string>();
  for(let i=0;i<knots.length;i++){
    const closest=knots.map((p,j)=>({index:j,dist:distance(knots[i],p)}))
      .filter(pair=>pair.index!==i)
      .sort((a,b)=>a.dist-b.dist||a.index-b.index);
    for(const candidate of closest.slice(0,3)){
      if(candidate.dist>100&&candidate!==closest[0])continue;
      const j=candidate.index;
      const key=Math.min(i,j)+':'+Math.max(i,j);
      if(seen.has(key))continue;
      seen.add(key);
      const delta=[knots[j][0]-knots[i][0],knots[j][1]-knots[i][1],knots[j][2]-knots[i][2]];
      const normal=Math.hypot(delta[0],delta[1])||1;
      const bendMagnitude=2+random()*6;
      const bend:Point=[
        -delta[1]/normal*bendMagnitude,
        delta[0]/normal*bendMagnitude,
        (random()-.5)*7,
      ];
      strands.push({a:knots[i],b:knots[j],bend});
    }
  }
  const lines:number[]=[];
  for(const strand of strands)for(let i=0;i<12;i++){
    const start=onStrand(strand,i/12),end=onStrand(strand,(i+1)/12);
    if(inVoid(start)||inVoid(end)||inVoid(onStrand(strand,(i+.5)/12)))continue;
    lines.push(...start,...end);
  }
  const figures=new Float32Array(safeCount*4);
  const shapes=new Uint8Array(safeCount);
  const colorMix=new Float32Array(safeCount);
  const shapeCounts:[number,number,number]=[0,0,0];
  for(let i=0;i<safeCount;i++){
    let p:Point=[0,0,-150];
    let radius=.2;
    // Place 84% of figures along filament threads and the rest near knots.
    // Keep retries bounded and deterministic without thousands of React
    // components or allocating geometry for every figure.
    for(let attempt=0;attempt<36;attempt++){
      const nearKnot=random()<.16;
      const knot=knots[Math.floor(random()*knots.length)];
      const strand=strands[Math.floor(random()*strands.length)];
      const center=nearKnot?knot:onStrand(strand,random());
      const azimuth=random()*Math.PI*2;
      const cosTheta=2*random()-1;
      const spread=(nearKnot?9.5:3.4)*Math.pow(random(),.6);
      const xy=spread*Math.sqrt(1-cosTheta*cosTheta);
      p=[center[0]+xy*Math.cos(azimuth),
        center[1]+xy*Math.sin(azimuth),center[2]+spread*cosTheta];
      if(!inVoid(p))break;
    }
    if(inVoid(p)){
      // Reject any accidental final retry inside the central void.
      p=[p[0]+48,p[1]+36,p[2]];
    }
    radius=.13+Math.pow(random(),3)*.55;
    const type=i%3;
    const offset=i*4;
    figures.set([p[0],p[1],p[2],radius],offset);
    shapes[i]=type;
    colorMix[i]=Math.min(1,.08+random()*.92);
    shapeCounts[type]++;
  }
  return {count:safeCount,figures,shapes,colorMix,
    filaments:new Float32Array(lines),knots:new Float32Array(knots.flat()),shapeCounts};
}
