import {seededRandom,type Background} from './scene';

/** Self-contained spell palettes, deliberately independent of the normal 2D color generator. */
export type MagicColorSet={
  primary:string;
  support:string;
  accent:string;
  solid:string;
  gradient:[string,string,string];
};
export type MagicPalette=MagicColorSet&{id:string;name:string};
export const MAGIC_PALETTES=[
  {id:'arcane-blue',name:'蒼の魔導',primary:'#e1f7ff',support:'#6bcaff',accent:'#238eff',solid:'#061221',gradient:['#070f22','#122950','#07132a']},
  {id:'violet-ritual',name:'紫の儀式',primary:'#f5ddff',support:'#bc8bff',accent:'#8851ff',solid:'#110920',gradient:['#130b27','#2b1550','#130a2b']},
  {id:'emerald-seal',name:'翠の封印',primary:'#d8ffe8',support:'#64e2b1',accent:'#28b989',solid:'#061912',gradient:['#061a16','#12392c','#092018']},
  {id:'crimson-oath',name:'紅蓮の契約',primary:'#ffe1e4',support:'#ff8da0',accent:'#e94f6e',solid:'#1d0b15',gradient:['#230d1a','#4b1732','#180c1b']},
  {id:'golden-sigil',name:'黄金の錬成',primary:'#fff4cf',support:'#ffda83',accent:'#ffb43f',solid:'#1d1309',gradient:['#201408','#453014','#201709']},
  {id:'moonlit-ice',name:'氷月の結界',primary:'#f2fcff',support:'#9ae7ff',accent:'#56bdf1',solid:'#0a1425',gradient:['#0b1830','#213d5d','#0b192d']},
  {id:'celestial-white',name:'星光の聖印',primary:'#ffffff',support:'#dedfff',accent:'#aebcff',solid:'#11152a',gradient:['#10172e','#29345e','#141b32']},
  {id:'obsidian-violet',name:'黒紫の秘術',primary:'#f9c9ff',support:'#ca71de',accent:'#ef68ff',solid:'#110b18',gradient:['#0d0817','#261036','#100a22']}
] as const satisfies readonly MagicPalette[];
export type MagicPaletteId=typeof MAGIC_PALETTES[number]['id'];
export const MAGIC_COLOR_MODES=['auto','preset','custom'] as const;
export type MagicColorMode=typeof MAGIC_COLOR_MODES[number];
export const magicColorDefaults:MagicColorSet={
  primary:'#efe0ff',support:'#bd98ff',accent:'#80e7ff',
  solid:'#120a24',gradient:['#120a24','#2b1651','#10152b']
};
export function validMagicColorSet(v:unknown):v is MagicColorSet{
  if(!v||typeof v!=='object'||Array.isArray(v))return false;
  const c=v as Record<string,unknown>;
  const hex=(x:unknown)=>typeof x==='string'&&/^#[0-9a-f]{6}$/i.test(x);
  return Object.keys(c).length===5&&Object.keys(c).every(k=>Object.hasOwn(magicColorDefaults,k))&&
    hex(c.primary)&&hex(c.support)&&hex(c.accent)&&hex(c.solid)&&
    Array.isArray(c.gradient)&&c.gradient.length===3&&c.gradient.every(hex);
}
export function magicPaletteFromSeed(seed:string,reroll=0):MagicPalette{
  const base=Math.floor(seededRandom('magic-palette-v1:'+seed)()*MAGIC_PALETTES.length);
  // 3 is coprime to 8: each click gives another palette before any repeats.
  const index=(base+reroll*3)%MAGIC_PALETTES.length;
  const p=MAGIC_PALETTES[index];
  return {...p,gradient:[...p.gradient]};
}
export function magicPaletteById(id:MagicPaletteId):MagicPalette{
  const p=MAGIC_PALETTES.find(p=>p.id===id)??MAGIC_PALETTES[0];
  return {...p,gradient:[...p.gradient]};
}
/** No mutation of normal 2D / 3D palette, backdrop or locked color slots. */
export function backgroundForMagic(original:Background,colors:MagicColorSet):Background{
  return {...original,mode:'gradient',solid:colors.solid,colors:[...colors.gradient],
    grid:undefined,figureColors:{primary:colors.primary,support:colors.support,accent:colors.accent}};
}
