import {HelpInfo} from './HelpInfo';
import {figurePhaseAt,type FigureClockState} from './scroll-figure-colors';
import {paletteSource,scrollBackgroundAt,type ScrollPaletteState} from './scroll-palette';
import {scrollPathAt,scrollVelocity,type ScrollLeg} from './scroll-world';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ambientDefaults, ambientClock, ambientSeed, figureScrollAngle, type AmbientInput, type AmbientSettings } from './ambient';
import type {Ratio} from './scene';
import { AmbientView } from './AmbientView';
export function useAmbientClock(enabled:boolean,speedLimit:boolean,settings:AmbientSettings=ambientDefaults,ratio:Ratio='16:9'){
 const [seconds,setSeconds]=useState(0),[playing,setPlaying]=useState(false);
 const elapsed=useRef(0);
 const [scrollPath,setScrollPath]=useState<ScrollLeg[]>([]);
 const [scrollFigureState,setScrollFigureState]=useState<FigureClockState>();
 const [scrollPaletteState,setScrollPaletteState]=useState<ScrollPaletteState>();
 useLayoutEffect(()=>{
  if(!enabled)return;
  setScrollPath(previous=>{
   const velocity=scrollVelocity(settings,ratio),last=previous.at(-1);
   if(last&&last.vx===velocity.vx&&last.vy===velocity.vy&&last.speed===settings.speed)return previous;
   const at=elapsed.current,{x,y}=scrollPathAt(settings,at,previous,ratio);
   const leg={time:at,x:at===0?0:x,y:at===0?0:y,...velocity,speed:settings.speed};
   return [...previous.filter(l=>l.time<at),leg];
  });
 },[enabled,settings.speed,settings.scrollSpeed,settings.duration,settings.direction,settings.scrollAngle,settings.mode,settings.loop,ratio]);
 useEffect(()=>{if(!enabled||!playing)return;let frame=0,last:number|undefined,draw=0;const tick=(now:number)=>{if(document.hidden){last=undefined;}else{if(last!==undefined)elapsed.current+=(now-last)/1000;last=now;if(now-draw>=(speedLimit?1000/20:1000/30)){setSeconds(elapsed.current);draw=now;}}frame=requestAnimationFrame(tick);};frame=requestAnimationFrame(tick);const visibility=()=>{last=undefined;};document.addEventListener('visibilitychange',visibility);return()=>{cancelAnimationFrame(frame);document.removeEventListener('visibilitychange',visibility);};},[enabled,playing,speedLimit]);
 return{seconds,playing,scrollPath,scrollPaletteState,setScrollPaletteState,scrollFigureState,setScrollFigureState,play:()=>setPlaying(true),pause:()=>setPlaying(false),stop:()=>{setPlaying(false);elapsed.current=0;setSeconds(0);setScrollPaletteState(undefined);setScrollFigureState(undefined);setScrollPath([{time:0,x:0,y:0,...scrollVelocity(settings,ratio),speed:settings.speed}]);}};
}
export function AmbientControls({settings,onChange,clock,input}:{input?:AmbientInput;settings:AmbientSettings;onChange:(s:AmbientSettings)=>void;clock:ReturnType<typeof useAmbientClock>}){
 function changePalette(next:AmbientSettings){
  if(!input){onChange(next);return;}
  const full={...input,settings,scrollPaletteState:clock.scrollPaletteState},background=scrollBackgroundAt(full,clock.seconds),frozen={source:paletteSource(full),solid:background.solid,colors:background.colors};
  clock.setScrollPaletteState({...frozen,at:clock.seconds,automatic:next.scrollBackgroundAuto});onChange({...next,scrollFrozen:frozen});
 }
 function changeFigure(next:AmbientSettings){
  const phase=figurePhaseAt(settings,clock.seconds,clock.scrollFigureState);
  clock.setScrollFigureState({at:clock.seconds,phase});onChange({...next,scrollFigurePhase:phase});
 }
 const select=(key:keyof AmbientSettings,label:string,options:string[][])=><label>{label}<select value={String(settings[key])} onChange={e=>{const next={...settings,[key]:e.target.value};if(key==='loop'&&settings.mode==='scroll'&&settings.scrollBackgroundAuto)changePalette(next);else onChange(next);}}>{options.map(([value,text])=><option key={value} value={value}>{text}</option>)}</select></label>;
 const number=(key:keyof AmbientSettings,label:string,min:number,max:number,step=1,unit='秒')=><div className="ambient-range"><label htmlFor={`ambient-${key}`}>{label}</label><output htmlFor={`ambient-${key}`}>{(key==='scrollAngle'?settings.scrollAngle??figureScrollAngle(settings,input?.ratio):Number(settings[key])).toFixed(step<1?2:0)}{unit}</output><input id={`ambient-${key}`} type="range" min={min} max={max} step={step} value={key==='scrollAngle'?settings.scrollAngle??figureScrollAngle(settings,input?.ratio):Number(settings[key])} aria-valuetext={`${Number(settings[key])}${unit}`} onChange={e=>{const next={...settings,[key]:Number(e.target.value)};if(key==='scrollFigureInterval')changeFigure(next);else if(settings.mode==='scroll'&&settings.scrollBackgroundAuto&&(key==='scrollBackgroundInterval'||(settings.loop==='perfect'&&(key==='duration'||key==='speed'))))changePalette(next);else onChange(next);}}/></div>;
 return <section className="control-section ambient-controls"><h3>自動再生</h3><label><input type="checkbox" aria-label="自動待機画面を有効化" checked={settings.enabled} onChange={e=>{clock.stop();onChange({...settings,enabled:e.target.checked});if(e.target.checked&&!matchMedia('(prefers-reduced-motion: reduce)').matches)clock.play();}}/> 自動再生を使う</label>
 {settings.enabled&&<>
 {select('mode','待機アニメーション',[['growth','自動成長・再生成'],['float','浮遊・回転'],['scroll','無限スクロール'],['combined','複合モード']])}
 {select('loop','ループ方式',[['perfect','完全ループ'],['evolving','無限変化']])}
 {settings.mode==='scroll'&&<fieldset className="scroll-settings"><legend>スクロールの密度と配色</legend>
 {number('scrollDensity','主役密度',0,400,5,'%')}
 <HelpInfo>無限変化スクロールで主役の出現頻度を調整します。100%が従来の密度、最大400%。装飾量は変わりません。</HelpInfo>
 <label><input type="checkbox" checked={settings.scrollBackgroundAuto} onChange={e=>{
  changePalette({...settings,scrollBackgroundAuto:e.target.checked});
 }}/> 背景色を自動変更</label>
 {number('scrollBackgroundInterval','背景色変更間隔',3,60,1,'秒')}
 <label><input type="checkbox" checked={settings.scrollFigureAuto} onChange={e=>changeFigure({...settings,scrollFigureAuto:e.target.checked})}/> 図形色を自動変更</label>
 {number('scrollFigureInterval','図形色変更間隔',3,60,1,'秒')}
 <label><input type="checkbox" checked={settings.scrollAutoFigureColors} onChange={e=>onChange({...settings,scrollAutoFigureColors:e.target.checked})}/> 背景連動カラー生成</label>
 <HelpInfo>図形色は背景と独立した周期で変化します。完全な手動配色は図形色自動変更と背景連動を両方OFFにします。通常の密度・配色は変更しません。固定色は維持します。背景の自動変更をOFFにすると、その時点の背景色を保持します。完全ループでは背景の変化間隔も周期に合わせます。</HelpInfo>
 </fieldset>}

 <div className="play-buttons"><button onClick={clock.play}>待機画面を再生</button><button onClick={clock.pause}>待機画面を一時停止</button><button onClick={clock.stop}>待機画面を停止</button></div>
 <p className="help">{clock.playing?'再生中':'停止・一時停止中'} · {clock.seconds.toFixed(1)}秒。通常のシード値は保持します。</p>
 <details><summary>待機画面の詳細設定</summary>
 {number('speed','待機画面の再生速度',.25,4,.25,'倍')}{number('duration','ループ時間（秒）',4,120)}{number('hold','完成状態の表示時間（秒）',0,60)}{number('transition','切り替えにかかる時間（秒）',.5,15,.5)}
 {select('transitionType','切り替え演出',[['crossfade','クロスフェード'],['fade','フェード'],['shrink','縮小'],['reverse','逆成長']])}
 <label><input type="checkbox" disabled={settings.mode==='scroll'&&settings.loop==='evolving'} checked={settings.autoSeed} onChange={e=>onChange({...settings,autoSeed:e.target.checked})}/> 自動シード更新</label>
 {number('exportDuration','待機動画の書き出し時間（秒）',1,120)}{number('interval','シード更新間隔（秒）',4,120)}{number('floatAmount','浮遊量',0,5,.25,'倍')}{number('rotation','回転量（度）',0,5,.25,'度')}{number('rotationSpeed','回転の速さ',1,4,1,'回')}
 {settings.mode==='scroll'&&settings.loop==='evolving'?<>{number('scrollAngle','スクロール角度',0,360,1,'°')}<HelpInfo>図形が流れる方向：0°=右、90°=下、180°=左、270°=上。グリッドも同じ方向へ動きます（速度は独立）。</HelpInfo></>:select('direction','スクロール方向',[['horizontal','横'],['vertical','縦'],['diagonal','斜め']])}{number('scrollSpeed','スクロール速度',.25,4,.25,'倍')}
 <label><input type="checkbox" checked={settings.lowPower} onChange={e=>onChange({...settings,lowPower:e.target.checked})}/> 低負荷表示（20fps）</label>
 <HelpInfo>{settings.mode==='scroll'&&settings.loop==='evolving'?'無限変化スクロールは元シードとチャンク座標で生成します。自動シード更新と更新間隔は使用しません。スクロール速度はループ時間を基準にし、カメラは戻りません。':''}成長時間・イージングは通常設定を使用します。スクロール以外の密度・配色は通常設定です。完全ループではシードを固定します。周期が短い場合、成長・保持・消失時間を周期内に収めます。</HelpInfo>
 </details></>}
 </section>;
}
export function AmbientStage({input,clock}:{input:AmbientInput;clock:ReturnType<typeof useAmbientClock>}){
 const ref=useRef<HTMLDivElement>(null),[hidden,setHidden]=useState(false),[message,setMessage]=useState('');
 const reduced=typeof matchMedia!=='undefined'&&matchMedia('(prefers-reduced-motion: reduce)').matches;
 const c=ambientClock(input.settings,clock.seconds);
 return <div ref={ref} className={`ambient-stage ${hidden?'ambient-hidden':''}`}>
 <AmbientView input={{...input,scrollPath:clock.scrollPath,scrollPaletteState:clock.scrollPaletteState,scrollFigureState:clock.scrollFigureState}} seconds={clock.seconds}/>
 <div className="ambient-toolbar"><button onClick={()=>setHidden(!hidden)}>{hidden?'操作を表示':'操作を隠す'}</button>{!hidden&&<><button onClick={()=>clock.playing?clock.pause():clock.play()}>{clock.playing?'一時停止':'再生'}</button><button onClick={clock.stop}>停止</button><button onClick={()=>{if(document.fullscreenElement)void document.exitFullscreen();else if(ref.current?.requestFullscreen)void ref.current.requestFullscreen().catch(()=>setMessage('全画面表示はこのブラウザで利用できません。'));else setMessage('全画面表示はこのブラウザで利用できません。');}}>全画面表示</button><code>表示シード：{input.settings.mode==='scroll'&&input.settings.loop==='evolving'?input.seed:ambientSeed(input.seed,c.index)}</code></> }</div>
 {message&&<p role="status">{message}</p>}{reduced&&!hidden&&<HelpInfo>視覚効果軽減が有効です。再生ボタンで開始できます。</HelpInfo>}
 </div>;
}
export {ambientDefaults};
