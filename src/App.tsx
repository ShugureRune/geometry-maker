import { darkTheme } from './themes';
import { renderToStaticMarkup } from 'react-dom/server';
import { AnimationControls,usePlayback } from './AnimationControls';
import { defaults,schedule,progressAt,type AnimationSettings } from './animation';
import { densityCandidates, visibleScene } from './density';
import { ColorEditor } from './ColorEditor';
import { coloredBackground, legacyColors, reseedColors, rerollColor, type Slot, type ColorSettings } from './colors';
import { useMemo, useRef, useState } from 'react';
import { ExportPanel } from './ExportPanel';
import { Preview } from './Preview';
import { ALGORITHM_VERSION, LEGACY_ALGORITHM_VERSION, type AlgorithmVersion, createRandomSeed, generateScene, RATIOS, type Background, type Ratio } from './scene';

const initialBackground: Background = {glowIntensity:0,mode:'gradient',solid:'#111526',colors:['#101b2d','#241938','#102a30'],angle:135};
const initialColors = reseedColors({...legacyColors(initialBackground),mode:'seed'},'undefined-heartbeat');

export default function App() {
  const artworkRef = useRef<HTMLDivElement>(null);
  const [seed, setSeed] = useState('undefined-heartbeat');
  const [version,setVersion]=useState<AlgorithmVersion>(ALGORITHM_VERSION);
  const committedSeed=useRef(seed);
  const [ratio, setRatio] = useState<Ratio>('16:9');
  const [background, setBackground] = useState<Background>(()=>coloredBackground(initialBackground,initialColors));
  const [colorSettings,setColorSettings] = useState<ColorSettings | undefined>(initialColors);
  const activeColors = colorSettings ?? legacyColors(background);
  function applyColors(c:ColorSettings) { setColorSettings(c);setBackground(bg=>coloredBackground(bg,c)); }
  function changeSeed(value:string) {setSeed(value);if(colorSettings)applyColors(reseedColors(colorSettings,value));}
  function editor(id:Slot,label:string) { const slot=activeColors.slots[id];return <ColorEditor label={label} value={slot.color} locked={slot.locked}
   onColor={color=>applyColors({...activeColors,edited:[...new Set([...(activeColors.edited??[]),id])],slots:{...activeColors.slots,[id]:{...slot,color}}})}
   onRoll={()=>applyColors(rerollColor(activeColors,seed,id))}
   onLock={()=>applyColors({...activeColors,slots:{...activeColors.slots,[id]:{...slot,locked:!slot.locked}}})}/>; }
  const [regenerations, setRegenerations] = useState(0);
  const [density,setDensity] = useState(50);
  const baseScene = useMemo(() => generateScene(seed, ratio, version), [seed, ratio, version]);
  const candidates = useMemo(()=>densityCandidates(baseScene,seed),[baseScene,seed]);
  const scene = useMemo(()=>visibleScene(baseScene,candidates,density),[baseScene,candidates,density]);

  const [animation,setAnimation]=useState<AnimationSettings>(defaults);
  const playback=usePlayback(animation);
  const cues=useMemo(()=>schedule(candidates,seed,version),[candidates,seed,version]);
  function replayOnRegenerate(){if(animation.animationEnabled)playback.restart(true);}
  function commitSeed(){if(committedSeed.current!==seed){committedSeed.current=seed;replayOnRegenerate();}}
  function randomizeSeed(){const value=createRandomSeed();committedSeed.current=value;changeSeed(value);replayOnRegenerate();}
  const growth=animation.animationEnabled?Object.fromEntries(scene.shapes.map(s=>[s.id,progressAt(cues[s.id],playback.position,animation.easingType)])):undefined;
  function completedArtwork(){return new DOMParser().parseFromString(renderToStaticMarkup(<Preview scene={scene} background={background}/>),'image/svg+xml').documentElement as unknown as SVGSVGElement;}
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
          <div className="seed-row"><input id="seed" value={seed} onChange={e => changeSeed(e.target.value)} onBlur={commitSeed} onKeyDown={e=>{if(e.key==='Enter'&&!e.nativeEvent.isComposing&&e.keyCode!==229)commitSeed();}} spellCheck={false} autoComplete="off" /><button className="dice-button" type="button" onClick={randomizeSeed} aria-label="ランダムシードを生成" title="ランダムシードを生成">⚄ <span>ランダム</span></button></div>
          <p className="help">文字列・数値に対応。同じ値で同じ模様を再現。Enterまたは入力欄を離れると確定します。</p>
          <label htmlFor="algorithm-version">生成アルゴリズム</label>
          <select id="algorithm-version" value={version} onChange={e=>setVersion(e.target.value as AlgorithmVersion)}>
            <option value={ALGORITHM_VERSION}>v5 — 多様な構図と図形</option><option value={LEGACY_ALGORITHM_VERSION}>v4 — 旧構図を保持</option>
          </select>
          {version===LEGACY_ALGORITHM_VERSION&&<p className="help">旧v4設定の構図を保持しています。v5を選ぶと新しい構図に変わります。</p>}
        </section>

        <section className="control-section" aria-labelledby="background-heading">
          <div className="section-heading"><h3 id="background-heading"><span>02</span> 背景</h3><span className="tiny-label">BACKGROUND</span></div>
          <div className="segmented" role="group" aria-label="背景の種類">
            <button type="button" aria-pressed={background.mode === 'solid'} onClick={() => setBackground({ ...background, mode: 'solid' })}>単色</button>
            <button type="button" aria-pressed={background.mode === 'gradient'} onClick={() => setBackground({ ...background, mode: 'gradient' })}>グラデーション</button>
          </div>
          {background.mode === 'solid' ? editor('solid','背景色') : <>
            {editor('gradient0','グラデーション色1')}{editor('gradient1','グラデーション色2')}{editor('gradient2','グラデーション色3')}
            <label className="range-label" htmlFor="angle">方向 <output htmlFor="angle">{background.angle}°</output></label>
            <input id="angle" type="range" min="0" max="360" value={background.angle} onChange={e => setBackground({ ...background, angle: Number(e.target.value) })} />
          </>}
        </section>

        <section className="control-section">
          <h3>配色の生成</h3>
          <div className="play-buttons" aria-label="暗色テーマ"><button onClick={()=>applyColors(darkTheme(activeColors,seed,'night'))}>ミッドナイト</button><button onClick={()=>applyColors(darkTheme(activeColors,seed,'neon'))}>ネオンナイト</button></div>
          <p className="help">暗色テーマは固定していない色に適用します。単色・グラデーションの両方に対応します。</p>
          <label className="range-label" htmlFor="glow-intensity">発光強度 <output>{background.glowIntensity??0}%</output></label>
          <input id="glow-intensity" type="range" min="0" max="100" step="5" value={background.glowIntensity??0} onChange={e=>setBackground({...background,glowIntensity:+e.target.value})}/>
          <p className="help">0%は発光なし。主役を強め、補助・装飾は控えめに光らせます。</p>
          <label htmlFor="color-mode">カラー変更モード</label>
          <select id="color-mode" value={activeColors.mode} onChange={e=>applyColors(reseedColors({...activeColors,edited:activeColors.mode==='seed'?['primary','support','accent']:activeColors.edited,mode:e.target.value as 'manual'|'seed'},seed))}>
            <option value="manual">手動色を維持</option><option value="seed">シードに連動</option>
          </select>
          <label htmlFor="color-appearance">自動配色の明暗</label>
          <select id="color-appearance" value={activeColors.appearance} onChange={e=>applyColors(reseedColors({...activeColors,appearance:e.target.value as ColorSettings['appearance']},seed))}>
            <option value="seed">シードで決定</option><option value="light">明るい背景向け</option><option value="dark">暗い背景向け</option>
          </select>
          {editor('primary','主役色')}{editor('support','補助色')}{editor('accent','アクセント色')}
          <p className="help">シード連動が初期状態です。固定中も手動編集・個別再抽選ができます。入力色をそのまま描画します。</p>
        </section>
        <section className="control-section ratio-section" aria-labelledby="ratio-heading">
          <div className="section-heading"><h3 id="ratio-heading"><span>03</span> 縦横比</h3><span className="tiny-label">ASPECT RATIO</span></div>
          <label htmlFor="ratio">キャンバスの比率</label>
          <select id="ratio" value={ratio} onChange={e => setRatio(e.target.value as Ratio)}>
            {Object.keys(RATIOS).map(value => <option key={value} value={value}>{value}{value === '16:9' ? ' — ワイド' : value === '9:16' ? ' — 縦長' : value === '1:1' ? ' — スクエア' : ''}</option>)}
          </select>
          <p className="help">図形の形を保ったまま、構図を調整します。</p>
        </section>

        <section className="control-section">
          <label className="range-label" htmlFor="density">図形密度 <output htmlFor="density">{density}%</output></label>
          <input id="density" type="range" min="0" max="100" step="5" value={density} onChange={e=>setDensity(Number(e.target.value))}/>
          <p className="help">0%は背景のみ。50%が標準。主役の位置を保って図形量を調整します。</p>
        </section>
        <AnimationControls settings={animation} onChange={setAnimation} playback={playback}/>
        <button type="button" className="generate-button" onClick={() => {setRegenerations(n => n + 1);committedSeed.current=seed;replayOnRegenerate();}}><span aria-hidden="true">↻</span> 同じ設定で再生成</button>
        <p className="local-note"><span aria-hidden="true">◉</span> ブラウザ内で生成・通信なし</p>
      </aside>

      <section className="preview-panel" aria-labelledby="preview-heading">
        <div className="preview-toolbar"><div><span className="eyebrow">YOUR CANVAS</span><h2 id="preview-heading">ライブプレビュー</h2></div><span className="live-indicator"><i /> リアルタイム反映</span></div>
        <div className="canvas-stage"><div ref={artworkRef} className="canvas-frame" style={{ aspectRatio: `${scene.width} / ${scene.height}`, width: `min(100%, calc(58vh * ${scene.width / scene.height}))` }}><Preview scene={scene} background={background} growth={growth} /></div></div>
        <div className="canvas-info"><span>{ratio} <span className="info-divider">/</span> SVG · 2D</span><span>{scene.shapes.length} SHAPES</span></div>
        <div className="seed-card"><span className="seed-card-icon" aria-hidden="true">⌘</span><div><span className="tiny-label">CURRENT SEED</span><code data-testid="current-seed">{seed === '' ? '（空文字）' : seed}</code></div><span className="algorithm">{version}</span></div>
        <p className="preview-hint" role="status">{regenerations > 0 ? `再生成しました（${regenerations}回）。同じシードと設定の模様です。` : '設定を変えると、プレビューが自動で更新されます。'}</p>
      </section>
      <div className="export-area">
        <ExportPanel version={version} density={density} colorSettings={activeColors} seed={seed} ratio={ratio} background={background} animation={animation} artwork={completedArtwork}
          onRatio={setRatio} onRestore={settings => {
            setDensity(settings.density ?? 50);
            setAnimation({animationEnabled:settings.animationEnabled??false,animationDuration:settings.animationDuration??8,playbackSpeed:settings.playbackSpeed??1,easingType:settings.easingType??'ease-in-out'});playback.setPlaying(false);playback.setPosition(0);
            setVersion(settings.algorithmVersion as AlgorithmVersion);committedSeed.current=settings.seed;
            setSeed(settings.seed); setRatio(settings.aspectRatio);
            const bg:Background={glowIntensity:settings.glowIntensity??0,mode:settings.backgroundMode,solid:settings.solidColor,colors:settings.gradientColors,angle:settings.gradientAngle};
            setColorSettings(settings.colorSettings);
            setBackground(settings.colorSettings ? coloredBackground(bg,settings.colorSettings) : bg);
            setRegenerations(0);
          }} />
      </div>
    </main>
    <footer><span>GENERATIVE DESIGN, DETERMINISTIC BY NATURE.</span><span>第3.5段階 · 2D成長と多様性</span></footer>
  </div>;
}
