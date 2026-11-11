import {useEffect,useRef,useState,type RefObject} from 'react';
import {HelpInfo} from '../HelpInfo';
import {downloadBlob} from '../export';
import {fileStem} from '../settings';
import {videoAvailable,videoCodec} from '../video';
import {videoResolutionError} from '../video-settings';
import {THREE_ALGORITHM_VERSION} from './model';
import type {ThreePreviewHandle} from './settings';
import {exportThreeVideo,threeVideoDefaults,threeVideoFrameCount,
  type ThreeVideoOptions} from './video';

const PRESETS=[
  {width:640,height:360,label:'640 × 360（軽量）'},
  {width:854,height:480,label:'854 × 480（標準）'},
  {width:1280,height:720,label:'1280 × 720（HD）'},
  {width:1920,height:1080,label:'1920 × 1080（フルHD・PC向け）'},
  {width:1080,height:1920,label:'1080 × 1920（縦動画・PC向け）'},
  {width:512,height:512,label:'512 × 512（正方形）'},
];
export function ThreeVideoPanel({api,seed,ready,disabled,onBusyChange}:{
  api:RefObject<ThreePreviewHandle|null>;seed:string;ready:boolean;
  disabled?:boolean;onBusyChange?:(busy:boolean)=>void;
}){
  const [open,setOpen]=useState(false);
  const [options,setOptions]=useState<ThreeVideoOptions>(threeVideoDefaults);
  const [busy,setBusy]=useState(false);
  const [progress,setProgress]=useState(0);
  const [supported,setSupported]=useState<boolean|null>(null);
  const [error,setError]=useState('');
  const [message,setMessage]=useState('');
  const controller=useRef<AbortController|null>(null);
  const mounted=useRef(true);
  // React StrictMode runs effect setup/cleanup twice in development.
  // Re-arm the mounted ref on every setup, or the export UI stays busy forever.
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;controller.current?.abort();};},[]);
  useEffect(()=>{onBusyChange?.(busy);},[busy,onBusyChange]);
  useEffect(()=>()=>{onBusyChange?.(false);},[onBusyChange]);

  const {exportVideoWidth:width,exportVideoHeight:height,
    exportVideoFormat:format,exportVideoFps:fps,durationSeconds:duration}=options;
  const invalid=videoResolutionError(width,height);
  const frameCount=threeVideoFrameCount(duration,fps);
  useEffect(()=>{
    if(!open||invalid||!videoAvailable()){
      setSupported(false);return;
    }
    let active=true;
    setSupported(null);
    void videoCodec(options).then(codec=>{
      if(active)setSupported(!!codec);
    }).catch(()=>{if(active)setSupported(false);});
    return()=>{active=false;};
  },[open,width,height,fps,format,invalid]);

  async function save(){
    if(busy||disabled||!ready||!api.current)return;
    const current={...options},preview=api.current;
    const abort=new AbortController();controller.current=abort;
    setBusy(true);setProgress(0);setError('');setMessage('3D動画をフレームごとに生成中…');
    try{
      const blob=await exportThreeVideo(preview,current,abort.signal,value=>{
        if(mounted.current)setProgress(value);
      });
      abort.signal.throwIfAborted();
      downloadBlob(blob,
        `${fileStem(seed,THREE_ALGORITHM_VERSION)}_${width}x${height}_${fps}fps_${duration}s.${format}`);
      if(mounted.current)setMessage('3D動画の保存を開始しました。');
    }catch(cause){
      if(!mounted.current)return;
      if(abort.signal.aborted||(cause instanceof DOMException&&cause.name==='AbortError'))
        setMessage('動画の書き出しをキャンセルしました。');
      else setError(cause instanceof Error?cause.message:'動画を作成できませんでした。');
    }finally{
      if(mounted.current){setBusy(false);controller.current=null;}
    }
  }
  const update=<K extends keyof ThreeVideoOptions>(key:K,value:ThreeVideoOptions[K])=>
    setOptions(current=>({...current,[key]:value}));

  return <details className="three-video-panel" open={open}
      onToggle={event=>setOpen(event.currentTarget.open)}>
    <summary>3D動画を書き出す</summary>
    <HelpInfo>3D図形・背景・電子回路・発光を、0秒から選んだ長さまで動画にします。1秒間のコマ数（FPS）を指定でき、処理が遅くても動画の再生速度は変わりません。撮影中はプレビューの視点と再生位置を保持します。音声は入りません。高画質・長時間はPCを推奨します。</HelpInfo>
    <label htmlFor="three-video-format">動画の形式</label>
    <select id="three-video-format" disabled={busy} value={format}
      onChange={event=>update('exportVideoFormat',event.target.value as ThreeVideoOptions['exportVideoFormat'])}>
      <option value="mp4">MP4（一般的な動画形式）</option>
      <option value="webm">WebM（対応ブラウザ向け）</option>
    </select>
    <label htmlFor="three-video-resolution">動画の画質</label>
    <select id="three-video-resolution" disabled={busy}
      value={PRESETS.some(p=>p.width===width&&p.height===height)?`${width}x${height}`:'custom'}
      onChange={event=>{
        const chosen=PRESETS.find(p=>`${p.width}x${p.height}`===event.target.value);
        if(chosen)setOptions(current=>({...current,exportVideoWidth:chosen.width,exportVideoHeight:chosen.height}));
      }}>
      {PRESETS.map(p=><option key={p.label} value={`${p.width}x${p.height}`}>{p.label}</option>)}
      <option value="custom">カスタム</option>
    </select>
    <div className="export-dimensions">
      <label htmlFor="three-video-width">動画の幅 (px)
        <input id="three-video-width" type="number" min={256} max={4096} step={2} disabled={busy}
          value={width} aria-invalid={!!invalid}
          onChange={event=>update('exportVideoWidth',Number(event.target.value))}/>
      </label>
      <label htmlFor="three-video-height">動画の高さ (px)
        <input id="three-video-height" type="number" min={256} max={4096} step={2} disabled={busy}
          value={height} aria-invalid={!!invalid}
          onChange={event=>update('exportVideoHeight',Number(event.target.value))}/>
      </label>
    </div>
    <label htmlFor="three-video-fps">動画のなめらかさ</label>
    <select id="three-video-fps" disabled={busy} value={fps}
      onChange={event=>update('exportVideoFps',Number(event.target.value) as ThreeVideoOptions['exportVideoFps'])}>
      <option value={24}>24 FPS（軽め）</option>
      <option value={30}>30 FPS（標準）</option>
      <option value={60}>60 FPS（高負荷）</option>
    </select>
    <label htmlFor="three-video-duration">動画の長さ
      <output htmlFor="three-video-duration">{duration} 秒</output>
    </label>
    <input id="three-video-duration" type="range" min={1} max={30} step={1}
      value={duration} disabled={busy}
      onChange={event=>update('durationSeconds',Number(event.target.value))}/>
    <p className="three-video-stats">{frameCount} フレームを順番に作成</p>
    {invalid&&<p className="export-error" role="alert">{invalid}</p>}
    {open&&supported===false&&<p className="export-error" role="alert">
      {videoAvailable()?'この形式・画質の動画作成はブラウザで対応していません。形式か画質を変更してください。':
        'このブラウザは動画書き出しに必要なWebCodecsに対応していません。対応するPCブラウザをお試しください。'}
    </p>}
    {busy&&<div className="three-video-progress" role="status">
      <label htmlFor="three-video-progress">3D動画を作成中：{Math.round(progress*100)}%</label>
      <progress id="three-video-progress" max={100} value={Math.round(progress*100)}/>
    </div>}
    <div className="three-video-actions">
      <button type="button" className="generate-button" onClick={save}
        disabled={!ready||busy||disabled||!!invalid||supported!==true}>
        {busy?'3D動画を書き出し中…':'3D動画を保存'}
      </button>
      {busy&&<button type="button" className="three-video-cancel"
        onClick={()=>controller.current?.abort()}>キャンセル</button>}
    </div>
    {error&&<p className="export-error" role="alert">{error}</p>}
    {message&&<p className="export-message" role="status">{message}</p>}
  </details>;
}
