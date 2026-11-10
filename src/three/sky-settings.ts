/** Optional 3D-only procedural environments; legacy backgrounds stay untouched. */
export const SKY_KINDS = [
  'classic','starfield','galaxy','aurora','deep-sea','nebula',
  'cyber-tunnel','retrowave','digital',
] as const;
export type SkyKind = typeof SKY_KINDS[number];

export const SKY_LABELS: Record<SkyKind,string> = {
  classic:'従来の単色・グラデーション',
  starfield:'無限の星空',
  galaxy:'銀河',
  aurora:'オーロラ',
  'deep-sea':'深海',
  nebula:'星雲',
  'cyber-tunnel':'サイバートンネル',
  retrowave:'レトロウェーブ',
  digital:'デジタル空間',
};

export type SkySettings = {
  kind:SkyKind;
  intensity:number;
  density:number;
  motion:number;
};
export const skyDefaults:SkySettings={
  kind:'classic',intensity:100,density:100,motion:100,
};
export function validateSky(value:unknown):SkySettings{
  if(!value||typeof value!=='object'||Array.isArray(value))
    throw new Error('3D背景設定が不正です。');
  const v=value as Record<string,unknown>;
  if(typeof v.kind!=='string'||!SKY_KINDS.includes(v.kind as SkyKind))
    throw new Error('3D背景の種類が不正です。');
  for(const [key,min,max] of [['intensity',0,200],['density',0,200],['motion',0,300]] as const){
    if(typeof v[key]!=='number'||!Number.isFinite(v[key])||v[key]<min||v[key]>max)
      throw new Error('3D背景の'+key+'が範囲外です。');
  }
  return {kind:v.kind as SkyKind,intensity:v.intensity as number,density:v.density as number,motion:v.motion as number};
}
/** No frame-time random numbers. Repeated seed + kind produces the same universe. */
export function skySeedNumber(seed:string,kind:SkyKind):number{
  let hash=2166136261;
  const input='sky-v1:'+kind+':'+seed;
  for(let i=0;i<input.length;i++){
    hash=Math.imul(hash^input.charCodeAt(i),16777619);
  }
  return (hash>>>0)/4294967295;
}
export function skyIsAnimated(sky:SkySettings):boolean{
  return sky.kind!=='classic'&&sky.motion>0&&sky.intensity>0;
}
