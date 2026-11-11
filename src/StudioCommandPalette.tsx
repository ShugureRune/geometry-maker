import {useEffect,useMemo,useRef,useState} from 'react';

export type StudioCommand={id:string;title:string;description:string;keywords?:string;shortcut?:string;run:()=>void};

export function StudioCommandPalette({open,onClose,commands}:{
  open:boolean;onClose:()=>void;commands:readonly StudioCommand[];
}){
  const [query,setQuery]=useState('');
  const input=useRef<HTMLInputElement>(null);
  useEffect(()=>{
    if(!open)return;
    setQuery('');
    const previous=document.activeElement instanceof HTMLElement?document.activeElement:null;
    const frame=requestAnimationFrame(()=>input.current?.focus());
    const key=(event:KeyboardEvent)=>{
      if(event.key==='Escape'){event.preventDefault();onClose();}
      if(event.key==='Tab'){
        // Focus stays within this small, modal command surface.
        const panel=input.current?.closest('[role=dialog]');
        const focusable=Array.from(panel?.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled)')??[]);
        if(!focusable.length)return;
        const first=focusable[0],last=focusable[focusable.length-1];
        if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
        else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
      }
    };
    window.addEventListener('keydown',key);
    return()=>{cancelAnimationFrame(frame);window.removeEventListener('keydown',key);previous?.focus();};
  },[open,onClose]);
  const filtered=useMemo(()=>{
    const q=query.trim().toLocaleLowerCase();
    return !q?commands:commands.filter(item=>
      [item.title,item.description,item.keywords??''].some(v=>v.toLocaleLowerCase().includes(q)));
  },[commands,query]);
  if(!open)return null;
  const execute=(command:StudioCommand)=>{command.run();onClose();};
  return <div className="studio-command-backdrop" onMouseDown={event=>{
    if(event.target===event.currentTarget)onClose();
  }}>
    <section className="studio-command-panel" role="dialog" aria-modal="true"
      aria-labelledby="studio-command-title" aria-describedby="studio-command-description">
      <div className="studio-command-top">
        <span className="studio-command-icon" aria-hidden="true">⌘</span>
        <div><h2 id="studio-command-title">クイックコマンド</h2>
          <p id="studio-command-description">設定・操作をまとめて検索</p></div>
        <button type="button" onClick={onClose} aria-label="コマンド検索を閉じる">✕</button>
      </div>
      <label htmlFor="studio-command-search" className="sr-only">コマンドを検索</label>
      <input ref={input} id="studio-command-search" type="search" value={query}
        placeholder="例：背景 / 3D / 書き出し / シード…" autoComplete="off"
        onChange={event=>setQuery(event.target.value)}
        onKeyDown={event=>{if(event.key==='Enter'&&filtered[0]){event.preventDefault();execute(filtered[0]);}}}/>
      <div className="studio-command-results" role="list">
        {filtered.length?filtered.map(command=><button type="button" key={command.id}
          role="listitem" onClick={()=>execute(command)} className="studio-command-result">
          <span className="studio-command-result-icon" aria-hidden="true">↗</span>
          <span className="studio-command-result-label"><strong>{command.title}</strong>
            <small>{command.description}</small></span>
          {command.shortcut&&<kbd>{command.shortcut}</kbd>}
        </button>):<p className="studio-command-empty">一致する操作がありません。別のキーワードを試してみてね。</p>}
      </div>
      <div className="studio-command-footer"><span>Enter で実行</span><span>Esc で閉じる</span></div>
    </section>
  </div>;
}
