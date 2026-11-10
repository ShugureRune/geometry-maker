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

export type SkyEffectKind=Exclude<SkyKind,'classic'>;
export type SkyPalette={primary:string;secondary:string};
export const SKY_PALETTES:Record<SkyEffectKind,SkyPalette>={
  starfield:{primary:'#c6dbff',secondary:'#596fc5'},
  galaxy:{primary:'#3658f4',secondary:'#ec65ba'},
  aurora:{primary:'#12c875',secondary:'#8b3dbc'},
  'deep-sea':{primary:'#37b9bc',secondary:'#16a9de'},
  nebula:{primary:'#9225db',secondary:'#10b9ed'},
  'cyber-tunnel':{primary:'#36cfff',secondary:'#ff5bcf'},
  retrowave:{primary:'#ff6535',secondary:'#b82bbd'},
  digital:{primary:'#1af29c',secondary:'#0b9e84'},
};

export type SkySettings = {
  kind:SkyKind;
  intensity:number;
  density:number;
  motion:number;
  /** Overrides per preset: switching types does not discard the other colors. */
  palettes?:Partial<Record<SkyEffectKind,SkyPalette>>;
};
export function skyPalette(sky:SkySettings):SkyPalette{
  if(sky.kind==='classic')return SKY_PALETTES.starfield;
  return sky.palettes?.[sky.kind]??SKY_PALETTES[sky.kind];
}

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
  let palettes:SkySettings['palettes'];
  if(v.palettes!==undefined){
    if(!v.palettes||typeof v.palettes!=='object'||Array.isArray(v.palettes))
      throw new Error('3D背景のカラー設定が不正です。');
    palettes={};
    for(const [kind,raw] of Object.entries(v.palettes)){
      if(!(kind in SKY_PALETTES)||!raw||typeof raw!=='object'||Array.isArray(raw))
        throw new Error('3D背景の種類別カラーが不正です。');
      const p=raw as Record<string,unknown>;
      for(const key of ['primary','secondary'] as const)
        if(typeof p[key]!=='string'||!/^#[0-9a-fA-F]{6}$/.test(p[key]))
          throw new Error('3D背景のカラーが不正です。');
      palettes[kind as SkyEffectKind]={primary:p.primary as string,secondary:p.secondary as string};
    }
  }
  return {kind:v.kind as SkyKind,intensity:v.intensity as number,density:v.density as number,motion:v.motion as number,
    ...(palettes===undefined?{}:{palettes})};
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
/** Actual count of 3D tunnel frames. Density 0 hides them, 100 retains
 * the original 34-frame tunnel, and 200 doubles it without adding meshes. */
export function cyberTunnelFrameCount(density:number):number{
  return Math.max(0,Math.round(34*density/100));
}

export function skyIsAnimated(sky:SkySettings):boolean{
  return sky.kind!=='classic'&&sky.motion>0&&sky.intensity>0;
}
