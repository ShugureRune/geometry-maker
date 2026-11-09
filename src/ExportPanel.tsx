import type { ColorSettings } from './colors';
import { useRef, useState } from 'react';
import { ALGORITHM_VERSION, RATIOS, type Background, type Ratio } from './scene';
import { downloadBlob, pngBlob, serializeArtwork } from './export';
import { EXPORT_PRESETS, fileStem, MAX_PNG_PIXELS, MAX_SETTINGS_BYTES, parseSettings, resolutionError, settingsText, type ProjectSettings } from './settings';

type Props = { density:number; colorSettings?:ColorSettings; seed: string; ratio: Ratio; background: Background; artwork: () => SVGSVGElement | null;
  onRatio: (ratio: Ratio) => void; onRestore: (settings: ProjectSettings) => void };
export function ExportPanel({ density, colorSettings, seed, ratio, background, artwork, onRatio, onRestore }: Props) {
  const [width, setWidth] = useState('1920'), [height, setHeight] = useState('1080');
  const [custom, setCustom] = useState(false);
  const [busy, setBusy] = useState(false), [message, setMessage] = useState(''), [error, setError] = useState('');
  const fileInput = useRef<HTMLInputElement>(null);
  const w = Number(width), h = Number(height), invalid = resolutionError(w, h);
  const tooLarge = w * h > MAX_PNG_PIXELS;
  const [sceneWidth, sceneHeight] = RATIOS[ratio];
  const margins = !invalid && Math.abs(w / h - sceneWidth / sceneHeight) > 0.001;
  function snapshot(): ProjectSettings {
    return { density, ...(colorSettings ? {colorSettings} : {}), schemaVersion: 1, algorithmVersion: ALGORITHM_VERSION, seed, aspectRatio: ratio,
      backgroundMode: background.mode, solidColor: background.solid, gradientColors: [...background.colors],
      gradientAngle: background.angle, exportWidth: w, exportHeight: h };
  }
  async function save(format: 'png' | 'svg' | 'json') {
    setError(''); setMessage(''); setBusy(true);
    try {
      const current = snapshot();
      if (invalid) throw new Error(invalid);
      const stem = fileStem(current.seed);
      if (format === 'json') {
        downloadBlob(new Blob([settingsText(current)], { type: 'application/json;charset=utf-8' }), `${stem}_settings.json`);
      } else {
        const source = artwork();
        if (!source) throw new Error('プレビューの描画完了後に再度お試しください。');
        const svg = serializeArtwork(source, w, h, background.mode === 'solid' ? background.solid : background.colors[0]);
        const blob = format === 'svg' ? new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }) : await pngBlob(svg, w, h);
        downloadBlob(blob, `${stem}_${w}x${h}.${format}`);
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
      onRestore(settings); setCustom(true); setWidth(String(settings.exportWidth)); setHeight(String(settings.exportHeight));
      setMessage('設定を読み込み、プレビューを更新しました。');
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
    {margins && <p className="help">構図と書き出しの比率が異なるため、中央配置して背景色の余白を追加します。図形は変形・切り取りしません。</p>}
    <div className="export-actions">
      <button type="button" disabled={busy || !!invalid || tooLarge} onClick={() => void save('png')}>{busy ? '処理中…' : 'PNGを書き出す'}</button>
      <button type="button" disabled={busy || !!invalid} onClick={() => void save('svg')}>SVGを書き出す</button>
      <button type="button" disabled={busy || !!invalid} onClick={() => void save('json')}>設定JSONを保存</button>
      <button type="button" disabled={busy} onClick={() => fileInput.current?.click()}>設定JSONを読み込む</button>
    </div>
    <input ref={fileInput} type="file" accept=".json,application/json" aria-label="設定JSONファイル" hidden disabled={busy} onChange={e => void restore(e.target.files?.[0])} />
    {error && <p className="export-error" role="alert">{error}</p>}
    <p className="export-message" role="status" aria-live="polite">{message}</p>
  </section>;
}
