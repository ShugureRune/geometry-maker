import {useRef,useState,type PointerEvent as ReactPointerEvent} from 'react';
import {extractImagePalette,type ImagePalette,type PaletteScope,type PaletteFocus} from './image-palette';

const MAX_IMAGE_BYTES=12*1024*1024;
const MAX_IMAGE_PIXELS=24_000_000;
const PREVIEW_SIZE=128;
const accepted=new Set(['image/png','image/jpeg','image/webp','image/gif','image/avif','image/bmp','image/heic','image/heif']);

type Sample={pixels:Uint8ClampedArray;width:number;height:number;preview:string};
type Crop={x:number;y:number;width:number;height:number};
async function sampleImage(file:File):Promise<Sample>{
 if(!accepted.has(file.type.toLowerCase()))throw new Error('PNG・JPEG・WebP・GIF・AVIFなどの画像を選択してください。SVGは対応していません。');
 if(file.size>MAX_IMAGE_BYTES)throw new Error('画像は12MB以下を選択してください。');
 const url=URL.createObjectURL(file);
 try{
  const img=new Image();
  img.src=url;
  await img.decode();
  const width=img.naturalWidth,height=img.naturalHeight;
  if(!width||!height||width*height>MAX_IMAGE_PIXELS||width>12000||height>12000)
   throw new Error('画像が大きすぎます。2400万画素以下の画像を選択してください。');
  const canvas=document.createElement('canvas');
  const scale=Math.min(PREVIEW_SIZE/width,PREVIEW_SIZE/height,1);
  canvas.width=Math.max(1,Math.round(width*scale));
  canvas.height=Math.max(1,Math.round(height*scale));
  const context=canvas.getContext('2d',{willReadFrequently:true});
  if(!context)throw new Error('このブラウザでは画像の色を取得できません。');
  context.drawImage(img,0,0,canvas.width,canvas.height);
  const pixels=context.getImageData(0,0,canvas.width,canvas.height).data;
  return{pixels,width:canvas.width,height:canvas.height,preview:canvas.toDataURL('image/png')};
 }finally{URL.revokeObjectURL(url);}
}
function ColorChips({colors,label}:{colors:readonly string[];label:string}){
 return <div className="image-palette-color-row" aria-label={label}>
  {colors.map((color,index)=><div className="image-palette-chip" key={index} title={color}>
   <span style={{backgroundColor:color}} aria-label={color}/>
   <code>{color.toUpperCase()}</code>
  </div>)}
 </div>;
}

export function ImagePaletteControls({onApply}:{onApply:(palette:ImagePalette,scope:PaletteScope)=>void}){
 const [palette,setPalette]=useState<ImagePalette>();
 const [preview,setPreview]=useState('');
 const [name,setName]=useState('');
 const [error,setError]=useState('');
 const [working,setWorking]=useState(false);
 const [notice,setNotice]=useState('');
 const [focus,setFocus]=useState<PaletteFocus|'area'>('subject');
 const [crop,setCrop]=useState<Crop>({x:.2,y:.15,width:.6,height:.7});
 const sampleRef=useRef<Sample|null>(null);
 const dragRef=useRef<{x:number;y:number}|null>(null);
 const fileRef=useRef<File|null>(null);
 const request=useRef(0);
 function extract(sample:Sample,nextFocus:PaletteFocus|'area',nextCrop=crop){
  return extractImagePalette(sample.pixels,{width:sample.width,
   focus:nextFocus==='area'?'all':nextFocus,crop:nextFocus==='area'?nextCrop:undefined});
 }
 function reextract(nextFocus:PaletteFocus|'area',nextCrop=crop){
  if(!sampleRef.current)return;
  try{
   setPalette(extract(sampleRef.current,nextFocus,nextCrop));
   setError('');setNotice('抽出方法を反映しました。適用範囲を選択してください。');
  }catch(e){setError(e instanceof Error?e.message:'画像を解析できませんでした。');}
 }
 function position(e:ReactPointerEvent<HTMLDivElement>){
  const bounds=e.currentTarget.getBoundingClientRect();
  return{x:Math.max(0,Math.min(1,(e.clientX-bounds.left)/bounds.width)),
   y:Math.max(0,Math.min(1,(e.clientY-bounds.top)/bounds.height))};
 }
 function selectedCrop(a:{x:number;y:number},b:{x:number;y:number}):Crop{
  if(Math.abs(a.x-b.x)<.025&&Math.abs(a.y-b.y)<.025)
   return{x:Math.max(0,Math.min(.6,b.x-.2)),y:Math.max(0,Math.min(.6,b.y-.2)),width:.4,height:.4};
  const x=Math.min(a.x,b.x),y=Math.min(a.y,b.y);
  return{x,y,width:Math.max(.01,Math.abs(a.x-b.x)),height:Math.max(.01,Math.abs(a.y-b.y))};
 }
 function startSelection(e:ReactPointerEvent<HTMLDivElement>){
  e.currentTarget.setPointerCapture(e.pointerId);
  dragRef.current=position(e);
 }
 function moveSelection(e:ReactPointerEvent<HTMLDivElement>){
  if(dragRef.current)setCrop(selectedCrop(dragRef.current,position(e)));
 }
 function finishSelection(e:ReactPointerEvent<HTMLDivElement>){
  if(!dragRef.current)return;
  const next=selectedCrop(dragRef.current,position(e));
  dragRef.current=null;setCrop(next);reextract('area',next);
 }

 async function analyze(file:File){
  const id=++request.current;
  setError('');setNotice('');setWorking(true);setPalette(undefined);
  try{
   const sample=await sampleImage(file);
   if(id!==request.current)return;
   const colors=extract(sample,focus);
   sampleRef.current=sample;
   fileRef.current=file;setName(file.name);setPalette(colors);setPreview(sample.preview);
   setNotice('色を抽出しました。適用範囲を選択してください。');
  }catch(e){
   if(id!==request.current)return;
   sampleRef.current=null;fileRef.current=null;setName('');setPreview('');
   setError(e instanceof Error?e.message:'画像を読み取れませんでした。別の画像でお試しください。');
  }finally{if(id===request.current)setWorking(false);}
 }
 function apply(scope:PaletteScope){
  if(!palette)return;
  onApply(palette,scope);
  setNotice(`${scope==='all'?'背景と図形':scope==='background'?'背景':'図形'}に配色を反映しました。固定中の色は維持します。`);
 }
 return <section className="control-section image-palette-controls" aria-labelledby="image-palette-heading">
  <div className="section-heading">
   <h3 id="image-palette-heading">画像から配色</h3><span className="tiny-label">IMAGE PALETTE</span>
  </div>
  <p className="help">写真・イラストから色を抽出します。主役優先では画像の端につながる背景を自動的に抑えます。</p>
  <label htmlFor="image-palette-file" className="image-palette-upload-label">画像を選択</label>
  <input id="image-palette-file" type="file" accept="image/png,image/jpeg,image/webp,image/gif,image/avif,image/bmp,image/heic,image/heif"
   disabled={working} onChange={e=>{const file=e.target.files?.[0];e.target.value='';if(file)void analyze(file);}}/>
  <p className="help">最大12MB・2400万画素。処理はこの端末内だけで完結し、画像は送信しません。</p>
  <label htmlFor="image-palette-focus">色を抽出する対象</label>
  <select id="image-palette-focus" value={focus} disabled={working} onChange={e=>{
   const next=e.target.value as PaletteFocus|'area';setFocus(next);reextract(next);
  }}>
   <option value="subject">主役優先（おすすめ・背景を抑える）</option>
   <option value="center">中央優先（背景が複雑な画像向け）</option>
   <option value="area">範囲を選択（好きな部分だけ）</option>
   <option value="all">画像全体（従来どおり）</option>
  </select>
  <p className="help">背景が残るときは「範囲を選択」が確実です。選び直してもシードは変わりません。</p>
  {working&&<p role="status" className="help">画像を解析中…</p>}
  {error&&<p role="alert" className="image-palette-error">{error}</p>}
  {palette&&<div className="image-palette-result">
   <div className="image-palette-source">
    <img alt="選択した画像の縮小プレビュー" src={preview}/>
    <div><strong title={name}>{name}</strong><span>代表色 {palette.swatches.length}色</span></div>
   </div>
   {focus==='area'&&<div className="image-palette-selection">
    <p className="help">画像の取り込みたい部分を指やマウスで囲んでください。タップだけでも範囲を移動できます。</p>
    <div className="image-palette-pick-area" role="group" aria-label="色を抽出する画像範囲"
     style={{aspectRatio:(sampleRef.current?.width??1)+' / '+(sampleRef.current?.height??1)}}
     onPointerDown={startSelection} onPointerMove={moveSelection}
     onPointerUp={finishSelection} onPointerCancel={()=>{dragRef.current=null;}}>
     <img src={preview} alt="抽出範囲を指定する画像" draggable={false}/>
     <div className="image-palette-selection-rect" style={{left:(crop.x*100)+'%',top:(crop.y*100)+'%',
      width:(crop.width*100)+'%',height:(crop.height*100)+'%'}}/>
    </div>
    <button type="button" className="image-palette-reset-area" onClick={()=>{
     const whole={x:0,y:0,width:1,height:1};setCrop(whole);reextract('area',whole);
    }}>範囲を全体に戻す</button>
   </div>}
   <p className="image-palette-label">画像の代表色</p>
   <ColorChips colors={palette.swatches} label="抽出された代表色"/>
   <p className="image-palette-label">おすすめ背景（単色・グラデーション）</p>
   <ColorChips colors={palette.gradient} label="おすすめ背景色"/>
   <p className="image-palette-label">おすすめ図形色（主役・補助・アクセント）</p>
   <ColorChips colors={palette.figures} label="おすすめ図形色"/>
   <div className="image-palette-actions">
    <button type="button" onClick={()=>apply('all')}>全部に適用</button>
    <button type="button" onClick={()=>apply('background')}>背景だけ</button>
    <button type="button" onClick={()=>apply('figures')}>図形だけ</button>
    <button type="button" disabled={working} onClick={()=>{if(sampleRef.current)reextract(focus);}}>抽出し直す</button>
   </div>
   <p className="help">シード・図形配置・発光の設定は変更しません。ロックした色は上書きしません。背景の単色・グラデーション切り替えは「背景」タブで選べます。</p>
  </div>}
  {notice&&<p className="image-palette-notice" role="status">{notice}</p>}
 </section>;
}
