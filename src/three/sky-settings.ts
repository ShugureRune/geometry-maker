import {validateTerrain,type TerrainSettings} from './terrain';
import {validateWorld,type WorldSettings} from './world-settings';

/** Optional 3D-only procedural environments; legacy backgrounds stay untouched. */
export const SKY_KINDS = [
  'classic','starfield','galaxy','aurora','deep-sea','nebula',
  'cyber-tunnel','retrowave','digital',
  'shallow-water','whiteout-snow','foggy-grassland',
  'endless-desert','salt-flat','moonlit-flowers','forest-edge',
  'twilight-plain','cloud-sea','dark-mirror',
  'alpine-peaks','grand-canyon','volcanic-field','glacier','floating-islands',
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
  'shallow-water':'無限の浅瀬',
  'whiteout-snow':'雪原ホワイトアウト',
  'foggy-grassland':'白い霧の草原',
  'endless-desert':'無限の砂漠',
  'salt-flat':'鏡の塩湖',
  'moonlit-flowers':'夜の無限花畑',
  'forest-edge':'薄暗い森の縁',
  'twilight-plain':'星のない薄明の平原',
  'cloud-sea':'雲海の上',
  'dark-mirror':'黒い水面と霧',
  'alpine-peaks':'山岳地帯',
  'grand-canyon':'巨大峡谷',
  'volcanic-field':'火山地帯',
  glacier:'氷河',
  'floating-islands':'浮遊島',
};

/** Three editable colors per preset: dark atmosphere, luminous midtone, and highlights.
 * A missing color override keeps the exact original procedural palette. */
export type SkyPalette={base:string;accent:string;highlight:string};
export const SKY_PALETTES:Record<SkyKind,SkyPalette>={
  classic:{base:'#060b21',accent:'#38456e',highlight:'#e3ecff'},
  starfield:{base:'#050b26',accent:'#26418b',highlight:'#d6eaff'},
  galaxy:{base:'#080621',accent:'#694acb',highlight:'#ffccae'},
  aurora:{base:'#031421',accent:'#1daa83',highlight:'#a7f1d2'},
  'deep-sea':{base:'#010d2b',accent:'#087f99',highlight:'#8deeff'},
  nebula:{base:'#0d0628',accent:'#9b40d4',highlight:'#5de2f3'},
  'cyber-tunnel':{base:'#04051a',accent:'#36cfff',highlight:'#ff5bcf'},
  retrowave:{base:'#120525',accent:'#ee399d',highlight:'#ffb45d'},
  digital:{base:'#011413',accent:'#10d87b',highlight:'#a9ffcf'},
  'shallow-water':{base:'#91cbd3',accent:'#b9e3e5',highlight:'#f4f9f3'},
  'whiteout-snow':{base:'#dbe9f3',accent:'#eff5f8',highlight:'#ffffff'},
  'foggy-grassland':{base:'#b5c8b6',accent:'#8eae90',highlight:'#eef2e8'},
  'endless-desert':{base:'#715540',accent:'#c8a27b',highlight:'#f6dcb2'},
  'salt-flat':{base:'#9daeb5',accent:'#d9e4e8',highlight:'#ffffff'},
  'moonlit-flowers':{base:'#090e26',accent:'#7d66bd',highlight:'#eed0fc'},
  'forest-edge':{base:'#263a37',accent:'#587b69',highlight:'#adc5ad'},
  'twilight-plain':{base:'#51445f',accent:'#a28da7',highlight:'#e8b5aa'},
  'cloud-sea':{base:'#8ea9cb',accent:'#d2dced',highlight:'#fff6ea'},
  'dark-mirror':{base:'#02070f',accent:'#162d39',highlight:'#8bb4c5'},
  'alpine-peaks':{base:'#34435c',accent:'#768e8c',highlight:'#e3edf1'},
  'grand-canyon':{base:'#68402e',accent:'#bd754b',highlight:'#f7bf88'},
  'volcanic-field':{base:'#140f16',accent:'#57302c',highlight:'#ff7d31'},
  glacier:{base:'#7ba9c0',accent:'#b7dce4',highlight:'#f4fdff'},
  'floating-islands':{base:'#7fa6b3',accent:'#86b5a5',highlight:'#f4f0cf'},
};
export type SkyPaletteOverrides=Partial<Record<SkyKind,SkyPalette>>;
export function validateSkyPalette(value:unknown):SkyPalette{
  if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('3D背景の色設定が不正です。');
  const v=value as Record<string,unknown>,color=(x:unknown)=>{
    if(typeof x!=='string'||!/^#[0-9a-fA-F]{6}$/.test(x))throw new Error('3D背景の色は#RRGGBBで指定してください。');
    return x.toLowerCase();
  };
  return {base:color(v.base),accent:color(v.accent),highlight:color(v.highlight)};
}

export function validateSkyPaletteOverrides(value:unknown):SkyPaletteOverrides{
  if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('3D背景の色設定が不正です。');
  const v=value as Record<string,unknown>,out:SkyPaletteOverrides={};
  for(const [kind,palette] of Object.entries(v)){
    if(!SKY_KINDS.includes(kind as SkyKind))throw new Error('未知の3D背景色設定です。');
    out[kind as SkyKind]=validateSkyPalette(palette);
  }
  return out;
}
/** Outdoor rendering range and atmospheric fog, optional for legacy JSON. */
export type OutdoorVisibilitySettings={distance:number;fogEnabled:boolean};
export const outdoorVisibilityDefaults:OutdoorVisibilitySettings={distance:400,fogEnabled:true};
export const OUTDOOR_SKY_KINDS=[
  'shallow-water','whiteout-snow','foggy-grassland','endless-desert',
  'salt-flat','moonlit-flowers','forest-edge','twilight-plain','cloud-sea','dark-mirror',
  'alpine-peaks','grand-canyon','volcanic-field','glacier','floating-islands',
] as const;
export function hasOutdoorVisibility(kind:SkyKind):boolean{
  return OUTDOOR_SKY_KINDS.some(v=>v===kind);
}
export function validateOutdoorVisibility(value:unknown):OutdoorVisibilitySettings{
  if(!value||typeof value!=='object'||Array.isArray(value))
    throw new Error('屋外背景の描画距離設定が不正です。');
  const v=value as Record<string,unknown>;
  if(typeof v.distance!=='number'||!Number.isFinite(v.distance)||v.distance<100||v.distance>1000)
    throw new Error('屋外背景の描画距離は100～1000%で指定してください。');
  if(typeof v.fogEnabled!=='boolean')
    throw new Error('屋外背景の霧ON/OFF設定が不正です。');
  return {distance:v.distance,fogEnabled:v.fogEnabled};
}
export type SkySettings = {
  kind:SkyKind;
  intensity:number;
  density:number;
  motion:number;
  colors?:SkyPaletteOverrides;
  terrain?:TerrainSettings;
  visibility?:OutdoorVisibilitySettings;
  world?:WorldSettings;
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
  return {kind:v.kind as SkyKind,intensity:v.intensity as number,density:v.density as number,motion:v.motion as number,
    ...(v.colors===undefined?{}:{colors:validateSkyPaletteOverrides(v.colors)}),
    ...(v.terrain===undefined?{}:{terrain:validateTerrain(v.terrain)}),
    ...(v.visibility===undefined?{}:{visibility:validateOutdoorVisibility(v.visibility)}),
    ...(v.world===undefined?{}:{world:validateWorld(v.world)})};
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

/** Mobile/desktop scene budgets: both use one instanced grass draw call. */
export function outdoorGrassCount(density:number,low:boolean):number{
  return Math.max(0,Math.round((low?260:1150)*density/100));
}
export function outdoorSnowCount(density:number,low:boolean):number{
  return Math.max(0,Math.round((low?140:440)*density/100));
}
/** Actual ground-visible world units. With fog disabled the slider still limits
 * terrain draw range but removes atmospheric fading over the near/middle view.
 * The 950u cap keeps the far edge inside the 1200u 3D camera far plane. */
export function outdoorVisibleDistance(kind:SkyKind,visibility:OutdoorVisibilitySettings=outdoorVisibilityDefaults):number{
  const distance=visibility.fogEnabled
    ? outdoorFogDistance(kind)*visibility.distance/100
    : visibility.distance*1.5;
  return Math.max(30,Math.min(950,distance));
}
export function outdoorFogDistance(kind:SkyKind):number{
  if(kind==='whiteout-snow')return 38;
  if(kind==='foggy-grassland')return 62;
  if(kind==='forest-edge')return 95;
  if(kind==='moonlit-flowers')return 75;
  if(kind==='cloud-sea')return 170;
  if(kind==='dark-mirror')return 85;
  if(kind==='alpine-peaks')return 480;
  if(kind==='grand-canyon')return 520;
  if(kind==='volcanic-field')return 430;
  if(kind==='glacier')return 480;
  if(kind==='floating-islands')return 580;
  return 115;
}
/** GPU instancing limits for the seven extra natural environments. */
export function outdoorFlowerCount(density:number,low:boolean):number{
  return Math.max(0,Math.round((low?240:950)*density/100));
}
export function outdoorTreeCount(density:number,low:boolean):number{
  return Math.max(0,Math.round((low?40:130)*density/100));
}
export function outdoorCloudCount(density:number,low:boolean):number{
  return Math.max(0,Math.round((low?28:85)*density/100));
}

export function skyIsAnimated(sky:SkySettings):boolean{
  return sky.kind!=='classic'&&sky.motion>0&&sky.intensity>0;
}
