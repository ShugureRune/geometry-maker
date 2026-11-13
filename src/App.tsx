import {HelpInfo} from './HelpInfo';
import { SettingsCategories, categories, type Category } from './SettingsCategories';
import {StudioCommandPalette, type StudioCommand} from './StudioCommandPalette';
import {ShapeKindControls} from './ShapeKindControls';
import {MagicCircleControls,MagicColorControls} from './MagicCircleControls';
import {MagicCirclePreview} from './MagicCirclePreview';
import {backgroundForMagic,magicPaletteById,magicPaletteFromSeed} from './magic-colors';
import {MAGIC_ALGORITHM_VERSION,magicDefaults,type MagicCircleSettings} from './magic-circle';
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
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import {generateThreeComposition, spaceThreeComposition, THREE_ALGORITHM_VERSION, visibleThreeObjects} from './three/model';
import {generateCelestialBodies, celestialDefaults} from './three/celestial';
import {threeDefaults, type ThreePreviewHandle, type ThreeSettings, type ThreeView} from './three/settings';
import {ThreeShapeControls, ThreeMaterialControls, ThreeAnimationControls} from './three/ThreeControls';
import {ThreeStandbyControls} from './three/ThreeStandbyControls';
import {standbyDefaults,type ThreeStandbyTransition} from './three/standby';
import {ThreeExportPanel} from './three/ThreeExportPanel';
import {ThreeBoundary} from './three/ThreeBoundary';
import {ThreeStyleControls} from './three/ThreeStyleControls';
import {FloorGridControls} from './three/FloorGridControls';
import {SkyControls} from './three/SkyControls';
import {VoidModeControls} from './three/VoidModeControls';
import {generateVoidComposition,isVoidComposition} from './three/void-graph';
import {voidDefaults,voidRenderSettings} from './three/void-settings';
import {floorGridDefaults} from './three/floor-grid';
import type {ThreeProject} from './three/project';
import {loadStudioAutosave,saveStudioAutosave,type StudioAutosave} from './studio-autosave';
import type {ProjectSettings} from './settings';
import './three/three.css';
import { ExportPanel } from './ExportPanel';
import { Preview } from './Preview';
import { ALGORITHM_VERSION, LEGACY_ALGORITHM_VERSION, type AlgorithmVersion, createRandomSeed, generateScene, RATIOS, type Background, type Ratio } from './scene';

const initialBackground: Background = {glowIntensity:100,mode:'gradient',solid:'#111526',colors:['#101b2d','#241938','#102a30'],angle:135};
const ThreePreview = lazy(() => import('./three/ThreePreview'));


export default function App() {
  // Read once, synchronously, before any state initializer or effect can
  // overwrite the last draft with a fresh random seed.
  const saved=useMemo(loadStudioAutosave,[]);
  const lastProject=saved?.twoD;
  const [renderMode,setRenderMode]=useState<'2d'|'3d'>(saved?.mode??'2d');
  const [category,setCategory]=useState<Category|null>(saved?.category??'shapes');
  const [threeCategory,setThreeCategory]=useState<Category|null>(saved?.threeCategory??'shapes');
  const activeCategory=renderMode==='2d'?category:threeCategory;
  const [studioFocus,setStudioFocus]=useState(saved?.focus??false);
  const [sidebarCollapsed,setSidebarCollapsed]=useState(saved?.collapsed??false);
  const [autosaveStatus,setAutosaveStatus]=useState<'pending'|'saved'|'unavailable'>('pending');
  const [commandOpen,setCommandOpen]=useState(false);
  const closeCommands=useCallback(()=>setCommandOpen(false),[]);
  const [sidebarWidth,setSidebarWidth]=useState(()=>{
    try{
      const stored=Number(localStorage.getItem('geometry-studio-sidebar-width'));
      return Number.isFinite(stored)&&stored>=280&&stored<=480?stored:360;
    }catch{return 360;}
  });
  useEffect(()=>{
    try{localStorage.setItem('geometry-studio-sidebar-width',String(sidebarWidth));}catch{}
  },[sidebarWidth]);
  useEffect(()=>{
    const handler=(event:KeyboardEvent)=>{
      if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='k'){
        event.preventDefault();setCommandOpen(prev=>!prev);
      }else if(event.key==='Escape'&&studioFocus&&!commandOpen){
        setStudioFocus(false);
      }
    };
    window.addEventListener('keydown',handler);
    return()=>window.removeEventListener('keydown',handler);
  },[studioFocus,commandOpen]);
  const [threeSettings,setThreeSettings]=useState<ThreeSettings>(()=>{
    if(saved)return saved.threeD.settings;
    const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)').matches;
    return {...threeDefaults,animation:!reducedMotion,
      // Keep the new reveal opt-in on devices explicitly requesting fewer animations.
      entrance:{...threeDefaults.entrance!,enabled:!reducedMotion}};
  });
  const threeApi=useRef<ThreePreviewHandle|null>(null);
  const threeView=useRef<ThreeView|undefined>(saved?.threeD.view);
  const [threeReady,setThreeReady]=useState(false);
  const beforeVoid=useRef<{view:ThreeView|undefined;time:number;seed:string;complete:string|null}|null>(null);
  const [threeRestore,setThreeRestore]=useState({
    serial:0,time:saved?.threeD.elapsedSeconds??0,
    floorTime:saved?.threeD.floorElapsedSeconds??saved?.threeD.elapsedSeconds??0,
  });
  const [standbyTransition,setStandbyTransition]=useState<ThreeStandbyTransition|null>(null);
  const [standbyFinishedSeed,setStandbyFinishedSeed]=useState<string|null>(saved?.threeD.standbyComplete?saved.threeD.seed:null);
  const [threeExportBusy,setThreeExportBusy]=useState(false);
  const standbyInteractionUntil=useRef(0);
  const standbySerial=useRef(0);
  const resume2D=useRef({growth:false,ambient:false});
  const [visualTheme,setVisualTheme]=useState<VisualTheme>(lastProject?.visualTheme??'standard');
  const [textOverlay,setTextOverlay]=useState<TextOverlaySettings>(()=>lastProject?.textOverlay??{...textOverlayDefaults});
  const entrancePreview=useTextEntrancePreview(textOverlay);
  const [enabledShapeKinds,setEnabledShapeKinds]=useState<ShapeKind[]>(()=>lastProject?.enabledShapeKinds??[...ALL_SHAPE_KINDS]);
  const lastGlow=useRef(100);
  const [ratio, setRatio] = useState<Ratio>(lastProject?.aspectRatio??'16:9');
  const [ambient,setAmbient]=useState(()=>lastProject?.ambient??{...ambientDefaults});
  const [version,setVersion]=useState<AlgorithmVersion>((lastProject?.algorithmVersion as AlgorithmVersion|undefined)??ALGORITHM_VERSION);
  const [magicSettings,setMagicSettings]=useState<MagicCircleSettings>(()=>lastProject?.magicCircle??{...magicDefaults});
  const ambientClock=useAmbientClock(renderMode==='2d'&&version!==MAGIC_ALGORITHM_VERSION&&ambient.enabled,ambient.lowPower,ambient,ratio);
  const artworkRef = useRef<HTMLDivElement>(null);
  const [seed, setSeed] = useState(()=>lastProject?.seed??createRandomSeed());
  const [initialColors]=useState(()=>lastProject?.colorSettings??saved?.threeD.colorSettings??
    reseedColors({...legacyColors(initialBackground),mode:'seed'},seed));
  const [uiTheme,setUiTheme]=useState(()=>{try{return localStorage.getItem('geometry-ui-theme')==='light'?'light':'dark';}catch{return 'dark';}});
  useEffect(()=>{document.documentElement.dataset.theme=uiTheme;try{localStorage.setItem('geometry-ui-theme',uiTheme);}catch{}},[uiTheme]);
  const committedSeed=useRef(seed);
  const [background, setBackground] = useState<Background>(()=>{
    if(saved){
      const p=saved.twoD;
      const restored:Background=saved.mode==='3d'?
        {...saved.threeD.background,grid:p.gridBackground}:
        {mode:p.backgroundMode,solid:p.solidColor,colors:p.gradientColors,
          angle:p.gradientAngle,grid:p.gridBackground,lineWidth:p.lineWidth??125,
          glowIntensity:p.glowIntensity??100};
      return coloredBackground(restored,initialColors);
    }
    return {...coloredBackground(initialBackground,initialColors),lineWidth:125};
  });
  const gridSeconds=useGridClock(renderMode==='2d'&&version!==MAGIC_ALGORITHM_VERSION&&!ambient.enabled&&!!background.grid?.enabled&&!!background.grid?.animation?.enabled);
  const [colorSettings,setColorSettings] = useState<ColorSettings | undefined>(initialColors);
  const activeColors = colorSettings ?? legacyColors(background);
  // Old manual 2D settings may omit figureColors intentionally. In 3D the
  // visible color slots are always the material colors, including locked slots.
  const threeBackground=useMemo(()=>({...background,figureColors:{primary:activeColors.slots.primary.color,support:activeColors.slots.support.color,accent:activeColors.slots.accent.color}}),[background,activeColors]);
  const magicColors=useMemo(()=>magicSettings.colorMode==='auto'
    ?magicPaletteFromSeed(seed,magicSettings.paletteReroll)
    :magicSettings.colorMode==='preset'?magicPaletteById(magicSettings.colorPreset)
      :magicSettings.customColors,[seed,magicSettings]);
  const twoDBackground=useMemo(()=>version===MAGIC_ALGORITHM_VERSION
    ?backgroundForMagic(background,magicColors):background,[version,background,magicColors]);
  function applyColors(c:ColorSettings) { setColorSettings(c);setBackground(bg=>coloredBackground(bg,c)); }
  function changeSeed(value:string) {setStandbyTransition(null);setSeed(value);if(colorSettings)applyColors(reseedColors(colorSettings,value));}
  function editor(id:Slot,label:string) { const slot=activeColors.slots[id];return <ColorEditor label={label} value={slot.color} locked={slot.locked}
   onColor={color=>applyColors({...activeColors,edited:[...new Set([...(activeColors.edited??[]),id])],slots:{...activeColors.slots,[id]:{...slot,color}}})}
   onRoll={()=>applyColors(rerollColor(activeColors,seed,id))}
   onLock={()=>applyColors({...activeColors,slots:{...activeColors.slots,[id]:{...slot,locked:!slot.locked}}})}/>; }
  const [regenerations, setRegenerations] = useState(0);
  const [density,setDensity] = useState(lastProject?.density??50);
  const baseScene = useMemo(() => generateScene(seed, ratio, version,enabledShapeKinds,magicSettings), [seed, ratio, version,enabledShapeKinds,magicSettings]);
  const candidates = useMemo(()=>densityCandidates(baseScene,seed),[baseScene,seed]);
  const scene = useMemo(()=>{
    const visible=visibleScene(baseScene,candidates,density);
    return version===MAGIC_ALGORITHM_VERSION?visible:themeScene(visible,visualTheme,seed);
  },[baseScene,candidates,density,visualTheme,seed,version]);

  const [animation,setAnimation]=useState<AnimationSettings>(()=>({
    animationEnabled:lastProject?.animationEnabled??true,
    animationDuration:lastProject?.animationDuration??defaults.animationDuration,
    playbackSpeed:lastProject?.playbackSpeed??defaults.playbackSpeed,
    easingType:lastProject?.easingType??defaults.easingType,
  }));
  const playback=usePlayback(animation);
  useEffect(()=>{
    const store=()=>{
      // Save both editor modes using the same, existing import/export schemas.
      // Resolution controls are separate outputs, not part of this live draft.
      const twoD:ProjectSettings={
        schemaVersion:1,algorithmVersion:version,seed,aspectRatio:ratio,
        density,visualTheme,enabledShapeKinds,
        backgroundMode:background.mode,solidColor:background.solid,
        gradientColors:background.colors,gradientAngle:background.angle,
        glowIntensity:background.glowIntensity??100,lineWidth:background.lineWidth??125,
        ...(background.grid?{gridBackground:background.grid}:{}),
        colorSettings:activeColors,textOverlay,magicCircle:magicSettings,
        ambient,...animation,exportWidth:1920,exportHeight:1080,
      };
      const elapsed=Math.max(0,Math.min(1e9,threeApi.current?.getElapsedSeconds?.()??
        threeRestore.time));
      const threeD:ThreeProject={
        kind:'geometry-maker-3d',schemaVersion:1,algorithmVersion:THREE_ALGORITHM_VERSION,
        seed,aspectRatio:ratio,density,visualTheme,background,
        colorSettings:activeColors,settings:threeSettings,
        ...(threeView.current?{view:threeView.current}:{}),
        elapsedSeconds:elapsed,
        floorElapsedSeconds:Math.max(0,Math.min(1e9,
          threeApi.current?.getFloorElapsedSeconds?.()??threeRestore.floorTime)),
        exportWidth:1920,exportHeight:1080,
        ...(standbyFinishedSeed===seed?{standbyComplete:true}:{}),
      };
      const draft:StudioAutosave={
        schemaVersion:1,mode:renderMode,category,threeCategory,
        focus:studioFocus,collapsed:sidebarCollapsed,twoD,threeD,
      };
      const success=saveStudioAutosave(draft);
      setAutosaveStatus(success?'saved':'unavailable');
    };
    // Debounce sliders/text changes, but flush immediately when the tab hides
    // or Safari refreshes. Poll the 3D camera/clock refs while navigating.
    const delayed=window.setTimeout(store,450);
    const cameraTimer=renderMode==='3d'?window.setInterval(store,2500):null;
    const flush=()=>store();
    const hide=()=>{if(document.hidden)store();};
    window.addEventListener('pagehide',flush);
    document.addEventListener('visibilitychange',hide);
    return()=>{
      window.clearTimeout(delayed);
      if(cameraTimer!==null)window.clearInterval(cameraTimer);
      window.removeEventListener('pagehide',flush);
      document.removeEventListener('visibilitychange',hide);
    };
  },[renderMode,category,threeCategory,studioFocus,sidebarCollapsed,
    version,seed,ratio,density,visualTheme,enabledShapeKinds,background,
    activeColors,textOverlay,magicSettings,ambient,animation,threeSettings,
    threeRestore.time,threeRestore.floorTime,standbyFinishedSeed]);
  useEffect(()=>{if(ambient.enabled&&version!==MAGIC_ALGORITHM_VERSION)playback.setPlaying(false);},[ambient.enabled,version]);
  useEffect(()=>{playback.restart(true);},[]);
  const cues=useMemo(()=>schedule(candidates,seed,version),[candidates,seed,version]);
  function replayOnRegenerate(){if(renderMode==='2d'&&animation.animationEnabled)playback.restart(true);}
  function switchRenderMode(next:'2d'|'3d'){
    if(threeExportBusy||next===renderMode)return;
    if(next==='2d'){setStandbyTransition(null);setStandbyFinishedSeed(null);}
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
  const voidEnabled=!!threeSettings.voidMode?.enabled;
  const threeBaseComposition=useMemo(()=>renderMode==='3d'?
    voidEnabled?generateVoidComposition(seed,ratio):generateThreeComposition(seed,ratio):null,[renderMode,seed,ratio,voidEnabled]);
  const threeComposition=useMemo(()=>threeBaseComposition?
    isVoidComposition(threeBaseComposition)?threeBaseComposition:spaceThreeComposition(threeBaseComposition,threeSettings.spacingPercent??100):null,
    [threeBaseComposition,threeSettings.spacingPercent]);
  const standby=threeSettings.standby??standbyDefaults;
  function beginStandbyTransition(){
    if(renderMode!=='3d'||!threeComposition||!threeBaseComposition||standbyTransition||threeExportBusy||!threeReady)return;
    let next=createRandomSeed();
    if(next===seed)next=createRandomSeed();
    if(!threeSettings.animation)setThreeSettings(current=>({...current,animation:true}));
    setStandbyTransition({id:++standbySerial.current,mode:standby.mode,duration:standby.transitionSeconds,
      fromSeed:seed,fromComposition:threeComposition,fromSourceComposition:threeBaseComposition,
      fromBackground:threeBackground,fromTheme:visualTheme,fromTime:threeApi.current?.getElapsedSeconds?.()??0,
      cameraPosition:threeView.current?.position?[...threeView.current.position]:undefined});
    committedSeed.current=next;
    setSeed(next);
    if(colorSettings)applyColors(reseedColors(colorSettings,next));
  }
  useEffect(()=>{
    if(renderMode!=='3d'||!standby.enabled)return;
    const mark=()=>{standbyInteractionUntil.current=performance.now()+5000;};
    for(const event of ['pointerdown','keydown','wheel','focusin'] as const)
      document.addEventListener(event,mark,{passive:true});
    const dragging=(event:PointerEvent)=>{if(event.buttons!==0||document.pointerLockElement)mark();};
    document.addEventListener('pointermove',dragging,{passive:true});
    return()=>{
      for(const event of ['pointerdown','keydown','wheel','focusin'] as const)
        document.removeEventListener(event,mark);
      document.removeEventListener('pointermove',dragging);
    };
  },[renderMode,standby.enabled]);
  useEffect(()=>{
    if(renderMode!=='3d'||!standby.enabled||!threeReady||!threeSettings.animation||standbyTransition)return;
    let elapsed=0,last=performance.now();
    const timer=window.setInterval(()=>{
      const now=performance.now(),delta=Math.max(0,Math.min(.5,(now-last)/1000));last=now;
      const focus=document.activeElement;
      const typing=focus instanceof HTMLTextAreaElement||
        (focus instanceof HTMLInputElement&&['text','number','search'].includes(focus.type))||
        (focus instanceof HTMLElement&&focus.isContentEditable);
      if(document.hidden||threeExportBusy||
        (standby.pauseOnInteraction&&(now<standbyInteractionUntil.current||typing)))return;
      elapsed+=delta;
      if(elapsed>=standby.intervalSeconds){elapsed=0;beginStandbyTransition();}
    },200);
    return()=>window.clearInterval(timer);
  },[renderMode,standby.enabled,standby.intervalSeconds,standby.transitionSeconds,standby.pauseOnInteraction,
    standby.mode,threeReady,threeSettings.animation,standbyTransition,threeExportBusy,seed,
    threeComposition,threeBaseComposition,threeBackground,visualTheme,colorSettings]);
  function commitSeed(){if(committedSeed.current!==seed){committedSeed.current=seed;replayOnRegenerate();}}
  function randomizeSeed(){if(threeExportBusy)return;const value=createRandomSeed();committedSeed.current=value;changeSeed(value);replayOnRegenerate();}
  function goToSettings(next:Category){
    if(threeExportBusy&&next!=='export')return;
    if(next==='text'&&(renderMode==='3d'||version===MAGIC_ALGORITHM_VERSION))return;
    (renderMode==='2d'?setCategory:setThreeCategory)(next);
    setStudioFocus(false);setSidebarCollapsed(false);
    // Only reposition the page on phones; desktop keeps the live preview in place.
    if(matchMedia('(max-width:720px)').matches){
      requestAnimationFrame(()=>document.querySelector('.studio-controls')?.scrollIntoView({
        block:'start',behavior:'smooth'
      }));
    }
  }
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
  function completedArtwork(transparentOnly=false){return new DOMParser().parseFromString(renderToStaticMarkup(<Preview scene={scene} background={twoDBackground} transparent={version===MAGIC_ALGORITHM_VERSION&&transparentOnly} textOverlay={version===MAGIC_ALGORITHM_VERSION?undefined:textOverlay} gridSeconds={gridSeconds} gridFigureAngle={figureScrollAngle(ambient,ratio)}/>),'image/svg+xml').documentElement as unknown as SVGSVGElement;}
  const studioCommands:StudioCommand[]=[
    ...categories.filter(item=>item.id!=='text'||
      (renderMode==='2d'&&version!==MAGIC_ALGORITHM_VERSION))
      .map(item=>({id:'open-'+item.id,title:item.label+'の設定を開く',
        description:'設定パネル / '+item.label,keywords:item.id,run:()=>goToSettings(item.id)})),
    {id:'seed',title:'新しいシードを生成',description:'ランダムな構図をすぐ生成',keywords:'random 乱数',run:randomizeSeed},
    {id:'focus',title:studioFocus?'集中表示を終了':'プレビューに集中',
      description:'作業パネルを隠してキャンバスを広げる',keywords:'full screen canvas',run:()=>setStudioFocus(v=>!v)},
    {id:'panel',title:'設定パネルの表示を切り替える',
      description:'サイドバーを開く・閉じる',keywords:'sidebar',run:()=>{setStudioFocus(false);setSidebarCollapsed(v=>!v);}},
    {id:'theme',title:'ライト・ダーク表示を切り替える',
      description:'編集画面の配色だけを変更',keywords:'theme',run:()=>setUiTheme(v=>v==='dark'?'light':'dark')},
    {id:'2d',title:'2Dモードに切り替える',description:'SVG編集に戻る',run:()=>switchRenderMode('2d')},
    {id:'3d',title:'3Dモードに切り替える',description:'WebGLキャンバスを表示',run:()=>switchRenderMode('3d')},
  ];
  const workspaceStyle={'--studio-sidebar-width':sidebarWidth+'px'} as CSSProperties;
  return <div className={'app studio-app'+(threeExportBusy?' three-video-exporting':'')+
    (studioFocus?' studio-focus':'')+
    (sidebarCollapsed?' studio-sidebar-collapsed':'')}>
    <header className="topbar studio-topbar">
      <div className="brand"><span className="brand-mark" aria-hidden="true">◇</span><div><h1>幾何学メーカー</h1><span className="brand-sub">GEOMETRY / BACKGROUND STUDIO</span></div></div>
      <div className="render-mode-switch segmented" role="group" aria-label="描画モード">
        <button type="button" aria-pressed={renderMode==='2d'} disabled={threeExportBusy} onClick={()=>switchRenderMode('2d')}>2Dモード</button>
        <button type="button" aria-pressed={renderMode==='3d'} disabled={threeExportBusy} onClick={()=>switchRenderMode('3d')}>3Dモード</button>
      </div>
      <div className="studio-topbar-tools">
        <button type="button" className="studio-command-launch" aria-label="コマンド検索"
          title="Ctrl / ⌘ + K" onClick={()=>setCommandOpen(true)}>
          <span aria-hidden="true">⌕</span><span>検索</span><kbd>⌘ K</kbd>
        </button>
        <button type="button" className="studio-panel-toggle" aria-label="設定パネルの表示切り替え"
          aria-pressed={!sidebarCollapsed&&!studioFocus}
          onClick={()=>{if(studioFocus){setStudioFocus(false);setSidebarCollapsed(false);}
            else setSidebarCollapsed(v=>!v);}}>
          <span aria-hidden="true">▥</span><span>パネル</span>
        </button>
        <button className="ui-theme-button studio-theme-toggle" type="button"
          onClick={()=>setUiTheme(t=>t==='dark'?'light':'dark')} aria-label="UIテーマ切り替え"
          title="UIテーマ切り替え">{uiTheme==='dark'?'☀':'☾'}<span>{uiTheme==='dark'?'ライト':'ダーク'}</span></button>
      </div>
      <div className="mode-badge"><span /> {renderMode==='2d'?'2D':'3D'} STUDIO <span className="version">v2</span></div>
    </header>

    <main className="workspace studio-workspace" style={workspaceStyle}>
      <aside className="controls studio-controls" aria-label="生成設定" id="studio-settings">
        <div className="studio-controls-header">
          <span><i aria-hidden="true"/> INSPECTOR</span>
          <button type="button" aria-label="設定パネルを折りたたむ" title="パネルを折りたたむ"
            onClick={()=>setSidebarCollapsed(true)}>✕</button>
        </div>
        <div className="panel-intro"><span className="eyebrow">MAKE IT YOURS</span><h2>ひとつのシードから、<br />あなただけの幾何学を。</h2><p>文字や数字を変えて、新しい構図に出会う。</p></div>

        <SettingsCategories active={activeCategory}
          onChange={value=>{if(!threeExportBusy)(renderMode==='2d'?setCategory:setThreeCategory)(value);}}
          disabled={threeExportBusy?categories.map(item=>item.id):
            renderMode==='3d'||version===MAGIC_ALGORITHM_VERSION?['text']:[]}/>
        <div className="studio-sidebar-resize">
          <label htmlFor="studio-sidebar-width">パネル幅</label>
          <input id="studio-sidebar-width" type="range" min={280} max={480} step={20}
            value={sidebarWidth} onChange={event=>setSidebarWidth(Number(event.target.value))}/>
          <output htmlFor="studio-sidebar-width">{sidebarWidth}px</output>
        </div>
        <div id="panel-shapes" className="category-panel" data-category="shapes" role="region" aria-labelledby="category-shapes" hidden={activeCategory!=='shapes'}>
          <h2 className="category-title">図形</h2>
        <section className="control-section" aria-labelledby="seed-heading">
          <div className="section-heading"><h3 id="seed-heading"><span>01</span> シード</h3><span className="tiny-label">SEED</span></div>
          <div className="studio-setting-label">
            <label htmlFor="seed">模様の合言葉</label>
            <HelpInfo label="シードの説明">「シード」は模様を再現する合言葉。同じ文字なら同じ模様になります。Enterか入力欄の外を押すと確定します。</HelpInfo>
          </div>
          <div className="seed-row"><input id="seed" aria-label="シード値" value={seed} onChange={e => changeSeed(e.target.value)} onBlur={commitSeed} onKeyDown={e=>{if(e.key==='Enter'&&!e.nativeEvent.isComposing&&e.keyCode!==229)commitSeed();}} spellCheck={false} autoComplete="off" /><button className="dice-button" type="button" onClick={randomizeSeed} aria-label="ランダムシードを生成" title="ランダムシードを生成">⚄ <span>ランダム</span></button></div> 
          <div hidden={renderMode==='3d'}><div className="studio-setting-label">
            <label className="algorithm-label" htmlFor="algorithm-version">作り方の種類</label>
            {version===LEGACY_ALGORITHM_VERSION&&<HelpInfo>旧v4設定の構図を保持しています。v5を選ぶと新しい構図に変わります。図形の種類別設定はv5で有効です。</HelpInfo>}
          </div>
          <select id="algorithm-version" aria-label="生成アルゴリズム" value={version} onChange={e=>{const next=e.target.value as AlgorithmVersion;setVersion(next);if(next===MAGIC_ALGORITHM_VERSION){playback.setPosition(1);playback.setPlaying(false);}}}>
            <option value={ALGORITHM_VERSION}>v5 — 拡張モード</option><option value={LEGACY_ALGORITHM_VERSION}>v4 — クラシックモード</option><option value={MAGIC_ALGORITHM_VERSION}>魔法陣 — Magic Circle</option>
          </select>
          </div>
        </section>
        {renderMode==='2d'&&version===ALGORITHM_VERSION&&<ShapeKindControls enabled={enabledShapeKinds} onChange={setEnabledShapeKinds}/>}
        {renderMode==='2d'&&version===MAGIC_ALGORITHM_VERSION&&<MagicCircleControls value={magicSettings} onChange={setMagicSettings} seed={seed}/>}
        {renderMode==='3d'&&<ThreeShapeControls settings={threeSettings} onChange={setThreeSettings}/>}

        <section className="control-section ratio-section" aria-labelledby="ratio-heading">
          <div className="section-heading"><h3 id="ratio-heading"><span>03</span> 縦横比</h3><span className="tiny-label">ASPECT RATIO</span></div>
          <div className="studio-setting-label">
            <label htmlFor="ratio">キャンバスの比率</label>
            <HelpInfo>図形の形を保ったまま、構図を調整します。</HelpInfo>
          </div>
          <select id="ratio" value={ratio} onChange={e => setRatio(e.target.value as Ratio)}>
            {Object.keys(RATIOS).map(value => <option key={value} value={value}>{value}{value === '16:9' ? ' — ワイド' : value === '9:16' ? ' — 縦長' : value === '1:1' ? ' — スクエア' : ''}</option>)}
          </select> 
        </section>

        <section className="control-section">
          <div className="studio-setting-label studio-setting-label-range">
            <label className="range-label" htmlFor="density">図形密度 <output htmlFor="density">{density}%</output></label>
            <HelpInfo>{renderMode==='3d'?'0%は背景のみ。主役の位置を保って3Dオブジェクトを段階的に追加します。':version===MAGIC_ALGORITHM_VERSION?'0%は背景のみ。主線は保持し、装飾は密度を上げるほど増えます。':'0%は背景のみ。50%が標準。主役の位置を保って図形量を調整します。'}</HelpInfo>
          </div>
          <input id="density" type="range" min="0" max="100" step="5" value={density} onChange={e=>setDensity(Number(e.target.value))}/> 
        </section>
        <button type="button" className="generate-button" aria-label="同じ設定で再生成" onClick={() => {setStandbyFinishedSeed(null);setRegenerations(n => n + 1);committedSeed.current=seed;replayOnRegenerate();}}><span aria-hidden="true">↻</span> 同じ設定で再生成</button>
        <p className="local-note" data-testid="autosave-status" role="status">
          <span aria-hidden="true">◉</span>
          {autosaveStatus==='saved'?'この端末に作業を自動保存中':
            autosaveStatus==='unavailable'?'自動保存を利用できません。設定ファイルで保存してください。':
              '自動保存を準備中…'}
        </p>
        </div>
        <div id="panel-background" className="category-panel" data-category="background" role="region" aria-labelledby="category-background" hidden={activeCategory!=='background'}>
          <h2 className="category-title">背景</h2>
        {!(renderMode==='2d'&&version===MAGIC_ALGORITHM_VERSION)&&<section className="control-section" aria-labelledby="background-heading">
          <div className="section-heading"><h3 id="background-heading"><span>02</span> 背景</h3><span className="tiny-label">BACKGROUND</span></div>
          <div className="segmented" role="group" aria-label="背景の種類">
            <button type="button" aria-pressed={background.mode === 'solid'} onClick={() => setBackground({ ...background, mode: 'solid' })}>単色</button>
            <button type="button" aria-pressed={background.mode === 'gradient'} onClick={() => setBackground({ ...background, mode: 'gradient' })}>グラデーション</button>
          </div>
          {background.mode==='gradient'&&<>
            <label className="range-label" htmlFor="angle">方向 <output htmlFor="angle">{background.angle}°</output></label>
            <input id="angle" type="range" min="0" max="360" value={background.angle} onChange={e=>setBackground({...background,angle:Number(e.target.value)})}/>
          </>}
          <HelpInfo>背景の各色は「カラー」で編集できます。</HelpInfo>
        </section>}
        {renderMode==='2d'&&version===MAGIC_ALGORITHM_VERSION&&<HelpInfo>魔法陣の背景・自動配色は「カラー」から変更できます。背景なしでの表示や透過保存は「図形」の魔法陣設定で切り替えられます。</HelpInfo>}
        {renderMode==='2d'&&version!==MAGIC_ALGORITHM_VERSION&&<GridBackgroundControls value={background.grid??gridBackgroundDefaults} onChange={grid=>setBackground(bg=>({...bg,grid}))}/>}
        {renderMode==='3d'&&<><VoidModeControls value={threeSettings.voidMode} disabled={threeExportBusy||!!standbyTransition} onChange={voidMode=>{
          if(voidMode.enabled!==voidEnabled){
            const floorTime=threeApi.current?.getFloorElapsedSeconds?.()??threeRestore.floorTime;
            if(voidMode.enabled){
              beforeVoid.current={view:threeView.current?{position:[...threeView.current.position],target:[...threeView.current.target]}:undefined,time:threeApi.current?.getElapsedSeconds?.()??0,seed,complete:standbyFinishedSeed};
              threeView.current=undefined;
            }else threeView.current=beforeVoid.current?.seed===seed?beforeVoid.current.view:undefined;
            setThreeReady(false);setThreeRestore(current=>({...current,serial:current.serial+1,time:!voidMode.enabled&&beforeVoid.current?.seed===seed?beforeVoid.current.time:0,floorTime}));
          }
          setStandbyTransition(null);setStandbyFinishedSeed(!voidMode.enabled&&beforeVoid.current?.seed===seed?beforeVoid.current.complete:null);setThreeSettings(settings=>({...settings,voidMode}));
        }}/><SkyControls value={threeSettings.sky} onChange={sky=>setThreeSettings(settings=>({...settings,sky}))}/><FloorGridControls value={threeSettings.floorGrid??floorGridDefaults} onChange={floorGrid=>setThreeSettings(settings=>({...settings,floorGrid}))}/></>}


        </div>
        <div id="panel-colors" className="category-panel" data-category="colors" role="region" aria-labelledby="category-colors" hidden={activeCategory!=='colors'}>
          <h2 className="category-title">カラー</h2>
        {renderMode==='2d'&&version===MAGIC_ALGORITHM_VERSION?
          <MagicColorControls value={magicSettings} onChange={setMagicSettings} seed={seed}/> : <>
        <section className="control-section" aria-labelledby="theme-heading">
          <h3 id="theme-heading">ビジュアルテーマ</h3>
          <label htmlFor="visual-theme">テーマを選ぶ</label>
          <select id="visual-theme" value={visualTheme} onChange={e=>chooseVisualTheme(e.target.value as VisualTheme)}>
            {VISUAL_THEMES.map(theme=><option key={theme.id} value={theme.id}>{theme.label}</option>)}
          </select>
          <HelpInfo>{VISUAL_THEMES.find(theme=>theme.id===visualTheme)?.description}。テーマを変えてもシード値は維持します。</HelpInfo>
          {visualTheme!=='standard'&&<div className="theme-swatches" aria-label="テーマのカラー">
            {[THEME_PRESETS[visualTheme].primary,THEME_PRESETS[visualTheme].support,THEME_PRESETS[visualTheme].accent,
              ...THEME_PRESETS[visualTheme].colors].map((color,i)=><span key={i} style={{backgroundColor:color}} title={color} aria-label={color}/>)}
          </div>}
          <HelpInfo>テーマに応じて図形の強弱・線・発光・背景色を変更します。下のカラー・装飾設定からさらに調整できます。</HelpInfo>
        </section>
        <ImagePaletteControls onApply={(palette,scope)=>applyColors(applyImagePalette(activeColors,palette,scope))}/>
        <section className="control-section">
          <h3>背景と図形の配色</h3>
          {editor('solid','背景色')}
          {editor('gradient0','グラデーション色1')}{editor('gradient1','グラデーション色2')}{editor('gradient2','グラデーション色3')}
          <div className="play-buttons" aria-label="従来の暗色配色"><button onClick={()=>{setVisualTheme('standard');applyColors(darkTheme(activeColors,seed,'night'));}}>ミッドナイト（配色のみ）</button><button onClick={()=>{setVisualTheme('standard');applyColors(darkTheme(activeColors,seed,'neon'));}}>ネオンナイト（配色のみ）</button></div>
          <HelpInfo>暗色テーマは固定していない色に適用します。単色・グラデーションの両方に対応します。</HelpInfo>
          <label htmlFor="color-mode">カラー変更モード</label>
          <select id="color-mode" value={activeColors.mode} onChange={e=>applyColors(reseedColors({...activeColors,edited:activeColors.mode==='seed'?['primary','support','accent']:activeColors.edited,mode:e.target.value as 'manual'|'seed'},seed))}>
            <option value="manual">手動色を維持</option><option value="seed">シードに連動</option>
          </select>
          <label htmlFor="color-appearance">自動配色の明暗</label>
          <select id="color-appearance" value={activeColors.appearance} onChange={e=>applyColors(reseedColors({...activeColors,appearance:e.target.value as ColorSettings['appearance']},seed))}>
            <option value="seed">シードで決定</option><option value="light">明るい背景向け</option><option value="dark">暗い背景向け</option>
          </select>
          {editor('primary','主役色')}{editor('support','補助色')}{editor('accent','アクセント色')}
          <HelpInfo>シード連動が初期状態です。固定中も手動編集・個別再抽選ができます。入力色をそのまま描画します。</HelpInfo>
        </section>
        </>}
        </div>
        <div id="panel-text" className="category-panel" data-category="text" role="region" aria-labelledby="category-text" hidden={renderMode==='3d'||version===MAGIC_ALGORITHM_VERSION||activeCategory!=='text'}>
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
          <HelpInfo>0%は発光なし。主役を強め、補助・装飾は控えめに光らせます。</HelpInfo>
        </section>
        {renderMode==='3d'&&<><ThreeStyleControls settings={voidRenderSettings(threeSettings)} fixedTopology={voidEnabled} onChange={next=>{
          if(!voidEnabled){setThreeSettings(next);return;}
          setThreeSettings(current=>({...current,voidMode:{...(current.voidMode??voidDefaults),
            network:{...next.network!,mode:'neural'},neon:next.neon!}}));
        }}/><ThreeMaterialControls settings={threeSettings} onChange={setThreeSettings}/></>}
        </div>
        <div id="panel-animation" className="category-panel" data-category="animation" role="region" aria-labelledby="category-animation" hidden={activeCategory!=='animation'}>
          <h2 className="category-title">アニメーション</h2>
        <div hidden={renderMode==='3d'}>
        {version!==MAGIC_ALGORITHM_VERSION&&<AmbientControls input={{seed,version,ratio,density,background,colors:activeColors,animation,settings:ambient,visualTheme,enabledShapeKinds,textOverlay}} settings={ambient} onChange={setAmbient} clock={ambientClock}/>}
        <AnimationControls settings={animation} onChange={setAnimation} playback={playback}/>
        </div>
        {renderMode==='3d'&&<><ThreeAnimationControls settings={threeSettings} onChange={setThreeSettings} seed={seed} onReplay={()=>{setStandbyFinishedSeed(null);setThreeSettings(current=>({...current,animation:true}));setRegenerations(n=>n+1);}}/>
          <ThreeStandbyControls settings={threeSettings} onChange={setThreeSettings} onNext={beginStandbyTransition}
            transitioning={!!standbyTransition} exporting={threeExportBusy}/></>}
        </div>
        <div id="panel-export" className="category-panel" data-category="export" role="region" aria-labelledby="category-export" hidden={activeCategory!=='export'}>
          <h2 className="category-title">書き出し</h2>
      <div className="export-area" hidden={renderMode==='3d'}>
        <ExportPanel textOverlay={textOverlay} magicSettings={version===MAGIC_ALGORITHM_VERSION?magicSettings:undefined} videoArtwork={{scene,candidates,seed,background:twoDBackground,animation,magicSettings:version===MAGIC_ALGORITHM_VERSION?magicSettings:undefined,textOverlay:version===MAGIC_ALGORITHM_VERSION?undefined:textOverlay,ambient:{scrollFigureState:ambientClock.scrollFigureState,scrollPaletteState:ambientClock.scrollPaletteState,scrollPath:ambientClock.scrollPath,seed,version,ratio,density,background:twoDBackground,colors:activeColors,animation,settings:{...ambient,enabled:version!==MAGIC_ALGORITHM_VERSION&&ambient.enabled},visualTheme,enabledShapeKinds,textOverlay}}} version={version} density={density} colorSettings={activeColors} visualTheme={visualTheme} enabledShapeKinds={enabledShapeKinds} seed={seed} ratio={ratio} background={background} animation={animation} artwork={completedArtwork}
          onRatio={setRatio} onRestore={settings => {
            ambientClock.stop();setAmbient({...ambientDefaults,...settings.ambient,enabled:false});
            setDensity(settings.density ?? 50);setVisualTheme(settings.visualTheme??'standard');setTextOverlay(settings.textOverlay??{...textOverlayDefaults});
            setEnabledShapeKinds(settings.enabledShapeKinds??[...ALL_SHAPE_KINDS]);
            setAnimation({animationEnabled:settings.animationEnabled??false,animationDuration:settings.animationDuration??8,playbackSpeed:settings.playbackSpeed??1,easingType:settings.easingType??'ease-in-out'});playback.setPlaying(false);playback.setPosition(settings.algorithmVersion===MAGIC_ALGORITHM_VERSION?1:0);
            setMagicSettings(settings.magicCircle??{...magicDefaults});
             setVersion(settings.algorithmVersion as AlgorithmVersion);committedSeed.current=settings.seed;
            setSeed(settings.seed); setRatio(settings.aspectRatio);
            const bg:Background={grid:settings.gridBackground??gridBackgroundDefaults,lineWidth:settings.lineWidth??100,glowIntensity:settings.glowIntensity??0,mode:settings.backgroundMode,solid:settings.solidColor,colors:settings.gradientColors,angle:settings.gradientAngle};
            setColorSettings(settings.colorSettings);
            setBackground(settings.colorSettings ? coloredBackground(bg,settings.colorSettings) : bg);
            setRegenerations(0);
          }} />
      </div>
        {renderMode==='3d'&&<ThreeExportPanel api={threeApi} seed={seed} ready={threeReady}
           onBusyChange={setThreeExportBusy}
          project={()=>({kind:'geometry-maker-3d',schemaVersion:1,algorithmVersion:THREE_ALGORITHM_VERSION,seed,aspectRatio:ratio,density,visualTheme,background,
            colorSettings:activeColors,settings:threeSettings,
             ...(standbyFinishedSeed===seed?{standbyComplete:true}:{}),
             floorElapsedSeconds:Math.max(0,Math.min(1e9,
               threeApi.current?.getFloorElapsedSeconds?.()??threeRestore.floorTime)),
             ...(threeView.current?{view:threeView.current}:{})})}
          onRestore={(project:ThreeProject)=>{
            beforeVoid.current=null;
            setStandbyTransition(null);setStandbyFinishedSeed(project.standbyComplete?project.seed:null);setThreeReady(false);setSeed(project.seed);committedSeed.current=project.seed;setRatio(project.aspectRatio);setDensity(project.density);
            setVisualTheme(project.visualTheme);setColorSettings(project.colorSettings);setBackground(project.colorSettings?coloredBackground(project.background,project.colorSettings):project.background);
            setThreeSettings(project.settings);threeView.current=project.view;setThreeRestore(previous=>({serial:previous.serial+1,time:project.elapsedSeconds,
              floorTime:project.floorElapsedSeconds??project.elapsedSeconds}));
          }}/>}
        </div>
      </aside>

      <section className="preview-panel studio-preview-panel" aria-labelledby="preview-heading">
        <div className="preview-toolbar studio-preview-toolbar">
          <div className="studio-preview-heading">
            <span className="eyebrow">01 / LIVE CANVAS</span>
            <h2 id="preview-heading">ライブプレビュー <span className="studio-canvas-version">{renderMode==='3d'?'3D':'2D'}</span></h2>
            <p>アイデアを即座に描画、すべてリアルタイムに反映。</p>
          </div>
          <div className="studio-preview-toolbar-actions">
            <span className="live-indicator"><i/> リアルタイム反映</span>
            <button type="button" className="studio-focus-button" aria-pressed={studioFocus}
              onClick={()=>setStudioFocus(v=>!v)}>
              <span aria-hidden="true">{studioFocus?'↙':'⤢'}</span>
              {studioFocus?'集中表示を終了':'集中表示'}
            </button>
          </div>
        </div>
        <div className="canvas-stage">
          {renderMode==='2d'?<PreviewTextEditor settings={textOverlay} onChange={setTextOverlay} onAdvanced={()=>setCategory('text')}>
            <div ref={artworkRef} className="canvas-frame" style={{ aspectRatio: `${scene.width} / ${scene.height}`, width: `min(100%, calc(var(--preview-height, 70vh) * ${scene.width / scene.height}))` }}>
              {ambient.enabled&&version!==MAGIC_ALGORITHM_VERSION?<AmbientStage input={{seed,version,ratio,density,background,colors:activeColors,animation,settings:ambient,visualTheme,enabledShapeKinds,textOverlay}} clock={ambientClock}/>:version===MAGIC_ALGORITHM_VERSION?<MagicCirclePreview scene={scene} background={twoDBackground} settings={magicSettings} animation={animation} growth={growth}/>:<Preview scene={scene} background={twoDBackground} growth={growth} textOverlay={textOverlay} textSeconds={entrancePreview.seconds} gridSeconds={gridSeconds} gridFigureAngle={figureScrollAngle(ambient,ratio)}/>}
            </div>
          </PreviewTextEditor>:<div className="canvas-frame three-frame" style={{aspectRatio:`${scene.width} / ${scene.height}`,width:`min(100%, calc(var(--preview-height, 70vh) * ${scene.width/scene.height}))`}}>
            <ThreeBoundary onReturn={()=>switchRenderMode('2d')} onRetryLowQuality={()=>{
              setThreeReady(false);
              setThreeSettings(current=>({...current,quality:'low',
                floorGrid:{...(current.floorGrid??floorGridDefaults),circuitWorldEnabled:false}}));
              setThreeRestore(current=>({...current,serial:current.serial+1}));
            }}>
              <Suspense fallback={<div className="three-fallback" role="status">3Dエンジンを読み込んでいます…</div>}>
                {threeComposition&&<ThreePreview key={threeRestore.serial} initialTime={threeRestore.time}
                  initialFloorTime={threeRestore.floorTime} composition={threeComposition} sourceComposition={threeBaseComposition!} skySeed={seed} density={density} background={threeBackground} visualTheme={visualTheme} settings={threeSettings} restartKey={`${seed}:${ratio}:${regenerations}${voidEnabled?':void-filaments-v1':''}`} view={threeView} api={threeApi} onReady={setThreeReady} transition={standbyTransition}
                   skipEntrance={standbyFinishedSeed===seed}
                   onTransitionComplete={id=>{
                     setStandbyFinishedSeed(seed);
                     setStandbyTransition(current=>current?.id===id?null:current);
                     if(!standby.preserveCamera)threeApi.current?.smoothResetView?.();
                   }}/>}
              </Suspense>
            </ThreeBoundary>
          </div>}
        </div>
        <div className="studio-quickbar" role="group" aria-label="クイック調整">
          <div className="studio-quickbar-caption"><span className="studio-quickbar-symbol" aria-hidden="true">✳</span>
            <span><strong>QUICK TUNE</strong><small>今のシーンを調整</small></span></div>
          <label className="studio-quick-field">比率
            <select aria-label="クイック比率" disabled={threeExportBusy} value={ratio} onChange={event=>setRatio(event.target.value as Ratio)}>
              {Object.keys(RATIOS).map(value=><option key={value} value={value}>{value}</option>)}
            </select>
          </label>
          <label className="studio-quick-field studio-quick-density">密度 <span>{density}%</span>
            <input type="range" aria-label="クイック密度" disabled={threeExportBusy} min={0} max={100} step={5} value={density}
              onChange={event=>setDensity(Number(event.target.value))}/>
          </label>
          <div className="studio-quick-actions">
            <button type="button" onClick={randomizeSeed} disabled={threeExportBusy} title="新しいシードを生成">
              <span aria-hidden="true">↻</span> 新しいシード</button>
            <button type="button" className="studio-quick-export" onClick={()=>goToSettings('export')}>
              <span aria-hidden="true">↥</span> 書き出しへ</button>
          </div>
        </div>
        {renderMode==='3d'&&<div className="three-view-toolbar"><p>ドラッグで回転 · ホイール／ピンチでズーム</p><button type="button" disabled={!threeReady} onClick={()=>threeApi.current?.resetView()}>視点をリセット</button></div>}
        <div className="canvas-info"><span>{ratio} <span className="info-divider">/</span> {renderMode==='2d'?'SVG · 2D':'WebGL · 3D'}</span><span>{threeComposition && renderMode==='3d' ? visibleThreeObjects(threeComposition,density,threeSettings.enabledKinds).length + generateCelestialBodies(threeComposition,threeSettings.celestial??celestialDefaults,density).length : scene.shapes.length} SHAPES</span></div>
        <div className="seed-card"><span className="seed-card-icon" aria-hidden="true">⌘</span><div><span className="tiny-label">CURRENT SEED</span><code data-testid="current-seed">{seed === '' ? '（空文字）' : seed}</code></div><span className="algorithm">{renderMode==='2d'?version:THREE_ALGORITHM_VERSION}</span></div>
        <p className="preview-hint" role="status">{regenerations > 0 ? `再生成しました（${regenerations}回）。同じシードと設定の模様です。` : '設定を変えると、プレビューが自動で更新されます。'}</p>
      </section>

    </main>
    <nav className="studio-mobile-dock" aria-label="モバイルクイック操作">
      <button type="button" onClick={()=>goToSettings('shapes')}>
        <span aria-hidden="true">◈</span><small>設定</small></button>
      <button type="button" onClick={randomizeSeed} disabled={threeExportBusy}>
        <span aria-hidden="true">↻</span><small>新規</small></button>
      <button type="button" onClick={()=>goToSettings('export')}>
        <span aria-hidden="true">↥</span><small>保存</small></button>
      <button type="button" aria-pressed={studioFocus} onClick={()=>setStudioFocus(v=>!v)}>
        <span aria-hidden="true">{studioFocus?'↙':'⤢'}</span><small>{studioFocus?'戻る':'集中'}</small></button>
      <button type="button" onClick={()=>setCommandOpen(true)}>
        <span aria-hidden="true">⌕</span><small>探す</small></button>
    </nav>
    <StudioCommandPalette open={commandOpen} onClose={closeCommands} commands={studioCommands}/>
    <footer><span>GENERATIVE DESIGN, DETERMINISTIC BY NATURE.</span><span>2D / 3D 背景スタジオ</span></footer>
  </div>;
}
