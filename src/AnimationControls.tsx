import { useCallback, useEffect, useRef, useState } from 'react';
import { defaults,EASINGS,type AnimationSettings } from './animation';
export function usePlayback(settings:AnimationSettings){
 const [position,setPosition]=useState(0),[playing,setPlaying]=useState(false);
 const [restartSerial,setRestartSerial]=useState(0);
 const frame=useRef<number|undefined>(undefined);
 const restart=useCallback((automatic=false)=>{
   if(frame.current!==undefined)cancelAnimationFrame(frame.current);
   // Respect reduced motion for incidental replay; explicit Play remains available.
   const reduce=automatic&&matchMedia('(prefers-reduced-motion: reduce)').matches;
   setPosition(reduce?1:0);setPlaying(!reduce);setRestartSerial(n=>n+1);
 },[]);
 useEffect(()=>{if(!settings.animationEnabled)setPlaying(false);},[settings.animationEnabled]);
 useEffect(()=>{
  if(!playing||!settings.animationEnabled)return;
  const started=performance.now(),from=position;
  const tick=(now:number)=>{
   const elapsed=Math.max(0,now-started)/1000;
   setPosition(Math.min(1,from+elapsed*settings.playbackSpeed/settings.animationDuration));
   frame.current=requestAnimationFrame(tick);
  };
  // Each restart owns a fresh clock, including a restart while already playing.
  frame.current=requestAnimationFrame(tick);
  return()=>{if(frame.current!==undefined)cancelAnimationFrame(frame.current);};
 },[playing,restartSerial,settings.animationEnabled,settings.playbackSpeed,settings.animationDuration]);
 useEffect(()=>{if(position>=1)setPlaying(false);},[position]);
 return {position,setPosition,playing,setPlaying,restart};
}
export function AnimationControls({settings,onChange,playback}:{settings:AnimationSettings;onChange:(a:AnimationSettings)=>void;playback:ReturnType<typeof usePlayback>}){
 const {position,setPosition,playing,setPlaying}=playback;
 return <section className="control-section animation-controls"><h3>成長アニメーション</h3>
 <label><input type="checkbox" checked={settings.animationEnabled} onChange={e=>{onChange({...settings,animationEnabled:e.target.checked});setPosition(0);setPlaying(false);}}/> アニメーションを有効化</label>
 <label htmlFor="growth-duration">成長時間（秒）</label><output>{settings.animationDuration}</output><input id="growth-duration" type="range" min="1" max="30" value={settings.animationDuration} onChange={e=>onChange({...settings,animationDuration:+e.target.value})}/>
 <label htmlFor="growth-speed">再生速度</label><select id="growth-speed" value={settings.playbackSpeed} onChange={e=>onChange({...settings,playbackSpeed:+e.target.value})}>{[.25,.5,1,1.5,2,3,4].map(n=><option key={n} value={n}>{n}倍</option>)}</select>
 <label htmlFor="growth-easing">イージング</label><select id="growth-easing" value={settings.easingType} onChange={e=>onChange({...settings,easingType:e.target.value as typeof defaults.easingType})}>{EASINGS.map((v,i)=><option key={v} value={v}>{['Linear','Ease In','Ease Out','Ease In Out','Ease Out In'][i]}</option>)}</select>
 <div className="play-buttons"><button disabled={!settings.animationEnabled} onClick={()=>{if(position===1)setPosition(0);setPlaying(!playing);}}>{playing?'一時停止':'再生'}</button><button onClick={()=>{onChange({...settings,animationEnabled:true});playback.restart();}}>最初から再生</button><button onClick={()=>{setPlaying(false);setPosition(1);}}>完成状態を表示</button></div>
 <label>タイムライン<input type="range" min="0" max="1000" step="1" value={Math.round(position*1000)} onChange={e=>{setPlaying(false);setPosition(+e.target.value/1000);}}/></label>
 <output data-testid="playback-position">{(position*settings.animationDuration).toFixed(2)} / {settings.animationDuration}秒（{Math.round(position*100)}%）</output>
 <p className="help">有効時はシード確定・再生成で最初から再生します。ページを開いただけでは再生しません。静止画保存は常に完成状態です。</p></section>;
}
