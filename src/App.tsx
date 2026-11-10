import { SettingsCategories, type Category } from './SettingsCategories';
import {ShapeKindControls} from './ShapeKindControls';
import {ALL_SHAPE_KINDS,type ShapeKind} from './shape-controls';
import { AmbientControls, AmbientStage, useAmbientClock, ambientDefaults } from './AmbientControls';
import {figureScrollAngle} from './ambient';
import { darkTheme,VISUAL_THEMES,THEME_PRESETS,applyThemePalette,themeScene,type VisualTheme } from './themes';
import { renderToStaticMarkup } from 'react-dom/server';
import { AnimationControls,usePlayback } from './AnimationControls';
import { defaults,schedule,progressAt,type AnimationSettings } from './animation';
import { densityCandidates, visibleScene } from './density';
import { ColorEditor } from './ColorEditor';
import {GridBackgroundControls} from './GridBackgroundControls';
import {gridBackgroundDefaults} from './grid-background';
import {useGridClock} from './useGridClock';
import {ImagePaletteControls} from './ImagePaletteControls';
import {TextControls} from './TextControls';
import {useTextEntrancePreview} from './preview-text-animation';
import {PreviewTextEditor} from './PreviewTextEditor';
import {textOverlayDefaults,type TextOverlaySettings} from './text-overlay';
import {applyImagePalette} from './image-palette';
import { coloredBackground, legacyColors, reseedColors, rerollColor, type Slot, type ColorSettings } from './colors';
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import {generateThreeComposition, spaceThreeComposition, THREE_ALGORITHM_VERSION, visibleThreeObjects} from './three/model';
import {generateCelestialBodies, celestialDefaults} from './three/celestial';
import {threeDefaults, type ThreePreviewHandle, type ThreeSettings, type ThreeView} from './three/settings';
import {ThreeShapeControls, ThreeMaterialControls, ThreeAnimationControls} from './three/ThreeControls';
import {ThreeExportPanel} from './three/ThreeExportPanel';
import {ThreeBoundary} from './three/ThreeBoundary';
import {ThreeStyleControls} from './three/ThreeStyleControls';
import {FloorGridControls} from './three/FloorGridControls';
import {floorGridDefaults} from './three/floor-grid';
import type {ThreeProject} from './three/project';
import './three/three.css';
import { ExportPanel } from './ExportPanel';
import { Preview } from './Preview';
import { ALGORITHM_VERSION, LEGACY_ALGORITHM_VERSION, type AlgorithmVersion, createRandomSeed, generateScene, RATIOS, type Background, type Ratio } from './scene';

const initialBackground: Background = {glowIntensity:100,mode:'gradient',solid:'#111526',colors:['#101b2d','#241938','#102a30'],angle:135};
const ThreePreview = lazy(() => import('./three/ThreePreview'));


export default function App() {
  const [renderMode,setRenderMode]=useState<'2d'|'3d'>('2d');
  const [category,setCategory]=useState<Category|null>('shapes');
  const [threeCategory,setThreeCategory]=useState<Category|null>('shapes');
  const activeCategory=renderMode==='2d'?category:threeCategory;
  const [threeSettings,setThreeSettings]=useState<ThreeSettings>(()=>({...threeDefaults,animation:!matchMedia('(prefers-reduced-motion: reduce)').matches}));
  const threeApi=useRef<ThreePreviewHandle|null>(null);
  const threeView=useRef<ThreeView|undefined>(undefined);
  const [threeReady,setThreeReady]=useState(false);
  const [threeRestore,setThreeRestore]=useState({serial:0,time:0});
  const resume2D=useRef({growth:false,ambient:false});
  const [visualTheme,setVisualTheme]=useState<VisualTheme>('standard');
  const [textOverlay,setTextOverlay]=useState<TextOverlaySettings>({...textOverlayDefaults});
  const entrancePreview=useTextEntrancePreview(textOverlay);
  const [enabledShapeKinds,setEnabledShapeKinds]=useState<ShapeKind[]>(()=>[...ALL_SHAPE_KINDS]);
  const lastGlow=useRef(100);
  const [ratio, setRatio] = useState<Ratio>('16:9');
  const [ambient,setAmbient]=useState({...ambientDefaults});
  const ambientClock=useAmbientClock(ambient.enabled,ambient.lowPower,ambient,ratio);
  const artworkRef = useRef<HTMLDivElement>(null);
  const [seed, setSeed] = useState(createRandomSeed);
  const [initialColors]=useState(()=>reseedColors({...legacyColors(initialBackground),mode:'seed'},seed));
  const [uiTheme,setUiTheme]=useState(()=>{try{return localStorage.getItem('geometry-ui-theme')==='light'?'light':'dark';}catch{return 'dark';}});
  useEffect(()=>{document.documentElement.dataset.theme=uiTheme;try{localStorage.setItem('geometry-ui-theme',uiTheme);}catch{}},[uiTheme]);
  const [version,setVersion]=useState<AlgorithmVersion>(ALGORITHM_VERSION);
  const committedSeed=useRef(seed);
  const [background, setBackground] = useState<Background>(()=>({...coloredBackground(initialBackground,initialColors),lineWidth:125}));
  const gridSeconds=useGridClock(renderMode==='2d'&&!ambient.enabled&&!!background.grid?.enabled&&!!background.grid?.animation?.enabled);
  const [colorSettings,setColorSettings] = useState<ColorSettings | undefined>(initialColors);
  const activeColors = colorSettings ?? legacyColors(background);
  // Old manual 2D settings may omit figureColors intentionally. In 3D the
  // visible color slots are always the material colors, including locked slots.
  const threeBackground=useMemo(()=>({...background,figureColors:{primary:activeColors.slots.primary.color,support:activeColors.slots.support.color,accent:activeColors.slots.accent.color}}),[background,activeColors]);
  function applyColors(c:ColorSettings) { setColorSettings(c);setBackground(bg=>coloredBackground(bg,c)); }
  function changeSeed(value:string) {setSeed(value);if(colorSettings)applyColors(reseedColors(colorSettings,value));}
  function editor(id:Slot,label:string) { const slot=activeColors.slots[id];return <ColorEditor label={label} value={slot.color} locked={slot.locked}
   onColor={color=>applyColors({...activeColors,edited:[...new Set([...(activeColors.edited??[]),id])],slots:{...activeColors.slots,[id]:{...slot,color}}})}
   onRoll={()=>applyColors(rerollColor(activeColors,seed,id))}
   onLock={()=>applyColors({...activeColors,slots:{...activeColors.slots,[id]:{...slot,locked:!slot.locked}}})}/>; }
  const [regenerations, setRegenerations] = useState(0);
  const [density,setDensity] = useState(50);
  const baseScene = useMemo(() => generateScene(seed, ratio, version,enabledShapeKinds), [seed, ratio, version,enabledShapeKinds]);
  const candidates = useMemo(()=>densityCandidates(baseScene,seed),[baseScene,seed]);
  const scene = useMemo(()=>themeScene(visibleScene(baseScene,candidates,density),visualTheme,seed),[baseScene,candidates,density,visualTheme,seed]);

  const [animation,setAnimation]=useState<AnimationSettings>({...defaults,animationEnabled:true});
  const playback=usePlayback(animation);
  useEffect(()=>{if(ambient.enabled)playback.setPlaying(false);},[ambient.enabled]);
  useEffect(()=>{playback.restart(true);},[]);
  const cues=useMemo(()=>schedule(candidates,seed,version),[candidates,seed,version]);
  function replayOnRegenerate(){if(renderMode==='2d'&&animation.animationEnabled)playback.restart(true);}
  function switchRenderMode(next:'2d'|'3d'){
    if(next===renderMode)return;
    if(next==='3d'){
      resume2D.current={growth:playback.playing,ambient:ambientClock.playing};
      playback.setPlaying(false);ambientClock.pause();setThreeReady(false);
    }else{
      if(resume2D.current.growth)playback.setPlaying(true);
      if(resume2D.current.ambient)ambientClock.play();
    }
    setRenderMode(next);
  }
  // Transform spacing only after deterministic geometry has been generated.
  // The scene seed, candidate selection, IDs and density remain unchanged.
  const threeBaseComposition=useMemo(()=>renderMode==='3d'?generateThreeComposition(seed,ratio):null,[renderMode,seed,ratio]);
  const threeComposition=useMemo(()=>threeBaseComposition?
    spaceThreeComposition(threeBaseComposition,threeSettings.spacingPercent??100):null,
    [threeBaseComposition,threeSettings.spacingPercent]);
  function commitSeed(){if(committedSeed.current!==seed){committedSeed.current=seed;replayOnRegenerate();}}
  function randomizeSeed(){const value=createRandomSeed();committedSeed.current=value;changeSeed(value);replayOnRegenerate();}
  function chooseVisualTheme(theme:VisualTheme){
   setVisualTheme(theme);
   if(theme==='standard'){
    const colors=reseedColors({...activeColors,mode:'seed',appearance:'seed'},seed);
    applyColors(colors);
    setBackground(bg=>({...coloredBackground(bg,colors),mode:'gradient',angle:135,lineWidth:125,glowIntensity:100}));
   }else{
    const preset=applyThemePalette(activeColors,background,theme);
    setColorSettings(preset.colors);setBackground(preset.background);
    if(preset.background.glowIntensity)lastGlow.current=preset.background.glowIntensity;
   }
   replayOnRegenerate();
  }
  const growth=animation.animationEnabled?Object.fromEntries(scene.shapes.map(s=>[s.id,progressAt(cues[s.id],playback.position,animation.easingType)])):undefined;
  function completedArtwork(){return new DOMParser().parseFromString(renderToStaticMarkup(<Preview scene={scene} background={background} textOverlay={textOverlay} gridSeconds={gridSeconds} gridFigureAngle={figureScrollAngle(ambient,ratio)}/>),'image/svg+xml').documentElement as unknown as SVGSVGElement;}
  return <div className="app">
    <header className="topbar">
      <div className="brand"><span className="brand-mark" aria-hidden="true">◇</span><div><h1>幾何学メーカー</h1><span className="brand-sub">GEOMETRY / BACKGROUND STUDIO</span></div></div>
      <div className="render-mode-switch segmented" role="group" aria-label="描画モード">
        <button type="button" aria-pressed={renderMode==='2d'} onClick={()=>switchRenderMode('2d')}>2Dモード</button>
        <button type="button" aria-pressed={renderMode==='3d'} onClick={()=>switchRenderMode('3d')}>3Dモード</button>
      </div>
      <button className="ui-theme-button" onClick={()=>setUiTheme(t=>t==='dark'?'light':'dark')} aria-label="UIテーマ切り替え">{uiTheme==='dark'?'ライトモード':'ダークモード'}</button><div className="mode-badge"><span /> {renderMode==='2d'?'2D':'3D'} STUDIO <span className="version">v0.1</span></div>
    </header>

    <main className="workspace">
      <aside className="controls" aria-label="生成設定">
        <div className="panel-intro"><span className="eyebrow">MAKE IT YOURS</span><h2>ひとつのシードから、<br />あなただけの幾何学を。</h2><p>文字や数字を変えて、新しい構図に出会う。</p></div>

        <SettingsCategories active={activeCategory} onChange={renderMode==='2d'?setCategory:setThreeCategory} disabled={renderMode==='3d'?['text']:[]}/>
        <div id="panel-shapes" className="category-panel" data-category="shapes" role="region" aria-labelledby="category-shapes" hidden={activeCategory!=='shapes'}>
          <h2 className="category-title">図形</h2>
        <section className="control-section" aria-labelledby="seed-heading">
          <div className="section-heading"><h3 id="seed-heading"><span>01</span> シード</h3><span className="tiny-label">SEED</span></div>
          <label htmlFor="seed">シード値</label>
          <div className="seed-row"><input id="seed" value={seed} onChange={e => changeSeed(e.target.value)} onBlur={commitSeed} onKeyDown={e=>{if(e.key==='Enter'&&!e.nativeEvent.isComposing&&e.keyCode!==229)commitSeed();}} spellCheck={false} autoComplete="off" /><button className="dice-button" type="button" onClick={randomizeSeed} aria-label="ランダムシードを生成" title="ランダムシードを生成">⚄ <span>ランダム</span></button></div>
          <p className="help">文字列・数値に対応。同じ値で同じ模様を再現。Enterまたは入力欄を離れると確定します。</p>
          <div hidden={renderMode==='3d'}><label className="algorithm-label" htmlFor="algorithm-version">生成アルゴリズム</label>
          <select id="algorithm-version" value={version} onChange={e=>setVersion(e.target.value as AlgorithmVersion)}>
            <option value={ALGORITHM_VERSION}>v5 — 拡張モード</option><option value={LEGACY_ALGORITHM_VERSION}>v4 — クラシックモード</option>
          </select>
          {version===LEGACY_ALGORITHM_VERSION&&<p className="help">旧v4設定の構図を保持しています。v5を選ぶと新しい構図に変わります。図形の種類別設定はv5で有効です。</p>}</div>
        </section>
        {renderMode==='2d'&&version===ALGORITHM_VERSION&&<ShapeKindControls enabled={enabledShapeKinds} onChange={setEnabledShapeKinds}/>}
        {renderMode==='3d'&&<ThreeShapeControls settings={threeSettings} onChange={setThreeSettings}/>}

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
          <p className="help">{renderMode==='3d'?'0%は背景のみ。主役の位置を保って3Dオブジェクトを段階的に追加します。':'0%は背景のみ。50%が標準。主役の位置を保って図形量を調整します。'}</p>
        </section>
        <button type="button" className="generate-button" aria-label="同じ設定で再生成" onClick={() => {setRegenerations(n => n + 1);committedSeed.current=seed;replayOnRegenerate();}}><span aria-hidden="true">↻</span> 同じ設定で再生成</button>
        <p className="local-note"><span aria-hidden="true">◉</span> ブラウザ内で生成・通信なし</p>
        </div>
        <div id="panel-background" className="category-panel" data-category="background" role="region" aria-labelledby="category-background" hidden={activeCategory!=='background'}>
          <h2 className="category-title">背景</h2>
        <section className="control-section" aria-labelledby="background-heading">
          <div className="section-heading"><h3 id="background-heading"><span>02</span> 背景</h3><span className="tiny-label">BACKGROUND</span></div>
          <div className="segmented" role="group" aria-label="背景の種類">
            <button type="button" aria-pressed={background.mode === 'solid'} onClick={() => setBackground({ ...background, mode: 'solid' })}>単色</button>
            <button type="button" aria-pressed={background.mode === 'gradient'} onClick={() => setBackground({ ...background, mode: 'gradient' })}>グラデーション</button>
          </div>
          {background.mode==='gradient'&&<>
            <label className="range-label" htmlFor="angle">方向 <output htmlFor="angle">{background.angle}°</output></label>
            <input id="angle" type="range" min="0" max="360" value={background.angle} onChange={e=>setBackground({...background,angle:Number(e.target.value)})}/>
          </>}
          <p className="help">背景の各色は「カラー」で編集できます。</p>
        </section>
        {renderMode==='2d'&&<GridBackgroundControls value={background.grid??gridBackgroundDefaults} onChange={grid=>setBackground(bg=>({...bg,grid}))}/>}
        {renderMode==='3d'&&<FloorGridControls value={threeSettings.floorGrid??floorGridDefaults} onChange={floorGrid=>setThreeSettings(settings=>({...settings,floorGrid}))}/>}


        </div>
        <div id="panel-colors" className="category-panel" data-category="colors" role="region" aria-labelledby="category-colors" hidden={activeCategory!=='colors'}>
          <h2 className="category-title">カラー</h2>
        <section className="control-section" aria-labelledby="theme-heading">
          <h3 id="theme-heading">ビジュアルテーマ</h3>
          <label htmlFor="visual-theme">テーマを選ぶ</label>
          <select id="visual-theme" value={visualTheme} onChange={e=>chooseVisualTheme(e.target.value as VisualTheme)}>
            {VISUAL_THEMES.map(theme=><option key={theme.id} value={theme.id}>{theme.label}</option>)}
          </select>
          <p className="help">{VISUAL_THEMES.find(theme=>theme.id===visualTheme)?.description}。テーマを変えてもシード値は維持します。</p>
          {visualTheme!=='standard'&&<div className="theme-swatches" aria-label="テーマのカラー">
            {[THEME_PRESETS[visualTheme].primary,THEME_PRESETS[visualTheme].support,THEME_PRESETS[visualTheme].accent,
              ...THEME_PRESETS[visualTheme].colors].map((color,i)=><span key={i} style={{backgroundColor:color}} title={color} aria-label={color}/>)}
          </div>}
          <p className="help">テーマに応じて図形の強弱・線・発光・背景色を変更します。下のカラー・装飾設定からさらに調整できます。</p>
        </section>
        <ImagePaletteControls onApply={(palette,scope)=>applyColors(applyImagePalette(activeColors,palette,scope))}/>
        <section className="control-section">
          <h3>背景と図形の配色</h3>
          {editor('solid','背景色')}
          {editor('gradient0','グラデーション色1')}{editor('gradient1','グラデーション色2')}{editor('gradient2','グラデーション色3')}
          <div className="play-buttons" aria-label="従来の暗色配色"><button onClick={()=>{setVisualTheme('standard');applyColors(darkTheme(activeColors,seed,'night'));}}>ミッドナイト（配色のみ）</button><button onClick={()=>{setVisualTheme('standard');applyColors(darkTheme(activeColors,seed,'neon'));}}>ネオンナイト（配色のみ）</button></div>
          <p className="help">暗色テーマは固定していない色に適用します。単色・グラデーションの両方に対応します。</p>
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

        </div>
        <div id="panel-text" className="category-panel" data-category="text" role="region" aria-labelledby="category-text" hidden={renderMode==='3d'||activeCategory!=='text'}>
          <h2 className="category-title">文字</h2>
          <TextControls settings={textOverlay} onChange={setTextOverlay} onReplay={entrancePreview.replay} previewPlaying={entrancePreview.playing}/>
        </div>
        <div id="panel-decoration" className="category-panel" data-category="decoration" role="region" aria-labelledby="category-decoration" hidden={activeCategory!=='decoration'}>
          <h2 className="category-title">装飾</h2>
        <section className="control-section">
          <label className="glow-toggle"><input type="checkbox" checked={(background.glowIntensity??0)>0} onChange={e=>{if(e.target.checked)setBackground({...background,glowIntensity:lastGlow.current||100});else{lastGlow.current=background.glowIntensity||100;setBackground({...background,glowIntensity:0});}}}/> 発光を有効化</label>
          <div hidden={renderMode==='3d'}><label className="range-label" htmlFor="line-width">線の太さ <output>{background.lineWidth ?? 125}%</output></label>
          <input id="line-width" type="range" min="50" max="300" step="5" value={background.lineWidth ?? 125} onChange={e=>setBackground({...background,lineWidth:+e.target.value})}/></div>
          <label className="range-label" htmlFor="glow-intensity">発光強度 <output>{background.glowIntensity??0}%</output></label>
          <input id="glow-intensity" type="range" min="0" max="200" step="5" value={background.glowIntensity??0} onChange={e=>setBackground({...background,glowIntensity:+e.target.value})}/>
          <p className="help">0%は発光なし。主役を強め、補助・装飾は控えめに光らせます。</p>
        </section>
        {renderMode==='3d'&&<><ThreeStyleControls settings={threeSettings} onChange={setThreeSettings}/><ThreeMaterialControls settings={threeSettings} onChange={setThreeSettings}/></>}
        </div>
        <div id="panel-animation" className="category-panel" data-category="animation" role="region" aria-labelledby="category-animation" hidden={activeCategory!=='animation'}>
          <h2 className="category-title">アニメーション</h2>
        <div hidden={renderMode==='3d'}>
        <AmbientControls input={{seed,version,ratio,density,background,colors:activeColors,animation,settings:ambient,visualTheme,enabledShapeKinds,textOverlay}} settings={ambient} onChange={setAmbient} clock={ambientClock}/>
        <AnimationControls settings={animation} onChange={setAnimation} playback={playback}/>
        </div>
        {renderMode==='3d'&&<ThreeAnimationControls settings={threeSettings} onChange={setThreeSettings}/>}
        </div>
        <div id="panel-export" className="category-panel" data-category="export" role="region" aria-labelledby="category-export" hidden={activeCategory!=='export'}>
          <h2 className="category-title">書き出し</h2>
      <div className="export-area" hidden={renderMode==='3d'}>
        <ExportPanel textOverlay={textOverlay} videoArtwork={{scene,candidates,seed,background,animation,textOverlay,ambient:{scrollFigureState:ambientClock.scrollFigureState,scrollPaletteState:ambientClock.scrollPaletteState,scrollPath:ambientClock.scrollPath,seed,version,ratio,density,background,colors:activeColors,animation,settings:ambient,visualTheme,enabledShapeKinds,textOverlay}}} version={version} density={density} colorSettings={activeColors} visualTheme={visualTheme} enabledShapeKinds={enabledShapeKinds} seed={seed} ratio={ratio} background={background} animation={animation} artwork={completedArtwork}
          onRatio={setRatio} onRestore={settings => {
            ambientClock.stop();setAmbient({...ambientDefaults,...settings.ambient,enabled:false});
            setDensity(settings.density ?? 50);setVisualTheme(settings.visualTheme??'standard');setTextOverlay(settings.textOverlay??{...textOverlayDefaults});
            setEnabledShapeKinds(settings.enabledShapeKinds??[...ALL_SHAPE_KINDS]);
            setAnimation({animationEnabled:settings.animationEnabled??false,animationDuration:settings.animationDuration??8,playbackSpeed:settings.playbackSpeed??1,easingType:settings.easingType??'ease-in-out'});playback.setPlaying(false);playback.setPosition(0);
            setVersion(settings.algorithmVersion as AlgorithmVersion);committedSeed.current=settings.seed;
            setSeed(settings.seed); setRatio(settings.aspectRatio);
            const bg:Background={grid:settings.gridBackground??gridBackgroundDefaults,lineWidth:settings.lineWidth??100,glowIntensity:settings.glowIntensity??0,mode:settings.backgroundMode,solid:settings.solidColor,colors:settings.gradientColors,angle:settings.gradientAngle};
            setColorSettings(settings.colorSettings);
            setBackground(settings.colorSettings ? coloredBackground(bg,settings.colorSettings) : bg);
            setRegenerations(0);
          }} />
      </div>
        {renderMode==='3d'&&<ThreeExportPanel api={threeApi} seed={seed} ready={threeReady}
          project={()=>({kind:'geometry-maker-3d',schemaVersion:1,algorithmVersion:THREE_ALGORITHM_VERSION,seed,aspectRatio:ratio,density,visualTheme,background,
            colorSettings:activeColors,settings:threeSettings,...(threeView.current?{view:threeView.current}:{})})}
          onRestore={(project:ThreeProject)=>{
            setThreeReady(false);setSeed(project.seed);committedSeed.current=project.seed;setRatio(project.aspectRatio);setDensity(project.density);
            setVisualTheme(project.visualTheme);setColorSettings(project.colorSettings);setBackground(project.colorSettings?coloredBackground(project.background,project.colorSettings):project.background);
            setThreeSettings(project.settings);threeView.current=project.view;setThreeRestore(previous=>({serial:previous.serial+1,time:project.elapsedSeconds}));
          }}/>}
        </div>
      </aside>

      <section className="preview-panel" aria-labelledby="preview-heading">
        <div className="preview-toolbar"><div><span className="eyebrow">YOUR CANVAS</span><h2 id="preview-heading">ライブプレビュー</h2></div><span className="live-indicator"><i /> リアルタイム反映</span></div>
        <div className="canvas-stage">
          {renderMode==='2d'?<PreviewTextEditor settings={textOverlay} onChange={setTextOverlay} onAdvanced={()=>setCategory('text')}>
            <div ref={artworkRef} className="canvas-frame" style={{ aspectRatio: `${scene.width} / ${scene.height}`, width: `min(100%, calc(var(--preview-height, 70vh) * ${scene.width / scene.height}))` }}>
              {ambient.enabled?<AmbientStage input={{seed,version,ratio,density,background,colors:activeColors,animation,settings:ambient,visualTheme,enabledShapeKinds,textOverlay}} clock={ambientClock}/>:<Preview scene={scene} background={background} growth={growth} textOverlay={textOverlay} textSeconds={entrancePreview.seconds} gridSeconds={gridSeconds} gridFigureAngle={figureScrollAngle(ambient,ratio)}/>}
            </div>
          </PreviewTextEditor>:<div className="canvas-frame three-frame" style={{aspectRatio:`${scene.width} / ${scene.height}`,width:`min(100%, calc(var(--preview-height, 70vh) * ${scene.width/scene.height}))`}}>
            <ThreeBoundary onReturn={()=>switchRenderMode('2d')}>
              <Suspense fallback={<div className="three-fallback" role="status">3Dエンジンを読み込んでいます…</div>}>
                {threeComposition&&<ThreePreview key={threeRestore.serial} initialTime={threeRestore.time} composition={threeComposition} sourceComposition={threeBaseComposition!} density={density} background={threeBackground} visualTheme={visualTheme} settings={threeSettings} restartKey={`${seed}:${ratio}:${regenerations}`} view={threeView} api={threeApi} onReady={setThreeReady}/>}
              </Suspense>
            </ThreeBoundary>
          </div>}
        </div>
        {renderMode==='3d'&&<div className="three-view-toolbar"><p>ドラッグで回転 · ホイール／ピンチでズーム</p><button type="button" disabled={!threeReady} onClick={()=>threeApi.current?.resetView()}>視点をリセット</button></div>}
        <div className="canvas-info"><span>{ratio} <span className="info-divider">/</span> {renderMode==='2d'?'SVG · 2D':'WebGL · 3D'}</span><span>{threeComposition && renderMode==='3d' ? visibleThreeObjects(threeComposition,density,threeSettings.enabledKinds).length + generateCelestialBodies(threeComposition,threeSettings.celestial??celestialDefaults,density).length : scene.shapes.length} SHAPES</span></div>
        <div className="seed-card"><span className="seed-card-icon" aria-hidden="true">⌘</span><div><span className="tiny-label">CURRENT SEED</span><code data-testid="current-seed">{seed === '' ? '（空文字）' : seed}</code></div><span className="algorithm">{renderMode==='2d'?version:THREE_ALGORITHM_VERSION}</span></div>
        <p className="preview-hint" role="status">{regenerations > 0 ? `再生成しました（${regenerations}回）。同じシードと設定の模様です。` : '設定を変えると、プレビューが自動で更新されます。'}</p>
      </section>

    </main>
    <footer><span>GENERATIVE DESIGN, DETERMINISTIC BY NATURE.</span><span>2D / 3D 背景スタジオ</span></footer>
  </div>;
}
