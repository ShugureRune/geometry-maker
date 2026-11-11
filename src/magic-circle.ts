import {polar} from './geometry';
import {buildMagicBlueprint} from './magic-blueprint';
import {renderMagicBlueprint} from './magic-infinite';
import {RATIOS,seededRandom,type Ratio,type Scene,type Shape,type Point} from './scene';
import {MAGIC_COLOR_MODES,MAGIC_PALETTES,magicColorDefaults,validMagicColorSet,type MagicColorMode,type MagicColorSet,type MagicPaletteId} from './magic-colors';

export const MAGIC_ALGORITHM_VERSION = '2d-magic-v1' as const;
export const MAGIC_STYLES = ['star','geometric','crest'] as const;
export type MagicStyle = typeof MAGIC_STYLES[number];
export type MagicCircleSettings = {
  style:MagicStyle;
  generationMode:'classic'|'infinite';
  chaos:number;
  rareEffects:boolean;
  variation:number;
  complexity:number;
  ringCount:number;
  symmetry:number;
  ornamentDensity:number;
  strokeScale:number;
  runeStyle:'runes'|'dots'|'arcs';
  rotationTurns:number;
  colorMode:MagicColorMode;
  colorPreset:MagicPaletteId;
  paletteReroll:number;
  customColors:MagicColorSet;
  showBackground:boolean;
  transparentExport:boolean;
};
export const magicDefaults:MagicCircleSettings={
  style:'star',generationMode:'classic',chaos:75,rareEffects:true,variation:0,
  complexity:65,ringCount:5,symmetry:6,ornamentDensity:65,
  strokeScale:100,runeStyle:'runes',rotationTurns:1,
  colorMode:'auto',colorPreset:'violet-ritual',paletteReroll:0,
  customColors:{...magicColorDefaults,gradient:[...magicColorDefaults.gradient]},
  showBackground:true,transparentExport:false
};
const numberIn=(x:unknown,minimum:number,maximum:number):x is number=>
  typeof x==='number'&&Number.isInteger(x)&&x>=minimum&&x<=maximum;
/** Accept only known properties and validate every value before restoring JSON. */
export function validateMagicSettings(value:unknown):MagicCircleSettings{
  if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('魔法陣設定の形式が不正です。');
  const v=value as Record<string,unknown>;
  const merged={...magicDefaults,...v};
  if(Object.keys(v).some(k=>!Object.hasOwn(magicDefaults,k))||
    !MAGIC_STYLES.includes(merged.style as MagicStyle)||
    !['classic','infinite'].includes(merged.generationMode as string)||
    !numberIn(merged.chaos,0,100)||typeof merged.rareEffects!=='boolean'||
    !numberIn(merged.variation,0,999_999)||
    !numberIn(merged.complexity,0,100)||!numberIn(merged.ringCount,2,8)||
    !numberIn(merged.symmetry,3,12)||!numberIn(merged.ornamentDensity,0,100)||
    !numberIn(merged.strokeScale,50,200)||
    !['runes','dots','arcs'].includes(merged.runeStyle as string)||
    !numberIn(merged.rotationTurns,0,3)||
    !MAGIC_COLOR_MODES.includes(merged.colorMode as MagicColorMode)||
    !MAGIC_PALETTES.some(p=>p.id===merged.colorPreset)||
    !numberIn(merged.paletteReroll,0,1_000_000)||
    !validMagicColorSet(merged.customColors)||
    typeof merged.showBackground!=='boolean'||typeof merged.transparentExport!=='boolean'
  )throw new Error('魔法陣設定の値が不正です。');
  return {...merged,customColors:{...merged.customColors,gradient:[...merged.customColors.gradient]}} as MagicCircleSettings;
}
export const magicIs=(value:string)=>value===MAGIC_ALGORITHM_VERSION;

const CLOSED=(points:Point[])=>[...points,points[0]];
const MOTIFS:readonly (readonly Point[])[]=[
  [{x:-.3,y:-.85},{x:.25,y:-.85},{x:-.22,y:0},{x:.33,y:.85}],
  [{x:-.38,y:-.8},{x:.35,y:0},{x:-.38,y:.8},{x:.18,y:.8}],
  [{x:0,y:-.85},{x:.45,y:-.3},{x:-.33,y:.25},{x:.28,y:.85}],
  [{x:-.38,y:-.8},{x:-.38,y:.8},{x:.4,y:-.15},{x:-.38,y:-.15}],
  [{x:.3,y:-.8},{x:-.32,y:-.35},{x:.25,y:.2},{x:-.15,y:.85}],
  [{x:-.35,y:-.85},{x:.32,y:-.85},{x:-.35,y:.85},{x:.32,y:.85}]
];
const v=(r:number,a:number):Point=>polar(r,a);
const normalized=(points:Point[],size:number)=>points.map(p=>({x:p.x*size,y:p.y*size}));
function starLoops(sides:number,step:number,radius:number):Point[][]{
  const seen=new Set<number>(),loops:Point[][]=[];
  for(let start=0;start<sides;start++){
    if(seen.has(start))continue;
    const points:Point[]=[];let index=start;
    do{seen.add(index);points.push(v(radius,-90+index*360/sides));index=(index+step)%sides;}while(index!==start&&!seen.has(index));
    if(points.length>=3)loops.push(CLOSED(points));
  }
  return loops;
}
function petals(count:number,inner:number,outer:number){
  return Array.from({length:count},(_,i)=>Array.from({length:29},(_,j)=>{
    const t=j/28,angle=(i+t)*360/count;
    return v(inner+(outer-inner)*Math.sin(Math.PI*t),angle);
  }));
}

/** Flat SVG contours; nothing depends on DOM, fonts, network access or Math.random.
 * Motifs are repeated per rotational sector so every seed remains symmetric. */
export function generateMagicCircleScene(seed:string,ratio:Ratio,options:MagicCircleSettings=magicDefaults):Scene{
  const settings=validateMagicSettings(options);
  if(settings.generationMode==='infinite')
    return renderMagicBlueprint(seed,ratio,settings,buildMagicBlueprint(seed,settings));
  const [width,height]=RATIOS[ratio],unit=Math.min(width,height);
  const cx=width/2,cy=height/2;
  const rOuter=unit*.424,rInner=unit*.175;
  const random=seededRandom('magic-circle-v1:'+seed+':'+settings.style);
  // Rotationally symmetric core designs still change with the seed even at zero decoration density.
  const corePhase=random()*360/settings.symmetry;
  const shapes:Shape[]=[];
  const lineWidth=unit*.00185*settings.strokeScale/100;
  const push=(id:string,kind:Shape['kind'],role:Shape['role'],group:string,x:number,y:number,size:number,rotation=0,points?:Point[],extra:Partial<Shape>={})=>{
    const shape:Shape={id,kind,role,group,layer:role==='hero'?'foreground':role==='accent'?'foreground':'midground',
      x,y,size,rotation,tone:role==='hero'?'violet':role==='accent'?'mint':'ice',
      opacity:role==='hero'?.95:role==='accent'?.91:.65,filled:false,strokeWidth:lineWidth*(role==='hero'?1.45:role==='accent'?1.05:.8),
      fillOpacity:0,glow:role==='hero'||role==='accent',bleed:false,
      importance:role==='hero'?100:role==='accent'?80:55,
      startDensity:role==='hero'?1:role==='accent'?20:32,
      ...(points?{points}:{}),...extra};
    shapes.push(shape);
    return shape;
  };
  const ring=(id:string,r:number,role:Shape['role'],group:string,extra:Partial<Shape>={})=>
    push(id,'circle',role,group,cx,cy,r,0,undefined,extra);
  const line=(id:string,points:Point[],role:Shape['role'],group:string,extra:Partial<Shape>={})=>
    push(id,'line',role,group,cx,cy,rOuter,group==='core'?corePhase:0,points,extra);
  const polygon=(id:string,sides:number,radius:number,role:Shape['role'],group:string,offset=0)=>{
    line(id,CLOSED(Array.from({length:sides},(_,i)=>v(radius,-90+offset+i*360/sides))),role,group);
  };
  // Double ward perimeter and dimensional concentric bands.
  ring('ward-outer',rOuter,'hero','ring-0');
  ring('ward-inner',rOuter-unit*.026,'hero','ring-0',{strokeWidth:lineWidth*.83});
  ring('core-boundary',rInner,'hero','core');
  const count=settings.ringCount;
  const radii=Array.from({length:count},(_,i)=>rInner+(rOuter-unit*.042-rInner)*i/(count-1));
  for(let i=1;i<count-1;i++){
    const radius=radii[i],group='ring-'+i;
    ring('ring-'+i,radius,'support',group,{opacity:.73});
    if(settings.complexity>=45)ring('ring-'+i+'-fine',radius+unit*.008,'support',group,{opacity:.33,strokeWidth:lineWidth*.55,startDensity:35});
    if(settings.complexity>=78)ring('ring-'+i+'-double',radius-unit*.01,'support',group,{opacity:.25,strokeWidth:lineWidth*.5,startDensity:55});
  }
  // Inscribed center: three genuinely different families, rather than recolored copies.
  const core=unit*.155;
  if(settings.style==='star'){
    const step=Math.max(2,Math.floor((settings.symmetry-1)/2));
    starLoops(settings.symmetry,step,core).forEach((loop,i)=>line('star-main-'+i,loop,'hero','core'));
    polygon('star-frame',settings.symmetry,core*.95,'support','core',180/settings.symmetry);
    if(settings.complexity>=42)starLoops(settings.symmetry,2,core*.67).forEach((loop,i)=>line('star-inner-'+i,loop,'support','core'));
  }else if(settings.style==='geometric'){
    polygon('poly-main',settings.symmetry,core,'hero','core');
    polygon('poly-second',settings.symmetry,core*.74,'hero','core',180/settings.symmetry);
    if(settings.complexity>=35)starLoops(settings.symmetry,2,core*.91).forEach((loop,i)=>line('poly-chord-'+i,loop,'support','core'));
  }else{
    for(const [i,petal] of petals(settings.symmetry,core*.24,core*.96).entries()){
      line('petal-'+i,[...petal,...petal.slice().reverse().map(p=>v(Math.hypot(p.x,p.y),Math.atan2(p.y,p.x)*180/Math.PI+360/settings.symmetry*.16))],
        'hero','core',{opacity:.88});
    }
    polygon('crest-small',settings.symmetry,core*.48,'support','core',180/settings.symmetry);
  }
  ring('heart',core*.26,'accent','core',{strokeWidth:lineWidth*1.5});
  ring('heart-inner',core*.12,'hero','core',{strokeWidth:lineWidth*.8});
  // Symmetry-locked radial ticks, sector seals and arc petals.
  const tickCount=settings.symmetry*(settings.complexity<30?2:settings.complexity<72?4:6);
  for(let i=0;i<tickCount;i++){
    const angle=i*360/tickCount;
    const long=i%(tickCount/settings.symmetry)===0;
    const r0=long?radii[Math.max(0,count-2)]+unit*.004:rOuter-unit*.035;
    const r1=rOuter-unit*(long?.007:.015);
    line('tick-'+i,[v(r0,angle),v(r1,angle)],long?'accent':'support','ring-0',
      {startDensity:long?25:settings.complexity>=60?43:63,glow:long});
  }
  for(let i=0;i<settings.symmetry;i++){
    const angle=i*360/settings.symmetry;
    const p=v(rInner*.94,angle);
    if(settings.complexity>=35)ring('node-'+i,unit*.011,'accent','core',{x:cx+p.x,y:cy+p.y,glow:true});
    if(settings.complexity>=63)line('ray-'+i,[v(rInner+unit*.026,angle),v(radii[Math.min(1,count-1)]-unit*.013,angle)],'support','ring-1',{opacity:.52,startDensity:38});
    if(settings.style==='crest'&&settings.complexity>=50){
      const p0=v(rInner*.68,angle);
      ring('crest-jewel-'+i,unit*.012,'support','core',{x:cx+p0.x,y:cy+p0.y});
    }
  }
  // Stamps in annular band: a rune is procedural line art, not a font glyph.
  const perSector=settings.complexity<36?1:settings.complexity<75?2:3;
  const glyphCount=settings.symmetry*perSector;
  const glyphRadius=rOuter-unit*.06;
  const runeSize=unit*.011;
  const richness=settings.ornamentDensity/100;
  for(let i=0;i<glyphCount;i++){
    if(settings.ornamentDensity===0)break;
    const phase=i%perSector;
    const angle=-90+i*360/glyphCount;
    const p=v(glyphRadius,angle);
    const group='ring-'+(count-1);
    if(settings.runeStyle==='dots'){
      ring('stamp-dot-'+i,runeSize*(phase%2?.65:1),'accent',group,
        {x:cx+p.x,y:cy+p.y,startDensity:30,glow:false});
    }else if(settings.runeStyle==='arcs'){
      push('stamp-arc-'+i,'arc','support',group,cx+p.x,cy+p.y,runeSize*1.7,angle,
        undefined,{rings:1,arcStart:-130,arcSweep:260,startDensity:35,glow:false});
    }else{
      const symbol=Math.floor(seededRandom('rune:'+seed+':'+phase)()*MOTIFS.length);
      const points=normalized([...MOTIFS[symbol]],runeSize);
      push('rune-'+i,'line','support',group,cx+p.x,cy+p.y,runeSize,angle+90,points,
        {opacity:.9,strokeWidth:lineWidth*.83,startDensity:30,glow:false});
    }
    if(richness>=.5){
      const gap=v(glyphRadius,angle+180/glyphCount);
      ring('separator-'+i,unit*.0028,'accent',group,
        {x:cx+gap.x,y:cy+gap.y,filled:true,strokeWidth:lineWidth*.45,glow:false,startDensity:50});
    }
  }
  // Deliberately repeated ornaments in intermediate bands; never random noise.
  if(settings.ornamentDensity>=25){
    const bands=settings.complexity>=70?2:1;
    for(let band=0;band<bands;band++){
      const radius=(radii[band]+radii[band+1])*.5;
      for(let i=0;i<settings.symmetry;i++){
        const a=i*360/settings.symmetry+180/settings.symmetry;
        const p=v(radius,a);
        const rr=unit*(.007+random()*.0015);
        ring('bead-'+band+'-'+i,rr,'accent','ring-'+(band+1),
          {x:cx+p.x,y:cy+p.y,glow:false,startDensity:40});
        if(settings.ornamentDensity>=75){
          const off=unit*.021;
          line('bead-branch-'+band+'-'+i,[v(radius-off,a),v(radius+off,a)],'support','ring-'+(band+1),
            {opacity:.55,startDensity:55});
        }
      }
    }
  }
  // Alternating orbit lines give the higher complexity settings real geometry.
  if(settings.complexity>=82){
    for(let i=0;i<settings.symmetry;i++){
      const start=i*360/settings.symmetry+8;
      const midRadius=(radii[count-2]+radii[count-1])*.5;
      push('seal-arc-'+i,'arc','support','ring-'+(count-2),cx,cy,midRadius,0,undefined,
        {arcStart:start,arcSweep:360/settings.symmetry-16,rings:1,opacity:.52,startDensity:58});
    }
  }
  // Keep the canvas edge and center glyph clear across all supported aspect ratios.
  const order={background:0,midground:1,foreground:2};
  shapes.sort((a,b)=>order[a.layer]-order[b.layer]);
  const composition:Scene['composition']={
    type:'magic',direction:0,quiet:{x:cx,y:cy,width:0,height:0},unit,
    noiseSeed:0,focus:{x:cx,y:cy},anchors:[],clusters:[],lanes:[]
  };
  return {version:MAGIC_ALGORITHM_VERSION,width,height,composition,shapes};
}
/** Continuous, time-based rotation. The growth timeline is intentionally independent.
 * Full turns wrap seamlessly and never freeze when growth reaches 100%.
 * Live preview and recorded video pass the same elapsed-seconds / cycle duration. */
export function magicCircleMotion(scene:Scene,settings:MagicCircleSettings,seconds:number,cycleSeconds=6):Record<string,string>{
  if(settings.rotationTurns===0||scene.version!==MAGIC_ALGORITHM_VERSION||
    !Number.isFinite(seconds)||!Number.isFinite(cycleSeconds)||cycleSeconds<=0)return {};
  const x=scene.width/2,y=scene.height/2;
  const phase=((seconds*settings.rotationTurns/cycleSeconds)%1+1)%1;
  const transforms:Record<string,string>={};
  for(const shape of scene.shapes){
    if(!shape.group.startsWith('ring-'))continue;
    const n=Number(shape.group.slice(5));
    if(!Number.isInteger(n))continue;
    const angle=Number(((n%2?-1:1)*phase*360).toFixed(6));
    transforms[shape.id]='rotate('+angle+' '+x+' '+y+')';
  }
  return transforms;
}
