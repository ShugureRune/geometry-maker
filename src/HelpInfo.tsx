import {useCallback,useEffect,useId,useLayoutEffect,useRef,useState,type ReactNode} from 'react';
import {createPortal} from 'react-dom';

type Placement={left:number;top:number;width:number};

/** One selected info hint at a time.
 * The description lives in a body portal so narrow fieldsets, overflow
 * containers and the sticky category bar cannot clip or cover it.
 */
export function HelpInfo({children,label='説明を見る'}:{
  children:ReactNode;label?:string;
}){
  const id=useId();
  const details=useRef<HTMLDetailsElement>(null);
  const trigger=useRef<HTMLElement>(null);
  const popover=useRef<HTMLDivElement>(null);
  const [open,setOpen]=useState(false);
  const [placement,setPlacement]=useState<Placement|null>(null);

  const close=useCallback(()=>{
    if(details.current)details.current.open=false;
    setOpen(false);
    setPlacement(null);
  },[]);

  const position=useCallback(()=>{
    const rect=trigger.current?.getBoundingClientRect();
    const bubble=popover.current;
    if(!rect||!bubble)return;
    // Keep descriptions consistently readable, including inside tiny legends.
    const width=Math.min(360,window.innerWidth-24);
    const left=Math.max(12,Math.min(rect.left,window.innerWidth-width-12));
    const height=bubble.getBoundingClientRect().height;
    const bottomMargin=window.innerWidth<=720?94:12; // clear mobile dock
    const bottom=window.innerHeight-bottomMargin;
    const below=bottom-rect.bottom-8;
    const above=rect.top-12;
    const top=below>=height||below>=above?
      Math.max(12,Math.min(rect.bottom+8,bottom-height)):
      Math.max(12,rect.top-height-8);
    setPlacement({left,top,width});
  },[]);

  // Measure before paint so an open hint never flashes at (0,0).
  useLayoutEffect(()=>{
    if(open)position();
  },[open,children,position]);

  useEffect(()=>{
    if(!open)return;
    const onOther=(event:Event)=>{
      if((event as CustomEvent<string>).detail!==id)close();
    };
    const onClick=(event:MouseEvent)=>{
      // Tapping either the text, another control, or the backdrop deselects it.
      // Only the selected circled-i keeps it open.
      if(!trigger.current?.contains(event.target as Node))close();
    };
    const onKey=(event:KeyboardEvent)=>{
      if(event.key==='Escape'){event.stopPropagation();close();}
    };
    const onScroll=(event:Event)=>{
      // A scroll inside the description should remain scrollable.
      if(event.target instanceof Node&&popover.current?.contains(event.target))return;
      close();
    };
    const onResize=()=>position();
    document.addEventListener('click',onClick,true);
    document.addEventListener('keydown',onKey,true);
    document.addEventListener('scroll',onScroll,true);
    window.addEventListener('resize',onResize);
    window.addEventListener('studio-info-selected',onOther);
    // Opening a new hint closes any previously selected hint.
    window.dispatchEvent(new CustomEvent('studio-info-selected',{detail:id}));
    return()=>{
      document.removeEventListener('click',onClick,true);
      document.removeEventListener('keydown',onKey,true);
      document.removeEventListener('scroll',onScroll,true);
      window.removeEventListener('resize',onResize);
      window.removeEventListener('studio-info-selected',onOther);
    };
  },[open,id,close,position]);

  return <>
    <details ref={details} className="studio-info-disclosure"
      onToggle={event=>{
        const selected=event.currentTarget.open;
        setOpen(selected);
        if(!selected)setPlacement(null);
      }}>
      <summary ref={trigger} title={label} aria-label={label}
        aria-controls={id} aria-expanded={open}>
        <span className="studio-info-icon" aria-hidden="true">i</span>
      </summary>
    </details>
    {open&&createPortal(
      <div ref={popover} id={id} className="studio-info-popover" role="note"
        data-testid="studio-info-popover"
        style={placement?{left:placement.left,top:placement.top,width:placement.width}:
          {visibility:'hidden'}}>
        <p className="help">{children}</p>
      </div>,document.body)}
  </>;
}
