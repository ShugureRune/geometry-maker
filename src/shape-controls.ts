import {seededRandom,type Shape} from './scene';

export type ShapeKind=Shape['kind'];
export const SHAPE_LABELS={
 triangle:'三角形',diamond:'ひし形',line:'直線',circuit:'回路',dot:'小さな点',
 circle:'円',frame:'四角フレーム',arc:'円弧',band:'帯',rectangle:'長方形',dots:'ドット群',
 cross:'十字',accent:'アクセント',
 hexagon:'六角形',pentagon:'五角形',trapezoid:'台形',parallelogram:'平行四辺形',
 star:'星形',chevron:'山形',zigzag:'ジグザグ',rays:'放射線',concentric:'同心円',
 'dashed-frame':'破線フレーム',semicircle:'半円',sector:'扇形',compound:'複合図形',
 grid:'格子','branch-circuit':'枝分かれ回路',linked:'連結図形',
 octagon:'八角形',crescent:'三日月',gear:'歯車',capsule:'カプセル',
 wave:'波形',orbit:'軌道リング',burst:'放射バースト',shield:'シールド'
} as const satisfies Record<ShapeKind,string>;
export const ALL_SHAPE_KINDS=Object.keys(SHAPE_LABELS) as ShapeKind[];
export const BASIC_SHAPE_KINDS:ShapeKind[]=[
 'triangle','diamond','line','circuit','dot','circle','frame','arc',
 'band','rectangle','dots','cross','accent'
];
export const EXTENDED_SHAPE_KINDS=ALL_SHAPE_KINDS.filter(k=>!BASIC_SHAPE_KINDS.includes(k));
export const RECOMMENDED_SHAPE_KINDS:ShapeKind[]=[
 'triangle','diamond','line','circle','arc','frame','hexagon','pentagon','star',
 'chevron','concentric','linked','octagon','crescent','gear','capsule','orbit','shield'
];
// Shape families are also the replacement candidate pools; the original
// generated position and parent group stay unchanged.
export const SHAPE_FAMILIES:readonly {name:string;kinds:readonly ShapeKind[]}[]=[
 {name:'多角形・シルエット',kinds:['triangle','diamond','rectangle','band','trapezoid','parallelogram','pentagon','hexagon','octagon','star','shield','burst']},
 {name:'円・曲線',kinds:['circle','arc','semicircle','sector','concentric','crescent','orbit','capsule']},
 {name:'直線・流れ',kinds:['line','chevron','zigzag','wave','rays','frame','dashed-frame','cross']},
 {name:'装飾・メカニカル',kinds:['dot','dots','accent','circuit','branch-circuit','grid','gear','compound','linked']}
];
const preferred:Partial<Record<ShapeKind,readonly ShapeKind[]>>={
 octagon:['hexagon','pentagon','diamond'],gear:['octagon','hexagon','circle'],
 orbit:['concentric','arc','circle'],crescent:['semicircle','arc','circle'],
 wave:['zigzag','line','arc'],capsule:['rectangle','circle','parallelogram'],
 burst:['star','rays','hexagon'],shield:['pentagon','hexagon','diamond'],
 'branch-circuit':['circuit','line','zigzag'],dots:['dot','circle'],
 'dashed-frame':['frame','rectangle'],linked:['compound','hexagon','pentagon']
};
const known=new Set<string>(ALL_SHAPE_KINDS);
export function validateShapeKinds(value:unknown):ShapeKind[]{
 if(!Array.isArray(value)||value.length===0||value.length>ALL_SHAPE_KINDS.length||
   value.some(v=>typeof v!=='string'||!known.has(v))||
   new Set(value).size!==value.length)throw new Error('表示する図形は重複のない1種類以上の有効なリストにしてください。');
 return [...value] as ShapeKind[];
}
export function isAllShapeKindsEnabled(kinds:readonly ShapeKind[]):boolean{
 return kinds.length===ALL_SHAPE_KINDS.length&&ALL_SHAPE_KINDS.every(kind=>kinds.includes(kind));
}
/** Called when constructing v5 figures, before bounds, attachments and animation cues.
 * This keeps connected children anchored to the replacement's real contour. */
export function resolveAllowedShapeKind(
 requested:ShapeKind,enabledKinds:readonly ShapeKind[]|undefined,seed:string,id:string
):ShapeKind{
 if(!enabledKinds||enabledKinds.includes(requested))return requested;
 if(enabledKinds.length===0)throw new Error('表示する図形を1種類以上選択してください。');
 // Branch-circuit and circuit are connector-specific contours. Keep them as
 // requested shapes, but do not substitute them for ordinary floating motifs
 // unless they are literally the only remaining user choice.
 const safe=enabledKinds.filter(kind=>kind!=='branch-circuit'&&kind!=='circuit');
 const options=safe.length?safe:enabledKinds;
 const candidates=(preferred[requested]??[]).filter(kind=>options.includes(kind));
 const family=SHAPE_FAMILIES.find(f=>f.kinds.includes(requested));
 const similar=family?.kinds.filter(kind=>kind!==requested&&options.includes(kind))??[];
 const pool=candidates.length?candidates:similar.length?similar:options;
 return pool[Math.floor(seededRandom(`shape-kind-replacement-v1:${seed}:${id}:${requested}`)()*pool.length)];
}
