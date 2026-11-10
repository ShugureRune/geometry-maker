import {generatedColor,SLOTS,type ColorSettings} from './colors';
import {seededRandom,type Background,type Scene,type Shape} from './scene';

/** Display names remain independent of the generation algorithm version. */
export const VISUAL_THEMES=[
 {id:'standard',label:'標準',description:'これまでの自動生成スタイル'},
 {id:'pop',label:'ポップ',description:'ビビッドな色と大胆な丸・多角形'},
 {id:'neon',label:'ネオン',description:'暗い背景に強く光るライン'},
 {id:'minimal',label:'ミニマル',description:'余白と細い線を生かしたシンプルな構図'},
 {id:'pastel',label:'パステル',description:'やわらかな色と丸み'},
 {id:'cyber',label:'サイバー',description:'回路・グリッド・HUD風'},
 {id:'retro',label:'レトロ',description:'80年代風の鮮やかなグラデーション'},
 {id:'hologram',label:'ホログラム',description:'虹色の反射を思わせる透明感'},
 {id:'glitch',label:'グリッチ',description:'断片化したデジタルノイズ風'},
 {id:'blueprint',label:'ブループリント',description:'青い製図面に精密な白線'},
 {id:'wa',label:'和モダン',description:'朱色と墨色の幾何学'},
 {id:'cosmic',label:'コズミック',description:'星空・軌道・深い青紫'},
 {id:'luxury',label:'ラグジュアリー',description:'黒と金のアールデコ調'}
] as const;
export type VisualTheme=typeof VISUAL_THEMES[number]['id'];
export const validVisualTheme=(value:unknown):value is VisualTheme=>
 typeof value==='string'&&VISUAL_THEMES.some(theme=>theme.id===value);

type Preset={
 mode:Background['mode'];solid:string;colors:[string,string,string];angle:number;
 primary:string;support:string;accent:string;appearance:'light'|'dark';
 lineWidth:number;glowIntensity:number;stroke:number;opacity:number;
 fill:number;detail:number;supportAmount:number;
 emphasize:readonly Shape['kind'][];deemphasize:readonly Shape['kind'][];
};
/** Each theme changes palette, figure emphasis, filling and line treatment. */
export const THEME_PRESETS:Record<Exclude<VisualTheme,'standard'>,Preset>={
 pop:{mode:'gradient',solid:'#fff0b5',colors:['#fff2a6','#ffbdd3','#b5f5f0'],angle:35,primary:'#ef2872',support:'#284ee8',accent:'#fa6c1f',appearance:'light',lineWidth:175,glowIntensity:0,stroke:1.4,opacity:1.14,fill:.85,detail:.94,supportAmount:.84,emphasize:['circle','dot','dots','star','triangle','diamond','pentagon'],deemphasize:['circuit','branch-circuit','grid','dashed-frame']},
 neon:{mode:'gradient',solid:'#090719',colors:['#08071b','#18072e','#062a37'],angle:125,primary:'#fa50ed',support:'#3edcf5',accent:'#bbff6c',appearance:'dark',lineWidth:115,glowIntensity:185,stroke:1.05,opacity:1.15,fill:.16,detail:.9,supportAmount:1,emphasize:['circle','concentric','arc','rays','circuit'],deemphasize:['dots','band']},
 minimal:{mode:'solid',solid:'#f3f1ea',colors:['#f3f1ea','#f3f1ea','#f3f1ea'],angle:0,primary:'#222830',support:'#767c7d',accent:'#b18d7d',appearance:'light',lineWidth:65,glowIntensity:0,stroke:.7,opacity:.95,fill:.06,detail:.18,supportAmount:.48,emphasize:['line','circle','arc','rectangle','frame'],deemphasize:['dots','rays','grid','branch-circuit','circuit']},
 pastel:{mode:'gradient',solid:'#f8e6f2',colors:['#f5e1f8','#daf5ed','#f9e6dc'],angle:145,primary:'#985eb3',support:'#4a9ca0',accent:'#e58ca7',appearance:'light',lineWidth:110,glowIntensity:12,stroke:1,opacity:.82,fill:.58,detail:.81,supportAmount:.87,emphasize:['circle','arc','semicircle','dot','dots','star'],deemphasize:['circuit','branch-circuit','grid']},
 cyber:{mode:'gradient',solid:'#071925',colors:['#050e1b','#052a34','#151b36'],angle:110,primary:'#00e6d1',support:'#5c9fff',accent:'#ff5478',appearance:'dark',lineWidth:105,glowIntensity:112,stroke:.92,opacity:1.12,fill:.06,detail:.86,supportAmount:1,emphasize:['circuit','branch-circuit','grid','line','frame','dashed-frame','hexagon','linked'],deemphasize:['dot','dots','star','band']},
 retro:{mode:'gradient',solid:'#401a59',colors:['#251749','#773a80','#ff9559'],angle:155,primary:'#ffda6b',support:'#ff6ab1',accent:'#7cf7fa',appearance:'dark',lineWidth:145,glowIntensity:45,stroke:1.26,opacity:1.05,fill:.66,detail:.8,supportAmount:.88,emphasize:['triangle','zigzag','grid','rays','band','rectangle','star'],deemphasize:['circuit','branch-circuit']},
 hologram:{mode:'gradient',solid:'#d6f2f9',colors:['#d4e6ff','#f7d6f5','#b0f5e9'],angle:25,primary:'#7552ca',support:'#257db8',accent:'#eb68b4',appearance:'light',lineWidth:105,glowIntensity:55,stroke:.95,opacity:.8,fill:.3,detail:.9,supportAmount:.95,emphasize:['diamond','hexagon','sector','arc','concentric','compound','linked'],deemphasize:['circuit','branch-circuit']},
 glitch:{mode:'gradient',solid:'#100f1c',colors:['#0a101c','#19102a','#1b0f26'],angle:90,primary:'#ff479e',support:'#00edee',accent:'#faff70',appearance:'dark',lineWidth:130,glowIntensity:85,stroke:1.2,opacity:1.17,fill:.42,detail:.95,supportAmount:.82,emphasize:['zigzag','cross','line','dashed-frame','grid','rectangle','chevron'],deemphasize:['arc','circle','concentric','semicircle']},
 blueprint:{mode:'solid',solid:'#102c55',colors:['#102c55','#102c55','#102c55'],angle:0,primary:'#eaf8ff',support:'#9ad8ff',accent:'#78f3ea',appearance:'dark',lineWidth:65,glowIntensity:0,stroke:.68,opacity:.94,fill:0,detail:.58,supportAmount:1,emphasize:['line','grid','frame','circle','arc','dashed-frame','linked'],deemphasize:['dot','dots','band','accent']},
 wa:{mode:'solid',solid:'#f5e9d6',colors:['#f5e9d6','#f5e9d6','#f5e9d6'],angle:0,primary:'#b62732',support:'#25272a',accent:'#b58b41',appearance:'light',lineWidth:115,glowIntensity:0,stroke:1.08,opacity:1.02,fill:.63,detail:.62,supportAmount:.82,emphasize:['circle','triangle','diamond','arc','sector','rays'],deemphasize:['circuit','branch-circuit','grid','zigzag']},
 cosmic:{mode:'gradient',solid:'#090b26',colors:['#070d2d','#251047','#0a3159'],angle:135,primary:'#ceacff',support:'#77c9ff',accent:'#f5d995',appearance:'dark',lineWidth:100,glowIntensity:118,stroke:.95,opacity:1,fill:.18,detail:.93,supportAmount:.92,emphasize:['star','dots','dot','circle','concentric','arc','rays'],deemphasize:['grid','circuit','branch-circuit']},
 luxury:{mode:'solid',solid:'#0c1110',colors:['#0c1110','#0c1110','#0c1110'],angle:0,primary:'#e5bf6a',support:'#a78a4b',accent:'#f5e9c1',appearance:'dark',lineWidth:90,glowIntensity:18,stroke:.92,opacity:1,fill:.12,detail:.36,supportAmount:.72,emphasize:['arc','circle','diamond','frame','rays','concentric','line'],deemphasize:['dots','dot','zigzag','grid','circuit']}
};

export function applyThemePalette(colors:ColorSettings,background:Background,theme:Exclude<VisualTheme,'standard'>):{colors:ColorSettings;background:Background}{
 const preset=THEME_PRESETS[theme],palette=[preset.solid,...preset.colors,preset.primary,preset.support,preset.accent];
 const themed:ColorSettings={...colors,mode:'manual',appearance:preset.appearance,edited:[...SLOTS],slots:Object.fromEntries(SLOTS.map((id,index)=>[id,{
  ...colors.slots[id],color:colors.slots[id].locked?colors.slots[id].color:palette[index]
 }])) as ColorSettings['slots']};
 return{colors:themed,background:{...background,mode:preset.mode,angle:preset.angle,
  solid:themed.slots.solid.color,
  colors:[themed.slots.gradient0.color,themed.slots.gradient1.color,themed.slots.gradient2.color],
  lineWidth:preset.lineWidth,glowIntensity:preset.glowIntensity,
  figureColors:{primary:themed.slots.primary.color,support:themed.slots.support.color,accent:themed.slots.accent.color}
 }};
}

/** Pure seeded post-process. Standard returns untouched geometry; no extra randomness
 * leaks into either v4/v5 generation, animation timing or scroll world placement.
 * A retained child must also have its parent, avoiding orphan decorations. */
export function themeScene(scene:Scene,theme:VisualTheme,seed:string):Scene{
 if(theme==='standard')return scene;
 const preset=THEME_PRESETS[theme];
 const byId=new Map(scene.shapes.map(s=>[s.id,s]));
 const eligibility=new Map<string,boolean>();
 const allowed=(s:Shape):boolean=>{
  if(eligibility.has(s.id))return eligibility.get(s.id)!;
  if(s.role==='hero'){eligibility.set(s.id,true);return true;}
  const roll=seededRandom(`visual-theme-v1:${theme}:${seed}:${s.id}`)();
  const preferred=preset.emphasize.includes(s.kind),avoided=preset.deemphasize.includes(s.kind);
  const probability=Math.min(1,Math.max(0,
   (s.role==='decoration'?preset.detail:s.role==='support'?preset.supportAmount:.98)
   +(preferred?.22:0)-(avoided?.42:0)));
  const present=roll<probability&&(!s.parent||!byId.has(s.parent)||allowed(byId.get(s.parent)!));
  eligibility.set(s.id,present);return present;
 };
 const fillable=new Set<Shape['kind']>(['circle','triangle','diamond','rectangle','hexagon','pentagon','star','trapezoid','parallelogram','sector','semicircle','band']);
 const shapes=scene.shapes.filter(allowed).map(s=>{
  const random=seededRandom(`visual-theme-fill-v1:${theme}:${seed}:${s.id}`)();
  return {...s,
   strokeWidth:s.strokeWidth*preset.stroke,
   opacity:Math.min(1,Math.max(.08,s.opacity*preset.opacity)),
   filled:fillable.has(s.kind)?random<preset.fill:s.filled,
   fillOpacity:Math.min(1,s.fillOpacity*(theme==='hologram'?.55:theme==='pastel'?.72:1))
  };
 });
 return {...scene,shapes};
}

// Legacy two-button color presets remain available for older use cases.
const backgrounds={night:['#080d19','#080d19','#17213c','#0b2630'],neon:['#10091f','#090e25','#28113d','#072c35']} as const;
export function darkTheme(colors:ColorSettings,seed:string,theme:keyof typeof backgrounds):ColorSettings {
 return {...colors,appearance:'dark',edited:[...new Set([...(colors.edited??[]),'primary','support','accent'] as const)],
 slots:Object.fromEntries(SLOTS.map((id,i)=>[id,{...colors.slots[id],color:colors.slots[id].locked?colors.slots[id].color:i<4?backgrounds[theme][i]:generatedColor(seed,id,colors.slots[id].reroll,'dark')}])) as ColorSettings['slots']};
}
