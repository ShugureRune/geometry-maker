import { useMemo, useRef, useState } from 'react';
import { ExportPanel } from './ExportPanel';
import { Preview } from './Preview';
import { ALGORITHM_VERSION, createRandomSeed, generateScene, RATIOS, type Background, type Ratio } from './scene';

export default function App() {
  const artworkRef = useRef<HTMLDivElement>(null);
  const [seed, setSeed] = useState('undefined-heartbeat');
  const [ratio, setRatio] = useState<Ratio>('16:9');
  const [background, setBackground] = useState<Background>({
    mode: 'gradient', solid: '#111526', colors: ['#101b2d', '#241938', '#102a30'], angle: 135,
  });
  const [regenerations, setRegenerations] = useState(0);
  const scene = useMemo(() => generateScene(seed, ratio), [seed, ratio, regenerations]);

  return <div className="app">
    <header className="topbar">
      <div className="brand"><span className="brand-mark" aria-hidden="true">◇</span><div><h1>幾何学メーカー</h1><span className="brand-sub">GEOMETRY / BACKGROUND STUDIO</span></div></div>
      <div className="mode-badge"><span /> 2D STUDIO <span className="version">v0.1</span></div>
    </header>

    <main className="workspace">
      <aside className="controls" aria-label="生成設定">
        <div className="panel-intro"><span className="eyebrow">MAKE IT YOURS</span><h2>ひとつのシードから、<br />あなただけの幾何学を。</h2><p>文字や数字を変えて、新しい構図に出会う。</p></div>

        <section className="control-section" aria-labelledby="seed-heading">
          <div className="section-heading"><h3 id="seed-heading"><span>01</span> シード</h3><span className="tiny-label">SEED</span></div>
          <label htmlFor="seed">シード値</label>
          <div className="seed-row"><input id="seed" value={seed} onChange={e => setSeed(e.target.value)} spellCheck={false} autoComplete="off" /><button className="dice-button" type="button" onClick={() => setSeed(createRandomSeed())} aria-label="ランダムシードを生成" title="ランダムシードを生成">⚄ <span>ランダム</span></button></div>
          <p className="help">文字列・数値に対応。同じ値で同じ模様を再現。</p>
        </section>

        <section className="control-section" aria-labelledby="background-heading">
          <div className="section-heading"><h3 id="background-heading"><span>02</span> 背景</h3><span className="tiny-label">BACKGROUND</span></div>
          <div className="segmented" role="group" aria-label="背景の種類">
            <button type="button" aria-pressed={background.mode === 'solid'} onClick={() => setBackground({ ...background, mode: 'solid' })}>単色</button>
            <button type="button" aria-pressed={background.mode === 'gradient'} onClick={() => setBackground({ ...background, mode: 'gradient' })}>グラデーション</button>
          </div>
          {background.mode === 'solid' ? <div className="color-row"><label htmlFor="solid">背景色</label><div className="color-value"><code>{background.solid}</code><input id="solid" type="color" value={background.solid} onChange={e => setBackground({ ...background, solid: e.target.value })} /></div></div> : <>
            <div className="gradient-swatches">{background.colors.map((color, index) => <label key={index} className="swatch">カラー {index + 1}<input type="color" aria-label={`グラデーション色${index + 1}`} value={color} onChange={e => {
              const colors = [...background.colors] as Background['colors'];
              colors[index] = e.target.value;
              setBackground({ ...background, colors });
            }} /><code>{color}</code></label>)}</div>
            <label className="range-label" htmlFor="angle">方向 <output htmlFor="angle">{background.angle}°</output></label>
            <input id="angle" type="range" min="0" max="360" value={background.angle} onChange={e => setBackground({ ...background, angle: Number(e.target.value) })} />
          </>}
        </section>

        <section className="control-section ratio-section" aria-labelledby="ratio-heading">
          <div className="section-heading"><h3 id="ratio-heading"><span>03</span> 縦横比</h3><span className="tiny-label">ASPECT RATIO</span></div>
          <label htmlFor="ratio">キャンバスの比率</label>
          <select id="ratio" value={ratio} onChange={e => setRatio(e.target.value as Ratio)}>
            {Object.keys(RATIOS).map(value => <option key={value} value={value}>{value}{value === '16:9' ? ' — ワイド' : value === '9:16' ? ' — 縦長' : value === '1:1' ? ' — スクエア' : ''}</option>)}
          </select>
          <p className="help">図形の形を保ったまま、構図を調整します。</p>
        </section>

        <button type="button" className="generate-button" onClick={() => setRegenerations(n => n + 1)}><span aria-hidden="true">↻</span> 同じ設定で再生成</button>
        <p className="local-note"><span aria-hidden="true">◉</span> ブラウザ内で生成・通信なし</p>
      </aside>

      <section className="preview-panel" aria-labelledby="preview-heading">
        <div className="preview-toolbar"><div><span className="eyebrow">YOUR CANVAS</span><h2 id="preview-heading">ライブプレビュー</h2></div><span className="live-indicator"><i /> リアルタイム反映</span></div>
        <div className="canvas-stage"><div ref={artworkRef} className="canvas-frame" style={{ aspectRatio: `${scene.width} / ${scene.height}`, width: `min(100%, calc(58vh * ${scene.width / scene.height}))` }}><Preview scene={scene} background={background} /></div></div>
        <div className="canvas-info"><span>{ratio} <span className="info-divider">/</span> SVG · 2D</span><span>{scene.shapes.length} SHAPES</span></div>
        <div className="seed-card"><span className="seed-card-icon" aria-hidden="true">⌘</span><div><span className="tiny-label">CURRENT SEED</span><code data-testid="current-seed">{seed === '' ? '（空文字）' : seed}</code></div><span className="algorithm">{ALGORITHM_VERSION}</span></div>
        <p className="preview-hint" role="status">{regenerations > 0 ? `再生成しました（${regenerations}回）。同じシードと設定の模様です。` : '設定を変えると、プレビューが自動で更新されます。'}</p>
        <ExportPanel seed={seed} ratio={ratio} background={background} artwork={() => artworkRef.current?.querySelector('svg') ?? null}
          onRatio={setRatio} onRestore={settings => {
            setSeed(settings.seed); setRatio(settings.aspectRatio);
            setBackground({ mode: settings.backgroundMode, solid: settings.solidColor, colors: settings.gradientColors, angle: settings.gradientAngle });
            setRegenerations(0);
          }} />
      </section>
    </main>
    <footer><span>GENERATIVE DESIGN, DETERMINISTIC BY NATURE.</span><span>第1段階 · 2D基本機能</span></footer>
  </div>;
}
