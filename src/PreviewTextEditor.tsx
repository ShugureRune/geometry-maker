import {useEffect,useRef,useState,type PointerEvent as ReactPointerEvent,type ReactNode} from 'react';
import type {TextOverlaySettings} from './text-overlay';

type Point={x:number;y:number};
type Drag={id:number;svg:SVGSVGElement;screen:Point;start:Point;original:Point;moved:boolean};

/** Coordinates are converted through the SVG screen CTM, so dragging remains
 * correct for portrait, ultrawide, resized and letterboxed previews. */
export function movedTextPosition(origin:Point,start:Point,current:Point,dimensions:{width:number;height:number}):Point{
 const bound=(n:number)=>Math.round(Math.max(0,Math.min(100,n))*10)/10;
 return{
  x:bound(origin.x+(current.x-start.x)*100/dimensions.width),
  y:bound(origin.y+(current.y-start.y)*100/dimensions.height)
 };
}
function svgPoint(svg:SVGSVGElement,client:Point):Point|null{
 const matrix=svg.getScreenCTM();
 if(!matrix)return null;
 const p=new DOMPoint(client.x,client.y).matrixTransform(matrix.inverse());
 return{x:p.x,y:p.y};
}

type Props={children:ReactNode;settings:TextOverlaySettings;onChange:(settings:TextOverlaySettings)=>void;onAdvanced:()=>void};
export function PreviewTextEditor({children,settings,onChange,onAdvanced}:Props){
 const drag=useRef<Drag|null>(null);
 const textInput=useRef<HTMLTextAreaElement>(null);
 const [editing,setEditing]=useState(false);
 const [moving,setMoving]=useState(false);

 useEffect(()=>{if(editing)textInput.current?.focus();},[editing]);
 function openEditor(){
  if(!settings.enabled)onChange({...settings,enabled:true});
  setEditing(true);
 }
 function down(event:ReactPointerEvent<HTMLDivElement>){
  if(!settings.enabled||!settings.text.trim()||event.button!==0||!event.isPrimary)return;
  const target=event.target;
  if(!(target instanceof Element)||!target.closest('[data-testid="text-overlay"]'))return;
  const svg=target.closest('svg');
  if(!(svg instanceof SVGSVGElement))return;
  const screen={x:event.clientX,y:event.clientY},start=svgPoint(svg,screen);
  if(!start)return;
  drag.current={id:event.pointerId,svg,screen,start,original:{x:settings.x,y:settings.y},moved:false};
  event.currentTarget.setPointerCapture(event.pointerId);
  event.preventDefault();
 }
 function move(event:ReactPointerEvent<HTMLDivElement>){
  const active=drag.current;
  if(!active||active.id!==event.pointerId)return;
  const distance=Math.hypot(event.clientX-active.screen.x,event.clientY-active.screen.y);
  if(!active.moved&&distance<5)return;
  active.moved=true;setMoving(true);
  const point=svgPoint(active.svg,{x:event.clientX,y:event.clientY});
  const box=active.svg.viewBox.baseVal;
  if(!point||box.width<=0||box.height<=0)return;
  const position=movedTextPosition(active.original,active.start,point,box);
  onChange({...settings,...position});
  event.preventDefault();
 }
 function finish(event:ReactPointerEvent<HTMLDivElement>,cancel=false){
  const active=drag.current;
  if(!active||active.id!==event.pointerId)return;
  drag.current=null;setMoving(false);
  if(event.currentTarget.hasPointerCapture(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId);
  if(!cancel&&!active.moved)setEditing(true);
 }
 function setValue<K extends keyof TextOverlaySettings>(key:K,value:TextOverlaySettings[K]){
  onChange({...settings,[key]:value});
 }
 function setText(value:string){
  setValue('text',value.slice(0,2000).split('\n').slice(0,12).join('\n'));
 }
 return <div className={`preview-text-interaction${moving?' is-moving':''}`} data-testid="preview-text-interaction"
  onPointerDown={down} onPointerMove={move} onPointerUp={e=>finish(e)}
  onPointerCancel={e=>finish(e,true)} onLostPointerCapture={()=>{drag.current=null;setMoving(false);}}>
  {children}
  <button type="button" className="preview-text-launch" onClick={openEditor}
   aria-label={settings.enabled?'プレビューから文字を編集':'プレビューに文字を追加'}>
   {settings.enabled?'✎ 文字を編集':'+ 文字を追加'}
  </button>
  {editing&&<section className="preview-text-popover" role="group" aria-label="プレビュー上で文字を編集">
   <div className="preview-text-popover-head"><strong>文字を直接編集</strong>
    <button type="button" aria-label="プレビュー文字編集を閉じる" onClick={()=>setEditing(false)}>×</button>
   </div>
   <label htmlFor="preview-text-content">文字の内容</label>
   <textarea id="preview-text-content" ref={textInput} rows={2} maxLength={2000}
    value={settings.text} onChange={e=>setText(e.target.value)}
    onKeyDown={e=>{if(e.key==='Escape'||(e.key==='Enter'&&(e.ctrlKey||e.metaKey)))setEditing(false);}}/>
   <div className="preview-text-quick-row">
    <label htmlFor="preview-text-size">サイズ
     <input id="preview-text-size" type="range" min="12" max="250" value={settings.fontSize}
      onChange={e=>setValue('fontSize',Number(e.target.value))}/>
    </label>
    <output htmlFor="preview-text-size">{settings.fontSize}</output>
    <label htmlFor="preview-text-color">文字色
     <input id="preview-text-color" type="color" value={settings.color}
      onChange={e=>onChange({...settings,colorMode:'solid',color:e.target.value})}/>
    </label>
   </div>
   <div className="preview-text-popover-actions">
    <button type="button" onClick={()=>{onAdvanced();setEditing(false);}}>詳細設定</button>
    <button type="button" onClick={()=>setEditing(false)}>編集を終了</button>
   </div>
   <p>文字をドラッグして移動。位置・内容は書き出しにも反映されます。</p>
  </section>}
 </div>;
}
