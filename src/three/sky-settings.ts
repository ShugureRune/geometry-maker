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
export type SkyPalette={base:string;primary:string;accent:string};
/** Each preset keeps its recognizable default colors until the user edits them. */
export const SKY_PALETTES:Record<SkyEffectKind,SkyPalette>={
  starfield:{base:'#070d2b',primary:'#4463aa',accent:'#c8e3ff'},
  galaxy:{base:'#080923',primary:'#6156fc',accent:'#f3a6c6'},
  aurora:{base:'#031d2b',primary:'#20e6a5',accent:'#a45dff'},
  'deep-sea':{base:'#021127',primary:'#147aa0',accent:'#6ae7e6'},
  nebula:{base:'#100824',primary:'#7d32cf',accent:'#32b9f2'},
  'cyber-tunnel':{base:'#06061b',primary:'#36cfff',accent:'#ff5bcf'},
  retrowave:{base:'#220a4b',primary:'#d53ca9',accent:'#ff9d46'},
  digital:{base:'#01180e',primary:'#0ef187',accent:'#70ffd6'},
};
export function skyPalette(settings:SkySettings):SkyPalette{
  if(settings.kind==='classic')return SKY_PALETTES.starfield;
  return settings.palettes?.[settings.kind]??SKY_PALETTES[settings.kind];
}

export type SkySettings = {
  kind:SkyKind;
  intensity:number;
  density:number;
  motion:number;
  /** Only explicitly edited presets are serialized. Switching modes keeps edits. */
  palettes?:Partial<Record<SkyEffectKind,SkyPalette>>;
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
  let palettes:SkySettings['palettes'];
  if(v.palettes!==undefined){
    if(!v.palettes||typeof v.palettes!=='object'||Array.isArray(v.palettes))
      throw new Error('3D背景のカラー設定が不正です。');
    palettes={};
    const entries=Object.entries(v.palettes as Record<string,unknown>);
    for(const [kind,value] of entries){
      if(kind==='classic'||!SKY_KINDS.includes(kind as SkyKind))
        throw new Error('3D背景のカラー対象が不正です。');
      if(!value||typeof value!=='object'||Array.isArray(value))
        throw new Error('3D背景のカラー設定が不正です。');
      const colors=value as Record<string,unknown>;
      const hex=(field:string):string=>{
        const candidate=colors[field];
        if(typeof candidate!=='string'||!/^#[0-9a-fA-F]{6}$/.test(candidate))
          throw new Error('3D背景のカラー値が不正です。');
        return candidate.toLowerCase();
      };
      palettes[kind as SkyEffectKind]={base:hex('base'),primary:hex('primary'),accent:hex('accent')};
    }
  }
  return {kind:v.kind as SkyKind,intensity:v.intensity as number,density:v.density as number,
    motion:v.motion as number,...(palettes!==undefined?{palettes}:{})};
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
