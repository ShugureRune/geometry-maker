import {canStreamVideo,pickVideoFile} from './video-file';
import type {VideoDestination} from './video';
import { ambientVideoSeconds } from './ambient';
import {textEntranceEnd} from './text-entrance';
import { useEffect, useRef, useState } from 'react';
import { downloadBlob } from './export';
import { EXPORT_PRESETS, fileStem } from './settings';
import { exportVideo, videoAvailable, videoCodec } from './video';
import { videoResolutionError, videoTimeline, type VideoSettings } from './video-settings';
import type { VideoArtwork } from './video-frame';
export function VideoPanel({ settings, onChange, artwork }: { settings: VideoSettings; onChange: (s: VideoSettings) => void; artwork: VideoArtwork }) {
  const [disk,setDisk]=useState(false);
  const [open, setOpen] = useState(false), [busy, setBusy] = useState(false), [progress, setProgress] = useState(0);
  const [message, setMessage] = useState(''), [error, setError] = useState(''), [supported, setSupported] = useState<boolean | null>(null);
  const controller = useRef<AbortController | null>(null);
  const { exportVideoWidth: width, exportVideoHeight: height, exportVideoFps: fps } = settings;
  const invalid = videoResolutionError(width, height);
  const longAmbient=!!artwork.ambient?.settings.enabled&&ambientVideoSeconds(artwork.ambient.settings)>30&&!disk;
  const timeline = videoTimeline(Math.max(artwork.animation.animationDuration/artwork.animation.playbackSpeed,textEntranceEnd(artwork.textOverlay)),1,fps);
  useEffect(() => () => controller.current?.abort(), []);
  useEffect(() => {
    if (!open || invalid) return;
    let active = true; setSupported(null);
    void videoCodec(settings).then(codec => { if (active) setSupported(!!codec); }).catch(() => { if (active) setSupported(false); });
    return () => { active = false; };
  }, [open, invalid, settings]);
  async function save() {
    const current = structuredClone(settings), snapshot = structuredClone(artwork);
    const abort = new AbortController(); controller.current = abort;
    setBusy(true); setProgress(0); setMessage('開始時の設定でフレームを生成しています。'); setError('');
    let destination:VideoDestination|undefined;
    try {
      const filename=`${fileStem(snapshot.seed,snapshot.scene.version)}_${current.exportVideoWidth}x${current.exportVideoHeight}_${current.exportVideoFps}fps.${current.exportVideoFormat}`;
      if(disk&&snapshot.ambient?.settings.enabled)destination=await pickVideoFile(filename,current.exportVideoFormat);
      const blob = destination?await exportVideo(snapshot,current,abort.signal,setProgress,destination):await exportVideo(snapshot, current, abort.signal, setProgress);
      abort.signal.throwIfAborted();
      if(blob)downloadBlob(blob, `${fileStem(snapshot.seed, snapshot.scene.version)}_${current.exportVideoWidth}x${current.exportVideoHeight}_${current.exportVideoFps}fps.${current.exportVideoFormat}`);
      setMessage(destination?'動画をファイルに保存しました。':'動画の保存を開始しました。');
    } catch (e) { await destination?.abort().catch(()=>{}); if (abort.signal.aborted||(e instanceof DOMException&&e.name==='AbortError')) setMessage('動画書き出しをキャンセルしました。'); else setError(e instanceof Error ? e.message : '動画を書き出せませんでした。'); }
    finally { setBusy(false); controller.current = null; }
  }
  return <details className="video-panel" onToggle={e => setOpen(e.currentTarget.open)}>
    <summary>動画書き出し</summary>
    <p className="help">高解像度動画の書き出しはPC推奨。WebCodecs対応ブラウザが必要です。MP4はH.264エンコーダー対応時のみ利用できます。</p>
    {artwork.ambient?.settings.enabled&&<p className="help">待機画面を書き出します。完全ループは1周期、無限変化は詳細設定の書き出し時間を使用します。</p>}
    {artwork.ambient?.settings.enabled&&<>
      {canStreamVideo()&&<label><input type="checkbox" disabled={busy} checked={disk} onChange={e=>setDisk(e.target.checked)}/> ファイルへ逐次保存（対応PC向け）</label>}
      <p className="help">逐次保存は圧縮データをファイルへ順に書き込みます。通常保存の待機動画は30秒・64MBまでです。長い動画は対応PCのChrome/Edgeで逐次保存を使用してください。</p>
      {longAmbient&&<p className="export-error">30秒を超える待機動画は逐次保存を選ぶか、時間を短くしてください。</p>}
    </>}
    <fieldset disabled={busy}>
      <label htmlFor="video-format">動画形式</label><select id="video-format" value={settings.exportVideoFormat} onChange={e => onChange({ ...settings, exportVideoFormat: e.target.value as VideoSettings['exportVideoFormat'] })}><option value="webm">WebM（VP9 / VP8）</option><option value="mp4">MP4（H.264・対応ブラウザのみ）</option></select>
      <label htmlFor="video-resolution">動画解像度</label><select id="video-resolution" value={EXPORT_PRESETS.some(p => p.width === width && p.height === height) ? `${width}x${height}` : 'custom'} onChange={e => { const preset = EXPORT_PRESETS.find(p => `${p.width}x${p.height}` === e.target.value); if (preset) onChange({ ...settings, exportVideoWidth: preset.width, exportVideoHeight: preset.height }); }}>
        {EXPORT_PRESETS.map(p => <option key={`${p.width}x${p.height}`} value={`${p.width}x${p.height}`}>{p.width} × {p.height}</option>)}<option value="custom">カスタム（下の幅・高さを入力）</option>
      </select>
      <div className="export-dimensions">
        <label>動画の幅 (px)<input type="number" min="256" max="4096" step="2" value={width || ''} aria-invalid={!!invalid} onChange={e => onChange({ ...settings, exportVideoWidth: Number(e.target.value) })} /></label><span aria-hidden="true">×</span>
        <label>動画の高さ (px)<input type="number" min="256" max="4096" step="2" value={height || ''} aria-invalid={!!invalid} onChange={e => onChange({ ...settings, exportVideoHeight: Number(e.target.value) })} /></label>
      </div>
      <label htmlFor="video-fps">動画FPS</label><select id="video-fps" value={fps} onChange={e => onChange({ ...settings, exportVideoFps: Number(e.target.value) as VideoSettings['exportVideoFps'] })}>{[24, 30, 60].map(f => <option key={f} value={f}>{f} fps</option>)}</select>
    </fieldset>
    <p className={invalid ? 'export-error' : 'help'}>{invalid || '256〜4096pxの偶数、合計8,388,608画素まで。現在の構図を維持し、比率が異なる場合は背景色の余白を追加します。'}</p>
    <p className="help">長さ：約{(artwork.ambient?.settings.enabled?ambientVideoSeconds(artwork.ambient.settings):timeline.encodedSeconds).toFixed(2)}秒{artwork.ambient?.settings.enabled?'（待機画面）':'（図形の成長と文字の登場を最後まで収録）'}。{!artwork.ambient?.settings.enabled&&!artwork.animation.animationEnabled && 'アニメーションOFF：最初の背景フレーム以降は完成状態を保持します。'}</p>
    {!videoAvailable() ? <p className="export-error">このブラウザはWebCodecs動画エンコードに未対応です。PCの最新Chrome/Edgeをお試しください。</p> : supported === false && !invalid ? <p className="export-error">選択した形式・解像度のエンコードに未対応です。別の形式・解像度をお試しください。</p> : null}
    <div className="export-actions"><button type="button" disabled={busy || !!invalid || longAmbient || supported !== true} onClick={() => void save()}>動画を書き出す</button>{busy && <button type="button" onClick={() => controller.current?.abort()}>動画書き出しをキャンセル</button>}</div>
    {busy && <><progress aria-label="動画書き出し進捗" value={progress} max="1" /><p>{Math.floor(progress * 100)}%</p></>}
    {error && <p role="alert" className="export-error">{error}</p>}
    <p role="status" className="export-message">{message}</p>
  </details>;
}
