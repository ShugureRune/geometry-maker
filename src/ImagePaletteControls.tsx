import {useRef,useState} from 'react';
import {extractImagePalette,type ImagePalette,type PaletteScope} from './image-palette';

const MAX_IMAGE_BYTES=12*1024*1024;
const MAX_IMAGE_PIXELS=24_000_000;
const PREVIEW_SIZE=128;
const accepted=new Set(['image/png','image/jpeg','image/webp','image/gif','image/avif','image/bmp','image/heic','image/heif']);

async function sampleImage(file:File):Promise<{pixels:Uint8ClampedArray;preview:string}>{
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
  return{pixels,preview:canvas.toDataURL('image/png')};
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
 const fileRef=useRef<File|null>(null);
 const request=useRef(0);
 async function analyze(file:File){
  const id=++request.current;
  setError('');setNotice('');setWorking(true);setPalette(undefined);
  try{
   const {pixels,preview:thumb}=await sampleImage(file);
   const colors=extractImagePalette(pixels);
   if(id!==request.current)return;
   fileRef.current=file;setName(file.name);setPalette(colors);setPreview(thumb);
   setNotice('色を抽出しました。適用範囲を選択してください。');
  }catch(e){
   if(id!==request.current)return;
   fileRef.current=null;setName('');setPreview('');
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
  <p className="help">写真・イラストを選ぶと、よく使われている色を抽出し、背景と図形のおすすめ配色を作ります。</p>
  <label htmlFor="image-palette-file" className="image-palette-upload-label">画像を選択</label>
  <input id="image-palette-file" type="file" accept="image/png,image/jpeg,image/webp,image/gif,image/avif,image/bmp,image/heic,image/heif"
   disabled={working} onChange={e=>{const file=e.target.files?.[0];e.target.value='';if(file)void analyze(file);}}/>
  <p className="help">最大12MB・2400万画素。処理はこの端末内だけで完結し、画像は送信しません。</p>
  {working&&<p role="status" className="help">画像を解析中…</p>}
  {error&&<p role="alert" className="image-palette-error">{error}</p>}
  {palette&&<div className="image-palette-result">
   <div className="image-palette-source">
    <img alt="選択した画像の縮小プレビュー" src={preview}/>
    <div><strong title={name}>{name}</strong><span>代表色 {palette.swatches.length}色</span></div>
   </div>
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
    <button type="button" disabled={working} onClick={()=>{if(fileRef.current)void analyze(fileRef.current);}}>抽出し直す</button>
   </div>
   <p className="help">シード・図形配置・発光の設定は変更しません。ロックした色は上書きしません。背景の単色・グラデーション切り替えは「背景」タブで選べます。</p>
  </div>}
  {notice&&<p className="image-palette-notice" role="status">{notice}</p>}
 </section>;
}
