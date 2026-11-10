import {SLOTS,type ColorSettings,type Slot} from './colors';

/** Pure color extraction. Browser file loading is handled separately; no image data
 * is sent anywhere or written to project settings. */
type RGB={r:number;g:number;b:number};
type Bucket=RGB&{weight:number;key:number};
export type ImagePalette={
 swatches:string[];
 solid:string;
 gradient:[string,string,string];
 figures:[string,string,string];
};
export type PaletteScope='all'|'background'|'figures';
export type PaletteFocus='subject'|'center'|'all';
export type ImagePaletteOptions={
 width:number;
 focus?:PaletteFocus;
 /** Normalized [0..1] crop on the sampled image (not the original dimensions). */
 crop?:{x:number;y:number;width:number;height:number};
};
const clamp=(v:number)=>Math.max(0,Math.min(255,Math.round(v)));
const rgb=(color:string):RGB=>({
 r:parseInt(color.slice(1,3),16),
 g:parseInt(color.slice(3,5),16),
 b:parseInt(color.slice(5,7),16)
});
const hex=(c:RGB)=>'#'+[c.r,c.g,c.b].map(v=>clamp(v).toString(16).padStart(2,'0')).join('');
const mix=(a:RGB,b:RGB,t:number):RGB=>({
 r:a.r*(1-t)+b.r*t,g:a.g*(1-t)+b.g*t,b:a.b*(1-t)+b.b*t
});
const black={r:0,g:0,b:0},white={r:255,g:255,b:255};
const dist=(a:RGB,b:RGB)=>{
 const r=(a.r+b.r)/2,dr=a.r-b.r,dg=a.g-b.g,db=a.b-b.b;
 return (2+r/256)*dr*dr+4*dg*dg+(2+(255-r)/256)*db*db;
};
const linear=(v:number)=>{const s=v/255;return s<=.04045?s/12.92:((s+.055)/1.055)**2.4;};
const luminance=(c:RGB)=>.2126*linear(c.r)+.7152*linear(c.g)+.0722*linear(c.b);
export const contrastRatio=(a:string,b:string)=>{
 const l1=luminance(rgb(a)),l2=luminance(rgb(b));
 return (Math.max(l1,l2)+.05)/(Math.min(l1,l2)+.05);
};


/** Downweight likely background, while keeping the old pixel histogram available
 * through focus='all'. Coordinates are from the small, on-device Canvas sample. */
function paletteWeights(pixels:Uint8ClampedArray,options?:ImagePaletteOptions):Float32Array|undefined{
 if(!options||options.focus==='all'&&!options.crop)return;
 const count=pixels.length/4;
 const width=options.width;
 if(!Number.isInteger(width)||width<1||count%width!==0)
  throw new Error('画像の幅が正しくありません。');
 const height=count/width;
 const crop=options.crop;
 const left=crop?Math.max(0,Math.floor(crop.x*width)):0;
 const top=crop?Math.max(0,Math.floor(crop.y*height)):0;
 const right=crop?Math.min(width,Math.ceil((crop.x+crop.width)*width)):width;
 const bottom=crop?Math.min(height,Math.ceil((crop.y+crop.height)*height)):height;
 if(right<=left||bottom<=top)throw new Error('色を抽出する範囲を広げてください。');
 const weights=new Float32Array(count);
 const focus=options.focus??'all';
 for(let y=top;y<bottom;y++)for(let x=left;x<right;x++){
  const index=y*width+x;
  if(focus==='all'){weights[index]=1;continue;}
  const dx=((x+.5-(left+right)/2)/((right-left)/2));
  const dy=((y+.5-(top+bottom)/2)/((bottom-top)/2));
  const closeness=Math.max(0,1-(dx*dx+dy*dy)/1.6);
  weights[index]=focus==='center' ? 0.02+3*closeness**5 : 0.15+1.85*closeness**2;
 }
 if(focus!=='subject'||right-left<8||bottom-top<8)return weights;
 // A broad, connected border color is often the backdrop behind an illustration.
 // Do not assume a colorful/textured border is a removable background.
 const border:number[]=[];
 for(let x=left;x<right;x++){border.push(top*width+x,(bottom-1)*width+x);}
 for(let y=top+1;y<bottom-1;y++){border.push(y*width+left,y*width+right-1);}
 const buckets=new Map<number,{r:number;g:number;b:number;n:number}>();
 for(const index of border){
  if(pixels[index*4+3]<128)continue;
  const r=pixels[index*4],g=pixels[index*4+1],b=pixels[index*4+2];
  const key=((r>>4)<<8)|((g>>4)<<4)|(b>>4);
  const entry=buckets.get(key);
  if(entry){entry.r+=r;entry.g+=g;entry.b+=b;entry.n++;}
  else buckets.set(key,{r,g,b,n:1});
 }
 const main=[...buckets.entries()].sort((a,b)=>b[1].n-a[1].n||a[0]-b[0])[0]?.[1];
 if(!main||main.n<border.length*.22)return weights;
 const bg={r:main.r/main.n,g:main.g/main.n,b:main.b/main.n};
 const isBackground=(index:number)=>{
  const at=index*4;
  return pixels[at+3]>=128&&dist(bg,{r:pixels[at],g:pixels[at+1],b:pixels[at+2]})<5400;
 };
 const matched=border.filter(isBackground);
 if(matched.length<border.length*.38)return weights;
 const seen=new Uint8Array(count);
 const queue:number[]=[];
 for(const index of matched)if(!seen[index]){seen[index]=1;queue.push(index);}
 // Flood-fill only the connected border-colored region, not identical colors
 // surrounded by an independently colored subject.
 for(let head=0;head<queue.length;head++){
  const index=queue[head],x=index%width,y=Math.floor(index/width);
  for(const next of [x>left?index-1:-1,x<right-1?index+1:-1,
   y>top?index-width:-1,y<bottom-1?index+width:-1]){
   if(next>=0&&!seen[next]&&isBackground(next)){
    seen[next]=1;queue.push(next);
   }
  }
 }
 let visible=0,foreground=0;
 for(let y=top;y<bottom;y++)for(let x=left;x<right;x++){
  const index=y*width+x;
  if(pixels[index*4+3]>=128){visible++;if(!seen[index])foreground++;}
 }
 // A solid-color picture has no subject to isolate; preserve its original palette.
 if(queue.length<visible*.2||foreground<Math.max(3,visible*.005))return weights;
 for(const index of queue)weights[index]=0;
 return weights;
}

function clusters(pixels:Uint8ClampedArray,max=8,pixelWeights?:Float32Array):{color:RGB;weight:number}[]{
 const bins=new Map<number,Bucket>();
 for(let i=0;i+3<pixels.length;i+=4){
  const coverage=pixels[i+3]/255;
  if(coverage<.5)continue;
  const alpha=coverage*(pixelWeights?.[i/4]??1);
  if(alpha<=0)continue;
  const r=pixels[i],g=pixels[i+1],b=pixels[i+2];
  // 4-bit RGB histogram removes pixel-level noise before weighted k-means.
  const key=((r>>4)<<8)|((g>>4)<<4)|(b>>4);
  const cell=bins.get(key);
  if(cell){cell.r+=r*alpha;cell.g+=g*alpha;cell.b+=b*alpha;cell.weight+=alpha;}
  else bins.set(key,{key,r:r*alpha,g:g*alpha,b:b*alpha,weight:alpha});
 }
 if(!bins.size)throw new Error('画像に解析できる不透明なピクセルがありません。');
 const entries=[...bins.values()].map(b=>({...b,r:b.r/b.weight,g:b.g/b.weight,b:b.b/b.weight}))
  .sort((a,b)=>b.weight-a.weight||a.key-b.key);
 const total=entries.reduce((sum,e)=>sum+e.weight,0);
 const seeds:RGB[]=[entries[0]];
 const size=Math.min(max,entries.length);
 while(seeds.length<size){
  const candidate=entries.filter(e=>seeds.every(s=>dist(s,e)>16))
   .map(e=>({e,score:Math.min(...seeds.map(s=>dist(s,e)))*Math.sqrt(e.weight/total)}))
   .sort((a,b)=>b.score-a.score||a.e.key-b.e.key)[0];
  if(!candidate)break;
  seeds.push(candidate.e);
 }
 for(let iteration=0;iteration<9;iteration++){
  const sums=seeds.map(()=>({r:0,g:0,b:0,weight:0}));
  for(const item of entries){
   let index=0,min=Infinity;
   for(let j=0;j<seeds.length;j++){const d=dist(item,seeds[j]);if(d<min){min=d;index=j;}}
   const v=sums[index];
   v.r+=item.r*item.weight;v.g+=item.g*item.weight;v.b+=item.b*item.weight;v.weight+=item.weight;
  }
  for(let j=0;j<seeds.length;j++)if(sums[j].weight){
   seeds[j]={r:sums[j].r/sums[j].weight,g:sums[j].g/sums[j].weight,b:sums[j].b/sums[j].weight};
  }
 }
 const sums=seeds.map(()=>({r:0,g:0,b:0,weight:0}));
 for(const item of entries){
  let index=0,min=Infinity;
  for(let j=0;j<seeds.length;j++){const d=dist(item,seeds[j]);if(d<min){min=d;index=j;}}
  const v=sums[index];v.r+=item.r*item.weight;v.g+=item.g*item.weight;v.b+=item.b*item.weight;v.weight+=item.weight;
 }
 return sums.filter(v=>v.weight>=total*.008)
  .map(v=>({color:{r:v.r/v.weight,g:v.g/v.weight,b:v.b/v.weight},weight:v.weight}))
  .sort((a,b)=>b.weight-a.weight);
}

/** 5–8 visual swatches, a dominant background, and readable figure colors. */
export function extractImagePalette(pixels:Uint8ClampedArray,options?:ImagePaletteOptions):ImagePalette{
 if(pixels.length%4!==0||pixels.length===0)throw new Error('画像データが正しくありません。');
 const found=clusters(pixels,8,paletteWeights(pixels,options));
 const selected:RGB[]=[];
 for(const item of found)if(selected.every(c=>dist(c,item.color)>1000))selected.push(item.color);
 const dominant=found[0].color;
 const shades=[mix(dominant,white,.35),mix(dominant,black,.3),
  mix(dominant,white,.65),mix(dominant,black,.55),
  mix(dominant,white,.15),mix(dominant,black,.75),white,black];
 for(const shade of shades){
  if(selected.length>=8)break;
  if(selected.every(c=>dist(c,shade)>300))selected.push(shade);
 }
 const swatches=selected.slice(0,8).map(hex);
 const secondary=found.slice(1).find(e=>dist(e.color,dominant)>900)?.color??mix(dominant,luminance(dominant)>.45?black:white,.36);
 const tertiary=found.slice(2).find(e=>dist(e.color,secondary)>900)?.color??mix(secondary,luminance(dominant)>.45?black:white,.3);
 // Select the ink from the actual dominant pixel first. A gradient spanning
 // both dark and light backgrounds can make *every* figure color unreadable.
 // Limit later stops to a brightness range compatible with the selected ink.
 const ink=contrastRatio(hex(white),hex(dominant))>=contrastRatio(hex(black),hex(dominant))?white:black;
 function readableStop(target:RGB,amount:number){
  let t=amount;
  while(t>.001&&contrastRatio(hex(ink),hex(mix(dominant,target,t)))<4.55)t*=.65;
  return hex(mix(dominant,target,t));
 }
 const gradient:[string,string,string]=[
  hex(dominant),readableStop(secondary,.48),readableStop(tertiary,.4)
 ];
 // If the source lacks high-contrast colors, brighten/darken its actual hues
 // rather than letting the selected strokes disappear into the backdrop.
 const minContrast=(c:RGB)=>Math.min(...gradient.map(bg=>contrastRatio(hex(c),bg)));
 const figures:RGB[]=[];
 const candidates=selected.slice(1).concat([selected[0],secondary,tertiary]);
 for(const candidate of candidates){
  let safe=candidate;
  for(let t=0;minContrast(safe)<4.5&&t<=1;t+=.05)safe=mix(candidate,ink,Math.min(1,t+.05));
  if(minContrast(safe)>=4.5&&figures.every(c=>dist(c,safe)>2800))figures.push(safe);
  if(figures.length===3)break;
 }
 // Monochrome images still get three clearly visible shape accents.
 for(const base of [dominant,secondary,tertiary]){
  if(figures.length>=3)break;
  for(const tint of [.3,.55,.8,1]){
   const candidate=mix(base,ink,tint);
   if(minContrast(candidate)>=4.5&&figures.every(c=>dist(c,candidate)>180)) {figures.push(candidate);break;}
  }
 }
 while(figures.length<3)figures.push(ink);
 return{swatches,solid:hex(dominant),gradient,figures:figures.slice(0,3).map(hex) as [string,string,string]};
}

/** Respect individually locked slots; switch to manual so imported colors
 * remain stable even if the user changes the seed later. */
export function applyImagePalette(settings:ColorSettings,palette:ImagePalette,scope:PaletteScope):ColorSettings{
 const proposed:Record<Slot,string>={
  solid:palette.solid,gradient0:palette.gradient[0],gradient1:palette.gradient[1],gradient2:palette.gradient[2],
  primary:palette.figures[0],support:palette.figures[1],accent:palette.figures[2]
 };
 const background=new Set<Slot>(['solid','gradient0','gradient1','gradient2']);
 const apply=(id:Slot)=>scope==='all'||(scope==='background'?background.has(id):!background.has(id));
 return{
  ...settings,mode:'manual',edited:[...SLOTS],
  slots:Object.fromEntries(SLOTS.map(id=>[id,{
   ...settings.slots[id],
   color:apply(id)&&!settings.slots[id].locked?proposed[id]:settings.slots[id].color
  }])) as ColorSettings['slots']
 };
}
