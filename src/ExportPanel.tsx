import { VideoPanel } from './VideoPanel';
import { videoDefaults, videoSettings, type VideoSettings } from './video-settings';
import type { VideoArtwork } from './video-frame';
import type { AnimationSettings } from './animation';
import type { ColorSettings } from './colors';
import type {TextOverlaySettings} from './text-overlay';
import type {VisualTheme} from './themes';
import {isAllShapeKindsEnabled,type ShapeKind} from './shape-controls';
import { useRef, useState } from 'react';
import { RATIOS, type AlgorithmVersion, type Background, type Ratio } from './scene';
import {MAGIC_ALGORITHM_VERSION,type MagicCircleSettings} from './magic-circle';
import { downloadBlob, pngBlob, serializeArtwork } from './export';
import { EXPORT_PRESETS, fileStem, MAX_PNG_PIXELS, MAX_SETTINGS_BYTES, parseSettings, resolutionError, settingsText, type ProjectSettings } from './settings';

type Props = { textOverlay:TextOverlaySettings; magicSettings?:MagicCircleSettings; videoArtwork: VideoArtwork; version:AlgorithmVersion; animation:AnimationSettings; density:number; colorSettings?:ColorSettings; visualTheme?:VisualTheme; enabledShapeKinds?:readonly ShapeKind[]; seed: string; ratio: Ratio; background: Background; artwork: (transparentOnly?:boolean) => SVGSVGElement | null;
  onRatio: (ratio: Ratio) => void; onRestore: (settings: ProjectSettings) => void };
export function ExportPanel({ textOverlay, magicSettings, videoArtwork, version, animation, density, colorSettings, visualTheme, enabledShapeKinds, seed, ratio, background, artwork, onRatio, onRestore }: Props) {
  const [width, setWidth] = useState('1920'), [height, setHeight] = useState('1080');
  const [video, setVideo] = useState<VideoSettings>({...videoDefaults});
  const [custom, setCustom] = useState(false);
  const [busy, setBusy] = useState(false), [message, setMessage] = useState(''), [error, setError] = useState('');
  const fileInput = useRef<HTMLInputElement>(null);
  const w = Number(width), h = Number(height), invalid = resolutionError(w, h);
  const tooLarge = w * h > MAX_PNG_PIXELS;
  const [sceneWidth, sceneHeight] = RATIOS[ratio];
  const margins = !invalid && Math.abs(w / h - sceneWidth / sceneHeight) > 0.001;
  const magicTransparent=version===MAGIC_ALGORITHM_VERSION&&!!magicSettings?.transparentExport;
  function snapshot(): ProjectSettings {
    return { ...(magicSettings&&version===MAGIC_ALGORITHM_VERSION?{magicCircle:magicSettings}:{}), ...(videoArtwork.ambient?{ambient:videoArtwork.ambient.settings}:{}), ...(visualTheme&&visualTheme!=='standard'?{visualTheme}:{}), ...(enabledShapeKinds&&!isAllShapeKindsEnabled(enabledShapeKinds)?{enabledShapeKinds:[...enabledShapeKinds]}:{}), ...video, ...(background.grid?{gridBackground:background.grid}:{}), lineWidth:background.lineWidth, glowIntensity:background.glowIntensity, ...animation, density, ...(colorSettings ? {colorSettings} : {}), textOverlay, schemaVersion: 1, algorithmVersion: version, seed, aspectRatio: ratio,
      backgroundMode: background.mode, solidColor: background.solid, gradientColors: [...background.colors],
      gradientAngle: background.angle, exportWidth: w, exportHeight: h };
  }
  async function save(format: 'png' | 'svg' | 'json') {
    setError(''); setMessage(''); setBusy(true);
    try {
      const current = snapshot();
      if (invalid) throw new Error(invalid);
      const stem = fileStem(current.seed,version);
      if (format === 'json') {
        downloadBlob(new Blob([settingsText(current)], { type: 'application/json;charset=utf-8' }), `${stem}_settings.json`);
      } else {
        const source = artwork(magicTransparent);
        if (!source) throw new Error('プレビューの描画完了後に再度お試しください。');
        const svg = serializeArtwork(source, w, h, background.mode === 'solid' ? background.solid : background.colors[0],magicTransparent);
        const blob = format === 'svg' ? new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }) : await pngBlob(svg, w, h);
        downloadBlob(blob, `${stem}_${w}x${h}${magicTransparent?'_transparent':''}.${format}`);
      }
      setMessage(`${format.toUpperCase()}の保存を開始しました。`);
    } catch (e) { setError(e instanceof Error ? e.message : '保存に失敗しました。解像度を下げて再度お試しください。'); }
    finally { setBusy(false); }
  }
  async function restore(file?: File) {
    if (!file) return;
    setBusy(true); setError(''); setMessage('');
    try {
      if (file.size > MAX_SETTINGS_BYTES) throw new Error('設定JSONは64KB以下にしてください。');
      const settings = parseSettings(await file.text());
      onRestore(settings); setVideo(videoSettings(settings)); setCustom(true); setWidth(String(settings.exportWidth)); setHeight(String(settings.exportHeight));
      setMessage(settings.algorithmVersion==='2d-v4'?'旧v4設定を読み込み、元の構図を保持しました。新版への変更は生成アルゴリズムから選べます。':'設定を読み込み、プレビューを更新しました。');
    } catch (e) { setError(e instanceof Error ? e.message : '設定を読み込めませんでした。'); }
    finally { setBusy(false); if (fileInput.current) fileInput.current.value = ''; }
  }
  return <section className="export-panel" aria-labelledby="export-heading">
    <div className="section-heading"><h3 id="export-heading">保存・再利用</h3><span className="tiny-label">EXPORT / SETTINGS</span></div>
    <label htmlFor="export-preset">書き出し解像度</label>
    <select id="export-preset" value={!custom && EXPORT_PRESETS.some(p => p.width === w && p.height === h) ? `${w}x${h}` : 'custom'} disabled={busy}
      onChange={e => { const preset = EXPORT_PRESETS.find(p => `${p.width}x${p.height}` === e.target.value);
        if (!preset) { setCustom(true); return; }
        if (preset) { setCustom(false); setWidth(String(preset.width)); setHeight(String(preset.height)); onRatio(preset.ratio); } }}>
      {EXPORT_PRESETS.map(p => <option key={p.width} value={`${p.width}x${p.height}`}>{p.width} × {p.height}</option>)}
      <option value="custom">カスタム（下の幅・高さを入力）</option>
    </select>
    <div className="export-dimensions">
      <label htmlFor="export-width">幅 (px)<input id="export-width" type="number" min="256" max="8192" step="1" inputMode="numeric" value={width} disabled={busy} aria-invalid={!!invalid} aria-describedby="resolution-feedback" onChange={e => { setCustom(true); setWidth(e.target.value); }} /></label>
      <span aria-hidden="true">×</span>
      <label htmlFor="export-height">高さ (px)<input id="export-height" type="number" min="256" max="8192" step="1" inputMode="numeric" value={height} disabled={busy} aria-invalid={!!invalid} aria-describedby="resolution-feedback" onChange={e => { setCustom(true); setHeight(e.target.value); }} /></label>
    </div>
    <p id="resolution-feedback" className={invalid ? 'export-error' : 'help'}>{invalid || (tooLarge ? 'PNGは合計16,777,216画素まで。SVG・JSONは保存できます。' : '256〜8192px。PNGは合計16,777,216画素まで。')}</p>
    {margins && <p className="help">構図と書き出しの比率が異なるため、中央配置して{magicTransparent?'透明な':'背景色の'}余白を追加します。図形は変形・切り取りしません。</p>}
    {version===MAGIC_ALGORITHM_VERSION&&<p className="help" data-testid="magic-export-info">{magicTransparent?'透過保存ON：魔法陣の線だけをアルファ付きPNG / 背景なしSVGで保存します。':'背景付き保存：魔法陣の設定から透過PNG / SVGに切り替えられます。'}</p>}
    <div className="export-actions">
      <button type="button" disabled={busy || !!invalid || tooLarge} onClick={() => void save('png')}>{busy ? '処理中…' : 'PNGを書き出す'}</button>
      <button type="button" disabled={busy || !!invalid} onClick={() => void save('svg')}>SVGを書き出す</button>
      <button type="button" disabled={busy || !!invalid} onClick={() => void save('json')}>設定JSONを保存</button>
      <button type="button" disabled={busy} onClick={() => fileInput.current?.click()}>設定JSONを読み込む</button>
    </div>
    <input ref={fileInput} type="file" accept=".json,application/json" aria-label="設定JSONファイル" hidden disabled={busy} onChange={e => void restore(e.target.files?.[0])} />
    {error && <p className="export-error" role="alert">{error}</p>}
    <p className="export-message" role="status" aria-live="polite">{message}</p>
    <VideoPanel settings={video} onChange={setVideo} artwork={videoArtwork} />
  </section>;
}
