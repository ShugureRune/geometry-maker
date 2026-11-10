import {useEffect,useLayoutEffect,useRef,useState,type PointerEvent as ReactPointerEvent,type ReactNode} from 'react';
import type {TextOverlaySettings} from './text-overlay';
import {centerSnap,clamp,normalizeDegrees,resizeTextCorner,rotateTextAroundCenter,rotateTextToAngle,tenth,type CanvasPoint} from './preview-text-transform';

type Point=CanvasPoint;
type Handle='move'|'resize-nw'|'resize-ne'|'resize-se'|'resize-sw'|'rotate';
type Corners=[Point,Point,Point,Point];
type Frame={
  quad:Corners;view:{x:number;y:number;width:number;height:number};
  layout:{left:number;top:number;width:number;height:number};
  unit:number; inline:{left:number;top:number;width:number};
};
type Measured={text:SVGGraphicsElement;reference:SVGSVGElement;root:SVGSVGElement;local:Corners;center:Point;frame:Frame};
type Session={
 id:number;mode:Handle;reference:SVGSVGElement;settings:TextOverlaySettings;
 start:Point;screen:Point;corners:Corners;center:Point;origin:Point;
 moved:boolean;auto:boolean;timeout:number|null;animation:number|null;
};
type Props={children:ReactNode;settings:TextOverlaySettings;onChange:(settings:TextOverlaySettings)=>void;onAdvanced:()=>void};

const corners=['resize-nw','resize-ne','resize-se','resize-sw'] as const;
const opposite=[2,3,0,1] as const;
const handleNames=['左上','右上','右下','左下'];
const average=(a:Point,b:Point):Point=>({x:(a.x+b.x)/2,y:(a.y+b.y)/2});
const clientToSvg=(svg:SVGSVGElement,p:Point):Point|null=>{
 const matrix=svg.getScreenCTM();
 if(!matrix)return null;
 try{const q=new DOMPoint(p.x,p.y).matrixTransform(matrix.inverse());return{x:q.x,y:q.y};}catch{return null;}
};
function convertPoints(text:SVGGraphicsElement,svg:SVGSVGElement):Corners|null{
 const from=text.getScreenCTM(),to=svg.getScreenCTM();
 if(!from||!to)return null;
 let matrix:DOMMatrix;
 try{matrix=to.inverse().multiply(from);}catch{return null;}
 const bbox=text.getBBox();
 if(!bbox.width||!bbox.height)return null;
 const points:[[number,number],[number,number],[number,number],[number,number]]=[
  [bbox.x,bbox.y],[bbox.x+bbox.width,bbox.y],[bbox.x+bbox.width,bbox.y+bbox.height],[bbox.x,bbox.y+bbox.height]
 ];
 return points.map(([x,y])=>{const q=new DOMPoint(x,y).matrixTransform(matrix);return{x:q.x,y:q.y};}) as Corners;
}
const currentLine=(points:Corners)=>points.map(p=>p.x+','+p.y).join(' ');
const round=(value:number)=>Math.round(value*10)/10;

/** Keep the old helper public for existing coordinate/seed regression tests. */
export function movedTextPosition(origin:Point,start:Point,current:Point,dimensions:{width:number;height:number}):Point{
 return{
  x:tenth(clamp(origin.x+(current.x-start.x)*100/dimensions.width,0,100)),
  y:tenth(clamp(origin.y+(current.y-start.y)*100/dimensions.height,0,100))
 };
}

export function PreviewTextEditor({children,settings,onChange,onAdvanced}:Props){
 const wrapper=useRef<HTMLDivElement>(null);
 const picked=useRef<SVGGraphicsElement|null>(null);
 const frameRef=useRef<Measured|null>(null);
 const active=useRef<Session|null>(null);
 const settingsRef=useRef(settings);
 settingsRef.current=settings;
 const [frame,setFrame]=useState<Frame|null>(null);
 const [selected,setSelected]=useState(false);
 const [quick,setQuick]=useState(false);
 const [inline,setInline]=useState(false);
 const [draft,setDraft]=useState('');
 const [transforming,setTransforming]=useState(false);
 const [guides,setGuides]=useState({x:false,y:false});
 const input=useRef<HTMLTextAreaElement>(null);
 const lastTap=useRef<{at:number;screen:Point}|null>(null);

 function measure():Measured|null{
  const host=wrapper.current;
  if(!host)return null;
  let glyph=picked.current;
  if(!glyph?.isConnected)glyph=host.querySelector<SVGGraphicsElement>('.canvas-frame [data-testid="text-overlay"] > text');
  const root=host.querySelector<SVGSVGElement>('.canvas-frame .ambient-stage > svg.artwork, .canvas-frame > svg.artwork');
  const reference=glyph?.closest('svg');
  if(!glyph||!(reference instanceof SVGSVGElement)||!root)return null;
  let local:Corners|null,quad:Corners|null;
  try{local=convertPoints(glyph,reference);quad=convertPoints(glyph,root);}catch{return null;}
  if(!local||!quad)return null;
  const rect=root.getBoundingClientRect(),wrap=host.getBoundingClientRect();
  const view=root.viewBox.baseVal;
  if(view.width<=0||view.height<=0||rect.width<=0||rect.height<=0)return null;
  const localCenter=average(average(local[0],local[2]),average(local[1],local[3]));
  const xs=quad.map(p=>p.x),ys=quad.map(p=>p.y);
  const minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys);
  const scale=rect.width/view.width;
  const textLeft=(minX-view.x)*scale+rect.left-wrap.left;
  const textTop=(minY-view.y)*scale+rect.top-wrap.top;
  const width=(maxX-minX)*scale;
  const insetWidth=Math.min(Math.max(190,width+24),Math.max(160,wrap.width-12));
  const layout={left:rect.left-wrap.left,top:rect.top-wrap.top,width:rect.width,height:rect.height};
  const f:Frame={
   quad,view:{x:view.x,y:view.y,width:view.width,height:view.height},
   layout,unit:Math.max(2,14/scale),
   inline:{left:clamp(textLeft,4,Math.max(4,wrap.width-insetWidth-4)),
    top:clamp(textTop,4,Math.max(4,wrap.height-72)),width:insetWidth}
  };
  const measured={text:glyph,reference,root,local,center:localCenter,frame:f};
  frameRef.current=measured;
  return measured;
 }
 function refresh(){
  const m=measure();
  if(!m)return;
  setFrame(old=>{
   const a=old?JSON.stringify(old,(_k,v)=>typeof v==='number'?round(v):v):'';
   const b=JSON.stringify(m.frame,(_k,v)=>typeof v==='number'?round(v):v);
   return a===b?old:m.frame;
  });
 }
 useLayoutEffect(()=>{
  if(!selected||!settings.enabled||!settings.text.trim()){setFrame(null);return;}
  let raf=0,live=true;
  const update=()=>{if(!live)return;refresh();raf=requestAnimationFrame(update);};
  update();
  return()=>{live=false;cancelAnimationFrame(raf);};
 },[selected,settings]);

 useEffect(()=>{if(inline)input.current?.focus();},[inline]);
 useEffect(()=>{if(!settings.enabled){setSelected(false);setQuick(false);setInline(false);}},[settings.enabled]);
 function openInline(){
  if(!settingsRef.current.enabled)return;
  setSelected(true);setQuick(false);setDraft(settingsRef.current.text);setInline(true);
 }
 function saveInline(){
  if(!inline)return;
  const text=draft.slice(0,2000).split('\n').slice(0,12).join('\n');
  onChange({...settingsRef.current,text});setInline(false);
 }
 function cancelInline(){setInline(false);setDraft(settingsRef.current.text);}
 function openQuick(){
  if(!settingsRef.current.enabled)onChange({...settingsRef.current,enabled:true});
  setSelected(true);setInline(false);setQuick(true);
 }
 function apply(patch:Partial<TextOverlaySettings>){
  onChange({...settingsRef.current,...patch});
 }
 function cleanup(){
  const session=active.current;
  if(session?.timeout!==null&&session?.timeout!==undefined)clearTimeout(session.timeout);
  if(session?.animation!==null&&session?.animation!==undefined)cancelAnimationFrame(session.animation);
  active.current=null;setTransforming(false);setGuides({x:false,y:false});
 }
 useEffect(()=>()=>cleanup(),[]);

 function begin(event:ReactPointerEvent<HTMLDivElement>){
  if(event.button!==0||!event.isPrimary||inline)return;
  const target=event.target;
  if(!(target instanceof Element))return;
  if(target.closest('button,textarea,input,select,.preview-text-popover,.preview-text-selection-tools'))return;
  const rawHandle=target.closest('[data-handle]')?.getAttribute('data-handle');
  const mode=(rawHandle&&(['move','resize-nw','resize-ne','resize-se','resize-sw','rotate'] as string[]).includes(rawHandle))
   ?rawHandle as Handle:null;
  const group=target.closest('[data-testid="text-overlay"]');
  if(!mode&&!group){
   if(target.closest('.canvas-frame, .preview-text-selection')){
    setSelected(false);setQuick(false);lastTap.current=null;
   }
   return;
  }
  if(!settingsRef.current.enabled)return;
  if(group){
   const glyph=group.querySelector<SVGGraphicsElement>(':scope > text');
   if(glyph)picked.current=glyph;
  }
  const m=measure();
  if(!m)return;
  const screen={x:event.clientX,y:event.clientY},start=clientToSvg(m.reference,screen);
  if(!start)return;
  setSelected(true);setQuick(false);
  const settings0={...settingsRef.current};
  const session:Session={id:event.pointerId,mode:mode??'move',reference:m.reference,settings:settings0,
   start,screen,corners:m.local,center:m.center,
   origin:{x:settings0.x*m.reference.viewBox.baseVal.width/100,y:settings0.y*m.reference.viewBox.baseVal.height/100},
   moved:false,auto:false,timeout:null,animation:null};
  active.current=session;
  if(session.mode==='rotate'){
   // A stationary press spins continuously; dragging controls the angle manually.
   session.timeout=window.setTimeout(()=>{
    if(active.current!==session||session.moved)return;
    session.auto=true;setTransforming(true);
    const begun=performance.now();
    const tick=(now:number)=>{
     if(active.current!==session||!session.auto)return;
     const result=rotateTextToAngle({
      origin:session.origin,center:session.center,startRotation:session.settings.rotation,
      degrees:normalizeDegrees(session.settings.rotation+(now-begun)*.075),
      canvas:session.reference.viewBox.baseVal
     });
     apply(result);
     session.animation=requestAnimationFrame(tick);
    };
    session.animation=requestAnimationFrame(tick);
   },420);
  }
  event.currentTarget.setPointerCapture(event.pointerId);
  event.preventDefault();
 }
 function move(event:ReactPointerEvent<HTMLDivElement>){
  const session=active.current;
  if(!session||session.id!==event.pointerId)return;
  const screen={x:event.clientX,y:event.clientY};
  if(!session.moved&&Math.hypot(screen.x-session.screen.x,screen.y-session.screen.y)<5)return;
  if(session.auto)return;
  if(session.timeout!==null){clearTimeout(session.timeout);session.timeout=null;}
  session.moved=true;setTransforming(true);
  const now=clientToSvg(session.reference,screen);
  if(!now)return;
  const view=session.reference.viewBox.baseVal;
  if(view.width<=0||view.height<=0)return;
  if(session.mode==='move'){
   const pos=movedTextPosition(session.settings,session.start,now,view);
   const next=centerSnap(pos);
   setGuides({x:next.snapX,y:next.snapY});apply(next.position);
  }else if(session.mode==='rotate'){
   apply(rotateTextAroundCenter({origin:session.origin,center:session.center,
    startRotation:session.settings.rotation,startPointer:session.start,pointer:now,canvas:view}));
  }else{
   const index=(corners as readonly string[]).indexOf(session.mode);
   if(index<0)return;
   apply(resizeTextCorner({handle:session.corners[index],opposite:session.corners[opposite[index]],
    origin:session.origin,fontSize:session.settings.fontSize,canvas:view},now));
  }
  event.preventDefault();
 }
 function end(event:ReactPointerEvent<HTMLDivElement>,cancel=false){
  const session=active.current;
  if(!session||session.id!==event.pointerId)return;
  const tapped=!cancel&&!session.moved&&!session.auto&&session.mode==='move';
  cleanup();
  if(event.currentTarget.hasPointerCapture(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId);
  if(tapped){
   const last=lastTap.current,now={x:event.clientX,y:event.clientY};
   if(last&&event.timeStamp-last.at<360&&Math.hypot(last.screen.x-now.x,last.screen.y-now.y)<22){
    lastTap.current=null;openInline();
   }else lastTap.current={at:event.timeStamp,screen:now};
  }else lastTap.current=null;
 }
 function keyboard(event:KeyboardEvent){
  if(!selected||inline||quick||!settingsRef.current.enabled)return;
  const el=event.target;
  if(el instanceof HTMLElement&&(el.isContentEditable||['INPUT','TEXTAREA','SELECT','BUTTON'].includes(el.tagName)))return;
  const s=settingsRef.current;
  if(event.key==='Escape'){event.preventDefault();setSelected(false);return;}
  if(event.key==='Delete'||event.key==='Backspace'){
   event.preventDefault();apply({enabled:false});setSelected(false);return;
  }
  if(event.key==='Enter'){event.preventDefault();openInline();return;}
  const step=event.shiftKey?10:1;
  const offsets:Record<string,[number,number]>={
   ArrowLeft:[-step,0],ArrowRight:[step,0],ArrowUp:[0,-step],ArrowDown:[0,step]
  };
  const delta=offsets[event.key];
  if(delta){
   event.preventDefault();
   apply({x:tenth(clamp(s.x+delta[0],0,100)),y:tenth(clamp(s.y+delta[1],0,100))});
  }
 }
 useEffect(()=>{
  if(!selected)return;
  window.addEventListener('keydown',keyboard);
  return()=>window.removeEventListener('keydown',keyboard);
 },[selected,inline,quick]);

 const points=frame?.quad;
 const top=points?average(points[0],points[1]):null;
 const bottom=points?average(points[2],points[3]):null;
 const length=top&&bottom?Math.hypot(bottom.x-top.x,bottom.y-top.y):0;
 const rotate=bottom&&top?{
  x:bottom.x+(bottom.x-top.x)/Math.max(1,length)*(frame?.unit??0)*3.4,
  y:bottom.y+(bottom.y-top.y)/Math.max(1,length)*(frame?.unit??0)*3.4
 }:null;
 return <div ref={wrapper} className={'preview-text-interaction'+(transforming?' is-moving':'')}
  data-testid="preview-text-interaction"
  onPointerDown={begin} onPointerMove={move} onPointerUp={e=>end(e)}
  onPointerCancel={e=>end(e,true)} onLostPointerCapture={()=>{if(active.current)cleanup();}}
  onDoubleClick={e=>{
   const target=e.target;
   if(target instanceof Element&&target.closest('[data-testid="text-overlay"],[data-handle="move"]'))openInline();
  }}>
  {children}
  <button type="button" className="preview-text-launch" onClick={openQuick}
   aria-label={settings.enabled?'プレビューから文字を編集':'プレビューに文字を追加'}>
   {settings.enabled?'✎ 文字を編集':'+ 文字を追加'}
  </button>
  {selected&&settings.enabled&&!inline&&frame&&points&&<svg className="preview-text-selection" data-testid="text-selection"
   aria-label="文字の選択枠" viewBox={String(frame.view.x)+' '+frame.view.y+' '+frame.view.width+' '+frame.view.height}
   style={{left:frame.layout.left,top:frame.layout.top,width:frame.layout.width,height:frame.layout.height,overflow:'visible'}}>
   {guides.x&&<line data-testid="text-snap-x" x1={frame.view.width/2} x2={frame.view.width/2} y1="0" y2={frame.view.height} stroke="#ffce87" strokeWidth="2" strokeDasharray="8 7" vectorEffect="non-scaling-stroke"/>}
   {guides.y&&<line data-testid="text-snap-y" y1={frame.view.height/2} y2={frame.view.height/2} x1="0" x2={frame.view.width} stroke="#ffce87" strokeWidth="2" strokeDasharray="8 7" vectorEffect="non-scaling-stroke"/>}
   <polygon data-testid="text-selection-border" points={currentLine(points)} fill="none" stroke="#c9a9ff" strokeWidth="2" vectorEffect="non-scaling-stroke"/>
   <polygon data-handle="move" aria-label="文字を移動" points={currentLine(points)} fill="transparent" stroke="none"/>
   {points.map((p,i)=><rect key={i} data-handle={corners[i]} data-testid={corners[i]}
    aria-label={handleNames[i]+'でサイズ変更'} role="button"
    x={p.x-frame.unit*.68} y={p.y-frame.unit*.68} width={frame.unit*1.36} height={frame.unit*1.36}
    rx={frame.unit*.15} fill="#fff" stroke="#674f9b" strokeWidth="2" vectorEffect="non-scaling-stroke"/>)}
   {bottom&&rotate&&<>
    <line x1={bottom.x} y1={bottom.y} x2={rotate.x} y2={rotate.y} stroke="#c9a9ff" strokeWidth="2" vectorEffect="non-scaling-stroke"/>
    <circle data-handle="rotate" data-testid="text-rotate-handle" aria-label="回転：ドラッグまたは長押し" role="button"
     cx={rotate.x} cy={rotate.y} r={frame.unit*.95} fill="#4c2a85" stroke="#fff" strokeWidth="2" vectorEffect="non-scaling-stroke"/>
    <g transform={'translate('+rotate.x+' '+rotate.y+')'} pointerEvents="none">
     <path d={'M '+(-frame.unit*.38)+' 0 A '+(frame.unit*.38)+' '+(frame.unit*.38)+' 0 1 1 '+(frame.unit*.19)+' '+(frame.unit*.32)}
      fill="none" stroke="#fff" strokeWidth="2" vectorEffect="non-scaling-stroke"/>
    </g>
   </>}
  </svg>}
  {selected&&settings.enabled&&!inline&&<div className="preview-text-selection-tools" role="toolbar" aria-label="選択中の文字の操作">
   <button type="button" onClick={openInline}>✎ 編集</button>
   <button type="button" onClick={()=>apply({x:50})}>横中央</button>
   <button type="button" onClick={()=>apply({y:50})}>縦中央</button>
   <button type="button" onClick={()=>apply({rotation:0})}>回転0°</button>
   <button type="button" onClick={()=>{apply({enabled:false});setSelected(false);}}>非表示</button>
  </div>}
  {transforming&&<div className="preview-text-hud" data-testid="text-transform-hud" role="status">
   X {settings.x.toFixed(1)}% / Y {settings.y.toFixed(1)}% · {settings.fontSize}px · {settings.rotation.toFixed(1)}°
  </div>}
  {inline&&<div className="preview-inline-editor" data-testid="inline-text-editor"
   style={frame?{left:frame.inline.left,top:frame.inline.top,width:frame.inline.width}:undefined}>
   <label htmlFor="preview-inline-text">文字をその場で編集</label>
   <textarea ref={input} id="preview-inline-text" rows={Math.min(4,Math.max(2,draft.split('\n').length))}
    maxLength={2000} value={draft} onChange={e=>setDraft(e.target.value.slice(0,2000).split('\n').slice(0,12).join('\n'))}
    onBlur={saveInline}
    onKeyDown={e=>{e.stopPropagation();if(e.key==='Escape'){e.preventDefault();cancelInline();}else if(e.key==='Enter'&&(e.ctrlKey||e.metaKey)){e.preventDefault();saveInline();}}}/>
   <p>Ctrl/Cmd+Enter で確定 / Esc で取り消し</p>
  </div>}
  {quick&&<section className="preview-text-popover" role="group" aria-label="プレビュー上で文字を編集">
   <div className="preview-text-popover-head"><strong>文字を直接編集</strong>
    <button type="button" aria-label="プレビュー文字編集を閉じる" onClick={()=>setQuick(false)}>×</button>
   </div>
   <label htmlFor="preview-text-content">文字の内容</label>
   <textarea id="preview-text-content" rows={2} maxLength={2000} value={settings.text}
    onChange={e=>apply({text:e.target.value.slice(0,2000).split('\n').slice(0,12).join('\n')})}/>
   <div className="preview-text-quick-row">
    <label htmlFor="preview-text-size">サイズ
     <input id="preview-text-size" type="range" min="12" max="250" value={settings.fontSize}
      onChange={e=>apply({fontSize:Number(e.target.value)})}/>
    </label>
    <output htmlFor="preview-text-size">{settings.fontSize}</output>
    <label htmlFor="preview-text-color">文字色
     <input id="preview-text-color" type="color" value={settings.color}
      onChange={e=>apply({colorMode:'solid',color:e.target.value})}/>
    </label>
   </div>
   <div className="preview-text-popover-actions">
    <button type="button" onClick={()=>{onAdvanced();setQuick(false);}}>詳細設定</button>
    <button type="button" onClick={()=>setQuick(false)}>編集を終了</button>
   </div>
   <p>文字をクリックして選択、枠の角で拡大縮小。下のハンドルはドラッグか長押しで回転します。</p>
  </section>}
 </div>;
}
