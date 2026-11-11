import type {MagicCircleSettings} from './magic-circle';

/**
 * Procedural grammar for the infinite 2D magic-circle generator.
 * A blueprint is reproducible, dimensionless, and safe to inspect as JSON.
 * The classic generator is intentionally not affected.
 */
export const MAGIC_CORE_KINDS=['star','double-star','polygon','flower','sigil','lattice','orbit'] as const;
export const MAGIC_RING_KINDS=['ward','runes','nodes','spokes','arcs','petals','mesh','seal','orbit'] as const;
export const MAGIC_MOTIF_FAMILIES=['ancient','astral','holy','cursed','alchemy','mechanical'] as const;
export const MAGIC_RARE_EFFECTS=['eclipse','satellites','double-core','crown'] as const;
export type MagicCoreKind=typeof MAGIC_CORE_KINDS[number];
export type MagicRingKind=typeof MAGIC_RING_KINDS[number];
export type MagicMotifFamily=typeof MAGIC_MOTIF_FAMILIES[number];
export type MagicRareEffect=typeof MAGIC_RARE_EFFECTS[number];
export type RingPlan={
  kind:MagicRingKind;
  radiusRatio:number;
  repeat:number;
  phase:number;
  variant:number;
  thickness:number;
};
export type MagicBlueprint={
  version:1;
  symmetry:number;
  coreKind:MagicCoreKind;
  coreVariant:number;
  corePhase:number;
  coreRadiusRatio:number;
  ringCount:number;
  ringPlan:RingPlan[];
  motifFamily:MagicMotifFamily;
  nodeStyle:'circle'|'diamond'|'triangle';
  outerFrame:'single'|'double'|'triple';
  rareEffect:MagicRareEffect|null;
  accentAngle:number;
};
const clamp=(value:number,low:number,high:number)=>Math.max(low,Math.min(high,value));
/** Split streams isolate motif changes from layout changes and avoid Math.random. */
export function magicRng(seed:string,domain:string):()=>number{
  const value='magic-blueprint-v1:'+domain+':'+seed;
  let state=2166136261;
  for(let i=0;i<value.length;i++)state=Math.imul(state^value.charCodeAt(i),16777619);
  return ()=>{
    state=(state+0x6d2b79f5)|0;
    let n=Math.imul(state^(state>>>15),1|state);
    n^=n+Math.imul(n^(n>>>7),61|n);
    return ((n^(n>>>14))>>>0)/4294967296;
  };
}
const choose=<T,>(items:readonly T[],rng:()=>number):T=>items[Math.floor(rng()*items.length)];
/** A seed changes the STRUCTURE, not merely the rotation of a fixed diagram. */
export function buildMagicBlueprint(seed:string,settings:MagicCircleSettings):MagicBlueprint{
  const key=seed+':variation-'+settings.variation;
  const layout=magicRng(key,'layout'),core=magicRng(key,'core');
  const motifs=magicRng(key,'motifs'),rare=magicRng(key,'rare');
  const freedom=settings.chaos/100;
  const symmetry=clamp(settings.symmetry+Math.round((layout()-.5)*8*freedom),3,12);
  const ringCount=clamp(settings.ringCount+Math.round((layout()-.5)*4*freedom),2,8);
  const outerFrame=choose(freedom<.35?['single','double'] as const:['single','double','triple'] as const,layout);
  const corePool:readonly MagicCoreKind[]=freedom<.35?['star','polygon','flower']
    :freedom<.7?['star','double-star','polygon','flower','sigil']:MAGIC_CORE_KINDS;
  const coreKind=choose(corePool,core);
  const coreVariant=Math.floor(core()*24);
  const corePhase=core()*360/symmetry;
  const coreRadiusRatio=.113+core()*.035;
  const motifFamily=choose(MAGIC_MOTIF_FAMILIES,motifs);
  const nodeStyle=choose(['circle','diamond','triangle'] as const,motifs);
  const kinds:readonly MagicRingKind[]=freedom<.35?['ward','nodes','spokes','seal']
    :freedom<.7?['ward','runes','nodes','spokes','arcs','mesh','seal']:MAGIC_RING_KINDS;
  const ringPlan:RingPlan[]=[];
  for(let i=0;i<ringCount;i++){
    // Chaos controls the available grammar, not just the number of rings.
    // Ring-specific streams ensure a new ring does not scramble earlier rings.
    const r=magicRng(key,'ring-'+i);
    let kind=choose(kinds,r);
    // Avoid visually identical adjacent bands; rare repetition stays intentional.
    if(i>0&&kind===ringPlan[i-1].kind)kind=kinds[(kinds.indexOf(kind)+1+Math.floor(r()*(kinds.length-1)))%kinds.length];
    const repeat=symmetry*(1+Math.floor(r()*(settings.complexity>=70?4:3)));
    // Curves cannot collide with neighbors: the entire band is within 0.175..0.4 units.
    const radiusRatio=.185+(.391-.185)*(i+.5)/(ringCount);
    ringPlan.push({
      kind,radiusRatio,
      repeat,
      phase:r()*360/symmetry,
      variant:Math.floor(r()*16),
      thickness:.004+r()*.006,
    });
  }
  const rareEffect=settings.rareEffects&&rare()<.16?choose(MAGIC_RARE_EFFECTS,rare):null;
  return {
    version:1,symmetry,coreKind,coreVariant,corePhase,coreRadiusRatio,
    ringCount,ringPlan,motifFamily,nodeStyle,outerFrame,rareEffect,
    accentAngle:layout()*360/symmetry
  };
}
