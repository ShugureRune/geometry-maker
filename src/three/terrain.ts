import type {SkyKind} from './sky-settings';

/** Settings are optional in JSON so old 3D projects keep loading unchanged. */
export type TerrainSettings={
  relief:number;
  detail:number;
  flatCenter:boolean;
};
export const terrainDefaults:TerrainSettings={relief:100,detail:100,flatCenter:true};

export function validateTerrain(value:unknown):TerrainSettings{
  if(!value||typeof value!=='object'||Array.isArray(value))
    throw new Error('3D地形設定が不正です。');
  const t=value as Record<string,unknown>;
  for(const key of ['relief','detail'] as const){
    const n=t[key];
    if(typeof n!=='number'||!Number.isFinite(n)||n<0||n>200)
      throw new Error('3D地形の'+key+'は0～200%で指定してください。');
  }
  if(typeof t.flatCenter!=='boolean')
    throw new Error('地形の中央を平坦にする設定が不正です。');
  return {relief:t.relief as number,detail:t.detail as number,flatCenter:t.flatCenter};
}
export const TERRAIN_KINDS=['endless-desert','foggy-grassland','forest-edge','alpine-peaks','grand-canyon','volcanic-field','glacier'] as const;
export function hasTerrainRelief(kind:SkyKind):boolean{
  return TERRAIN_KINDS.some(candidate=>candidate===kind);
}
/** Preserve close-up 3D detail while extending outer terrain from 350u to 1050u.
 * Uniformly tripling the existing plane would make nearby dunes faceted;
 * this smooth stretch maintains the old central vertex spacing and pushes
 * most extra world coverage into the distant ring. */
export const OUTDOOR_SURFACE_HALF_EXTENT=1050;
export function terrainStretchCoordinate(x:number):number{
  const abs=Math.abs(x);
  if(abs<=80)return x;
  const t=Math.min(1,(abs-80)/270);
  return Math.sign(x)*(abs+700*t*t);
}
/** 700u extent, one 3D draw call; low stays below 8k vertices. */
export function terrainSegments(low:boolean):number{return low?88:188;}
export function terrainCenterMask(radius:number,flatCenter:boolean):number{
  if(!flatCenter)return 1;
  const t=Math.max(0,Math.min(1,(radius-13)/23));
  return t*t*(3-2*t);
}
function hash2(x:number,z:number,seed:number):number{
  let h=Math.imul(x|0,374761393)+Math.imul(z|0,668265263);
  h=Math.imul(h^(seed|0),1274126177);
  h^=h>>>13; h=Math.imul(h,2246822519);
  return ((h^(h>>>16))>>>0)/4294967295;
}
/** Deterministic smooth value noise for terrain AND its natural-object positions. */
function noise2(x:number,z:number,seed:number):number{
  const ix=Math.floor(x),iz=Math.floor(z);
  let a=x-ix,b=z-iz;
  a=a*a*(3-2*a);b=b*b*(3-2*b);
  const x0=hash2(ix,iz,seed),x1=hash2(ix+1,iz,seed);
  const z0=hash2(ix,iz+1,seed),z1=hash2(ix+1,iz+1,seed);
  return (x0+(x1-x0)*a)*(1-b)+(z0+(z1-z0)*a)*b;
}
/** World x/z offset relative to the following floor-grid look-at target.
 * The center defaults to a protected flat disk so existing figures stay clear.
 * Seed is the existing stable 0..1 sky seed, not frame-time randomness.
 */
export function terrainHeightAt(
  kind:SkyKind,x:number,z:number,
  terrain:TerrainSettings=terrainDefaults,seed=0,
):number{
  if(!hasTerrainRelief(kind)||terrain.relief===0)return 0;
  const mask=terrainCenterMask(Math.hypot(x,z),terrain.flatCenter);
  if(mask===0)return 0;
  const hashSeed=Math.floor(seed*4294967295)>>>0;
  const offsetX=(hashSeed%997)/9,offsetZ=((hashSeed>>>9)%991)/9;
  const base=noise2(x*.020+offsetX,z*.020+offsetZ,hashSeed);
  const detail=Math.max(0,terrain.detail/100);
  const small=noise2(x*(.07+.05*detail)+offsetZ,z*(.07+.05*detail)+offsetX,hashSeed^0x9e3779b9)-.5;
  let elevation=0;
  if(kind==='endless-desert'){
    const warp=noise2(x*.012+offsetZ,z*.013+offsetX,hashSeed^0x85ebca6b);
    const dune=Math.pow(.5+.5*Math.sin(x*.055+z*.026+warp*3.4),1.8);
    elevation=dune*11.5+(base-.55)*11.0+small*(1.0+2.0*detail)-3.5;
  }else if(kind==='foggy-grassland'){
    elevation=(base-.47)*7.6+small*(.5+2.4*detail);
  }else if(kind==='forest-edge'){
    elevation=(base-.46)*5.2+small*(.3+1.8*detail);
  }else if(kind==='alpine-peaks'){
    const ridges=Math.pow(1-Math.abs(base*2-1),2.7);
    const foot=noise2(x*.008+offsetZ,z*.008+offsetX,hashSeed^0xa5b3c5d7);
    elevation=12+30*ridges*foot+small*(3+7*detail);
  }else if(kind==='grand-canyon'){
    // A long snaking riverbed: the sides rise into plateau mesas.
    const centerline=12*Math.sin(z*.018+base*1.4);
    const width=Math.abs(x-centerline);
    const walls=Math.min(1,Math.max(0,(width-16)/55));
    const wall=walls*walls*(3-2*walls);
    elevation=wall*(22+base*14)+small*(1+3*detail)-12;
  }else if(kind==='volcanic-field'){
    const r=Math.hypot(x-76*Math.sin(offsetX),z-86*Math.cos(offsetZ));
    const cone=Math.max(0,1-r/110);
    const caldera=Math.exp(-Math.pow(r/15,2));
    elevation=cone*48-caldera*32+base*10+small*(2+4*detail)-7;
  }else if(kind==='glacier'){
    const ridge=Math.pow(1-Math.abs(base*2-1),1.3);
    elevation=ridge*20+small*(1.5+4*detail)-6;
  }
  return elevation*mask*(terrain.relief/100);
}
