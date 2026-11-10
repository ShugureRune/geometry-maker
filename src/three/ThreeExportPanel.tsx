import {useRef,useState, type RefObject} from 'react';
import {downloadBlob} from '../export';
import {EXPORT_PRESETS, fileStem} from '../settings';
import {THREE_ALGORITHM_VERSION} from './model';
import {threeResolutionError, type ThreePreviewHandle} from './settings';
import {MAX_THREE_PROJECT_BYTES,parseThreeProject,threeProjectText,type ThreeProject} from './project';

export function ThreeExportPanel({api, seed, ready,project,onRestore}: {api: RefObject<ThreePreviewHandle | null>; seed: string; ready: boolean;
  project:()=>Omit<ThreeProject,'exportWidth'|'exportHeight'|'elapsedSeconds'>;onRestore:(project:ThreeProject)=>void}) {
  const [width, setWidth] = useState('1920'), [height, setHeight] = useState('1080');
  const [busy, setBusy] = useState(false), [message, setMessage] = useState(''), [error, setError] = useState('');
  const w = Number(width), h = Number(height), invalid = threeResolutionError(w, h);
  const file=useRef<HTMLInputElement>(null);
  function saveSettings(){
    setError('');setMessage('');
    try{
      const current={...project(),exportWidth:w,exportHeight:h,elapsedSeconds:api.current?.getElapsedSeconds?.()??0};
      downloadBlob(new Blob([threeProjectText(current)],{type:'application/json;charset=utf-8'}),`${fileStem(seed,THREE_ALGORITHM_VERSION)}_settings.json`);
      setMessage('3D設定JSONの保存を開始しました。');
    }catch(cause){setError(cause instanceof Error?cause.message:'設定を保存できませんでした。');}
  }
  async function restore(selected?:File){
    if(!selected)return;setBusy(true);setError('');setMessage('');
    try{
      if(selected.size>MAX_THREE_PROJECT_BYTES)throw new Error('3D設定JSONは64KB以下にしてください。');
      const restored=parseThreeProject(await selected.text());
      onRestore(restored);setWidth(String(restored.exportWidth));setHeight(String(restored.exportHeight));setMessage('3D設定を読み込みました。');
    }catch(cause){setError(cause instanceof Error?cause.message:'設定を読み込めませんでした。');}
    finally{setBusy(false);if(file.current)file.current.value='';}
  }
  async function save() {
    setError(''); setMessage(''); setBusy(true);
    try {
      if (invalid) throw new Error(invalid);
      if (!api.current) throw new Error('3Dプレビューの描画完了後にお試しください。');
      const blob = await api.current.savePNG(w, h);
      downloadBlob(blob, `${fileStem(seed, THREE_ALGORITHM_VERSION)}_${w}x${h}.png`);
      setMessage('3D PNGの保存を開始しました。');
    } catch (cause) {setError(cause instanceof Error ? cause.message : '3D PNGの保存に失敗しました。');}
    finally {setBusy(false);}
  }
  return <section className="control-section three-controls three-export" aria-labelledby="three-export-heading">
    <h3 id="three-export-heading">3DプレビューのPNG保存</h3>
    <p className="help">現在の視点・姿勢・背景・発光を保存します。比率が異なる場合は構図を保って余白を追加します。高解像度はPC推奨です。</p>
    <label htmlFor="three-export-preset">3D書き出し解像度</label>
    <select id="three-export-preset" disabled={busy} value={EXPORT_PRESETS.some(p => p.width === w && p.height === h) ? `${w}x${h}` : 'custom'} onChange={event => {
      const preset = EXPORT_PRESETS.find(p => `${p.width}x${p.height}` === event.target.value);
      if (preset) {setWidth(String(preset.width)); setHeight(String(preset.height));}
    }}>
      {EXPORT_PRESETS.map(p => <option key={`${p.width}x${p.height}`} value={`${p.width}x${p.height}`}>{p.width} × {p.height}</option>)}<option value="custom">カスタム</option>
    </select>
    <div className="export-dimensions">
      <label htmlFor="three-export-width">3D 幅 (px)<input id="three-export-width" type="number" min={256} max={4096} step={1} disabled={busy} value={width} aria-invalid={!!invalid} onChange={event => setWidth(event.target.value)}/></label>
      <label htmlFor="three-export-height">3D 高さ (px)<input id="three-export-height" type="number" min={256} max={4096} step={1} disabled={busy} value={height} aria-invalid={!!invalid} onChange={event => setHeight(event.target.value)}/></label>
    </div>
    {invalid && <p className="export-error" role="alert">{invalid}</p>}
    <button className="generate-button" type="button" disabled={!ready || busy || !!invalid} onClick={save}>{busy ? '3D PNGを作成中…' : '3D PNGを書き出す'}</button>
    <div className="export-actions"><button type="button" disabled={busy||!!invalid} onClick={saveSettings}>3D設定JSONを保存</button><button type="button" disabled={busy} onClick={()=>file.current?.click()}>3D設定JSONを読込</button></div>
    <input ref={file} type="file" accept=".json,application/json" aria-label="3D設定JSONファイル" hidden onChange={event=>restore(event.target.files?.[0])}/>
    {error && <p className="export-error" role="alert">{error}</p>}
    <p className="export-message" role="status">{message}</p>
    <p className="help">3D設定JSONは3D専用形式です。2DのSVG・動画・設定JSONは2Dモードで利用できます。2Dの文字レイヤーは3D画像には含まれません。</p>
  </section>;
}
