import {scrollPathAt,scrollVelocity,type ScrollLeg} from './scroll-world';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ambientDefaults, ambientClock, ambientSeed, type AmbientInput, type AmbientSettings } from './ambient';
import { AmbientView } from './AmbientView';
export function useAmbientClock(enabled:boolean,speedLimit:boolean,settings:AmbientSettings=ambientDefaults){
 const [seconds,setSeconds]=useState(0),[playing,setPlaying]=useState(false);
 const elapsed=useRef(0);
 const [scrollPath,setScrollPath]=useState<ScrollLeg[]>([]);
 useLayoutEffect(()=>{
  if(!enabled)return;
  setScrollPath(previous=>{
   const velocity=scrollVelocity(settings),last=previous.at(-1);
   if(last&&last.vx===velocity.vx&&last.vy===velocity.vy&&last.speed===settings.speed)return previous;
   const at=elapsed.current,{x,y}=scrollPathAt(settings,at,previous);
   const leg={time:at,x:at===0?0:x,y:at===0?0:y,...velocity,speed:settings.speed};
   return [...previous.filter(l=>l.time<at),leg];
  });
 },[enabled,settings.speed,settings.scrollSpeed,settings.duration,settings.direction]);
 useEffect(()=>{if(!enabled||!playing)return;let frame=0,last:number|undefined,draw=0;const tick=(now:number)=>{if(document.hidden){last=undefined;}else{if(last!==undefined)elapsed.current+=(now-last)/1000;last=now;if(now-draw>=(speedLimit?1000/20:1000/30)){setSeconds(elapsed.current);draw=now;}}frame=requestAnimationFrame(tick);};frame=requestAnimationFrame(tick);const visibility=()=>{last=undefined;};document.addEventListener('visibilitychange',visibility);return()=>{cancelAnimationFrame(frame);document.removeEventListener('visibilitychange',visibility);};},[enabled,playing,speedLimit]);
 return{seconds,playing,scrollPath,play:()=>setPlaying(true),pause:()=>setPlaying(false),stop:()=>{setPlaying(false);elapsed.current=0;setSeconds(0);setScrollPath([{time:0,x:0,y:0,...scrollVelocity(settings),speed:settings.speed}]);}};
}
export function AmbientControls({settings,onChange,clock}:{settings:AmbientSettings;onChange:(s:AmbientSettings)=>void;clock:ReturnType<typeof useAmbientClock>}){
 const select=(key:keyof AmbientSettings,label:string,options:string[][])=><label>{label}<select value={String(settings[key])} onChange={e=>onChange({...settings,[key]:e.target.value})}>{options.map(([value,text])=><option key={value} value={value}>{text}</option>)}</select></label>;
 const number=(key:keyof AmbientSettings,label:string,min:number,max:number,step=1,unit='秒')=><div className="ambient-range"><label htmlFor={`ambient-${key}`}>{label}</label><output htmlFor={`ambient-${key}`}>{Number(settings[key]).toFixed(step<1?2:0)}{unit}</output><input id={`ambient-${key}`} type="range" min={min} max={max} step={step} value={Number(settings[key])} aria-valuetext={`${Number(settings[key])}${unit}`} onChange={e=>onChange({...settings,[key]:Number(e.target.value)})}/></div>;
 return <section className="control-section ambient-controls"><h3>自動待機画面モード</h3><label><input type="checkbox" checked={settings.enabled} onChange={e=>{clock.stop();onChange({...settings,enabled:e.target.checked});if(e.target.checked&&!matchMedia('(prefers-reduced-motion: reduce)').matches)clock.play();}}/> 自動待機画面を有効化</label>
 {settings.enabled&&<>
 {select('mode','待機アニメーション',[['growth','自動成長・再生成'],['float','浮遊・回転'],['scroll','無限スクロール'],['combined','複合モード']])}
 {select('loop','ループ方式',[['perfect','完全ループ'],['evolving','無限変化']])}
 <div className="play-buttons"><button onClick={clock.play}>待機画面を再生</button><button onClick={clock.pause}>待機画面を一時停止</button><button onClick={clock.stop}>待機画面を停止</button></div>
 <p className="help">{clock.playing?'再生中':'停止・一時停止中'} · {clock.seconds.toFixed(1)}秒。通常のシード値は保持します。</p>
 <details><summary>待機画面の詳細設定</summary>
 {number('speed','待機画面の再生速度',.25,4,.25,'倍')}{number('duration','ループ時間（秒）',4,120)}{number('hold','完成状態の表示時間（秒）',0,60)}{number('transition','トランジション時間（秒）',.5,15,.5)}
 {select('transitionType','切り替え演出',[['crossfade','クロスフェード'],['fade','フェード'],['shrink','縮小'],['reverse','逆成長']])}
 <label><input type="checkbox" disabled={settings.mode==='scroll'&&settings.loop==='evolving'} checked={settings.autoSeed} onChange={e=>onChange({...settings,autoSeed:e.target.checked})}/> 自動シード更新</label>
 {number('exportDuration','待機動画の書き出し時間（秒）',1,120)}{number('interval','シード更新間隔（秒）',4,120)}{number('floatAmount','浮遊量',0,5,.25,'倍')}{number('rotation','回転量（度）',0,5,.25,'度')}{number('rotationSpeed','回転速度（周期内の回数）',1,4,1,'回')}
 {select('direction','スクロール方向',[['horizontal','横'],['vertical','縦'],['diagonal','斜め']])}{number('scrollSpeed','スクロール速度',.25,4,.25,'倍')}
 <label><input type="checkbox" checked={settings.lowPower} onChange={e=>onChange({...settings,lowPower:e.target.checked})}/> 低負荷表示（20fps）</label>
 <p className="help">{settings.mode==='scroll'&&settings.loop==='evolving'?'無限変化スクロールは元シードとチャンク座標で生成します。自動シード更新と更新間隔は使用しません。スクロール速度はループ時間を基準にし、カメラは戻りません。':''}成長時間・イージング・密度・配色は通常設定を使用します。完全ループではシードを固定します。周期が短い場合、成長・保持・消失時間を周期内に収めます。</p>
 </details></>}
 </section>;
}
export function AmbientStage({input,clock}:{input:AmbientInput;clock:ReturnType<typeof useAmbientClock>}){
 const ref=useRef<HTMLDivElement>(null),[hidden,setHidden]=useState(false),[message,setMessage]=useState('');
 const reduced=typeof matchMedia!=='undefined'&&matchMedia('(prefers-reduced-motion: reduce)').matches;
 const c=ambientClock(input.settings,clock.seconds);
 return <div ref={ref} className={`ambient-stage ${hidden?'ambient-hidden':''}`}>
 <AmbientView input={{...input,scrollPath:clock.scrollPath}} seconds={clock.seconds}/>
 <div className="ambient-toolbar"><button onClick={()=>setHidden(!hidden)}>{hidden?'操作を表示':'操作を隠す'}</button>{!hidden&&<><button onClick={()=>clock.playing?clock.pause():clock.play()}>{clock.playing?'一時停止':'再生'}</button><button onClick={clock.stop}>停止</button><button onClick={()=>{if(document.fullscreenElement)void document.exitFullscreen();else if(ref.current?.requestFullscreen)void ref.current.requestFullscreen().catch(()=>setMessage('全画面表示はこのブラウザで利用できません。'));else setMessage('全画面表示はこのブラウザで利用できません。');}}>全画面表示</button><code>表示シード：{input.settings.mode==='scroll'&&input.settings.loop==='evolving'?input.seed:ambientSeed(input.seed,c.index)}</code></> }</div>
 {message&&<p role="status">{message}</p>}{reduced&&!hidden&&<p className="help">視覚効果軽減が有効です。再生ボタンで開始できます。</p>}
 </div>;
}
export {ambientDefaults};
