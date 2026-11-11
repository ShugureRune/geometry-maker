// This is the only entry importing WebGL libraries. App loads it with React.lazy.
import {Canvas, useFrame, useThree} from '@react-three/fiber';
import {useEffect, useImperativeHandle, useMemo, useRef, useState, type Ref, type RefObject} from 'react';
import {ACESFilmicToneMapping, CanvasTexture, Mesh, MeshPhysicalMaterial, MeshStandardMaterial, SRGBColorSpace, Vector2} from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import {UnrealBloomPass} from 'three/addons/postprocessing/UnrealBloomPass.js';
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js';
import {backgroundVector, luminance} from '../paint';
import type {Background} from '../scene';
import type {VisualTheme} from '../themes';
import {threePose, threeSpacingFactor, visibleThreeObjects, type ThreeComposition, type ThreeObject} from './model';
import {effectiveThreeQuality, themeMaterial, threeResolutionError, type ThreePreviewHandle, type ThreeSettings, type ThreeView} from './settings';
import {networkConnections} from './network';
import {networkDefaults,neonDefaults} from './style-settings';
import {NeonOutline,NetworkLines,useOutlineGeometry,type OutlineGeometries} from './StyleRenderer';
import {FloorGrid} from './FloorGrid';
import {SkyRenderer} from './SkyRenderer';
import {skyDefaults} from './sky-settings';
import {worldDefaults,sunlightAtHour} from './world-settings';
import {ExploreController} from './ExploreController';
import {generateCelestialBodies,spaceCelestialBodies,celestialDefaults} from './celestial';
import {CelestialObjectMesh} from './CelestialRenderer';
import {floorGridDefaults} from './floor-grid';
import {threeVisibility,visibilityDefaults,visibilityUsesFade,visibilityUsesScale} from './visibility';
import {entranceDefaults,threeEntrancePose} from './entrance';

type Props = {
  composition: ThreeComposition; sourceComposition: ThreeComposition; skySeed: string; density: number; background: Background; visualTheme: VisualTheme;
  settings: ThreeSettings; restartKey: string; view: RefObject<ThreeView | undefined>;
  api: Ref<ThreePreviewHandle>; onReady: (ready: boolean) => void;
  initialTime?:number;
};
type Clock = RefObject<number>;

function drawBackground(context: CanvasRenderingContext2D, width: number, height: number, background: Background) {
  if (background.mode === 'solid') context.fillStyle = background.solid;
  else {
    const {start, end} = backgroundVector(background, width, height);
    const gradient = context.createLinearGradient(start.x, start.y, end.x, end.y);
    background.colors.forEach((color, i) => gradient.addColorStop(i / 2, color));
    context.fillStyle = gradient;
  }
  context.fillRect(0, 0, width, height);
}

function Solid({object, settings, background, visualTheme, low, seconds, outlines, seed}: {
  object: ThreeObject; settings: ThreeSettings; background: Background; visualTheme: VisualTheme; low: boolean; seconds: Clock; outlines:OutlineGeometries; seed:string;
}) {
  const mesh = useRef<Mesh>(null);
  const surfaceRef=useRef<MeshStandardMaterial|MeshPhysicalMaterial>(null);
  const segments = low ? 16 : 40;
  const kind = object.kind;
  const material = settings.material === 'theme' ? themeMaterial(visualTheme) : settings.material;
  const color = background.figureColors?.[object.role] ?? {primary: '#b995ff', support: '#76cfe8', accent: '#beffd4'}[object.role];
  const glow = (background.glowIntensity ?? 0) / 100;
  const emissive = glow * (object.role === 'primary' ? .45 : object.role === 'accent' ? .3 : .16);
  const neon=settings.neon??neonDefaults;
  const surfaceVisible=!neon.enabled||neon.display!=='lines';
  const translucent=neon.enabled&&neon.display==='transparent';
  const appearance=settings.visibilityAnimation??visibilityDefaults;
  const fades=visibilityUsesFade(appearance),scales=visibilityUsesScale(appearance);
  const entrance=settings.entrance??entranceDefaults;
  // Paused static scenes initially show the complete figure; pausing during a reveal freezes the current frame.
  const entranceFade=entrance.enabled&&(settings.animation||seconds.current>0);
  const baseOpacity=material==='glass'?(translucent?neon.faceOpacity:low?.65:.92):(translucent?neon.faceOpacity:1);
  useFrame(() => {
    if (!mesh.current) return;
    const pose = threePose(object, seconds.current, settings.floatAmount, settings.rotationAmount);
    const arrival=entrance.enabled&&(settings.animation||seconds.current>0)
      ?threeEntrancePose(object,seconds.current,entrance,seed):null;
    const opacity=arrival?.opacity??1;
    mesh.current.position.set(pose.position[0]+(arrival?.offset[0]??0),
      pose.position[1]+(arrival?.offset[1]??0),pose.position[2]+(arrival?.offset[2]??0));
    mesh.current.rotation.set(...pose.rotation);
    mesh.current.rotation.z+=arrival?.rotationZ??0;
    const visibility=threeVisibility(object,seconds.current,appearance);
    mesh.current.visible=visibility*opacity>.001;
    mesh.current.scale.setScalar(object.radius*(scales?Math.max(.001,visibility):1)*(arrival?.scale??1));
    mesh.current.castShadow=!low&&surfaceVisible&&!translucent&&!fades&&opacity>=.999;
    if(surfaceRef.current){
      if(fades||entranceFade)surfaceRef.current.opacity=baseOpacity*visibility*opacity;
      // Once a figure is fully formed, restore opaque depth writes so complex
      // seed compositions keep their correct front/back occlusion.
      surfaceRef.current.depthWrite=!translucent&&!fades&&opacity>=.999;
    }
  });
  return <mesh ref={mesh} position={object.position} rotation={object.rotation} scale={object.radius} castShadow={!low&&surfaceVisible&&!translucent&&!fades&&!entranceFade} receiveShadow={!low}>
    {kind === 'sphere' && <sphereGeometry args={[1, segments, segments / 2]}/>}
    {kind === 'cube' && <boxGeometry args={[2 / Math.sqrt(3), 2 / Math.sqrt(3), 2 / Math.sqrt(3)]}/>}
    {kind === 'torus' && <torusGeometry args={[.72, .23, low ? 8 : 16, low ? 32 : 64]}/>}
    {kind === 'icosahedron' && <icosahedronGeometry args={[1, 0]}/>}
    {kind === 'dodecahedron' && <dodecahedronGeometry args={[1, 0]}/>}
    {kind === 'octahedron' && <octahedronGeometry args={[1, 0]}/>}
    {kind === 'tetrahedron' && <tetrahedronGeometry args={[1, 0]}/>}
    {kind === 'cylinder' && <cylinderGeometry args={[.62, .62, 1.45, low ? 12 : 32]}/>}
    {kind === 'cone' && <coneGeometry args={[.72, 1.35, low ? 12 : 32]}/>}
    {kind === 'capsule' && <capsuleGeometry args={[.42, .68, low ? 4 : 8, low ? 10 : 24]}/>}
    {kind === 'prism' && <cylinderGeometry args={[.69, .69, 1.32, 3]}/>}
    {kind === 'pyramid' && <cylinderGeometry args={[0, .70, 1.30, 4]}/>}
    {kind === 'torus-knot' && <torusKnotGeometry args={[.50, .15, low ? 48 : 112, low ? 6 : 12, 2, 3]}/>} 
    {/* Transparency changes the compiled OPAQUE shader variant; replace the
        material on this boundary so alpha sliders never use a stale program. */}
    {material === 'glass' ? <meshPhysicalMaterial ref={surfaceRef} key={`${translucent?'translucent':'surface'}-${fades||entranceFade?'fade':'normal'}`} visible={surfaceVisible} color={color} roughness={settings.roughness * .6} metalness={settings.metalness * .2}
      transmission={low||translucent ? 0 : .65} thickness={.6} transparent opacity={baseOpacity}
      depthWrite={!translucent&&!fades&&!entranceFade} polygonOffset={neon.enabled} polygonOffsetFactor={1} polygonOffsetUnits={1} emissive={color} emissiveIntensity={emissive * .45}/>
      : <meshStandardMaterial ref={surfaceRef} key={`${translucent?'translucent':'surface'}-${fades||entranceFade?'fade':'normal'}`} visible={surfaceVisible} color={color} roughness={material === 'matte' ? Math.max(.65, settings.roughness) : settings.roughness}
        transparent={translucent||fades||entranceFade} opacity={baseOpacity} depthWrite={!translucent&&!fades&&!entranceFade}
        polygonOffset={neon.enabled} polygonOffsetFactor={1} polygonOffsetUnits={1}
        metalness={material === 'matte' ? 0 : settings.metalness} wireframe={material === 'wireframe'&&!translucent}
        flatShading={!['sphere','torus','capsule','torus-knot'].includes(kind)} emissive={color} emissiveIntensity={emissive}/>}
    {neon.enabled&&outlines&&<NeonOutline geometry={outlines.get(object.kind)!} object={object} settings={settings} background={background} low={low} seconds={seconds}/>}
  </mesh>;
}

function SceneRuntime({composition, background, settings, restartKey, view, api, onReady, seconds, low, onLost}: Props & {seconds: Clock; low: boolean; onLost: () => void}) {
  const {gl, scene, camera, size, invalidate} = useThree();
  const controls = useRef<OrbitControls | null>(null);
  const explore=!!(settings.sky?.world??worldDefaults).explore;
  const pipeline = useRef<{composer: EffectComposer; bloom: UnrealBloomPass; output: OutputPass} | null>(null);
  const skipDelta = useRef(true);
  const lastRestart=useRef(restartKey),ready=useRef(false);
  const aspect = composition.width / composition.height;
  const homeDistance = Math.max(composition.height, composition.width / aspect) / (2 * Math.tan(40 * Math.PI / 360)) * 1.2 + 2;
  function resetView() {
    const orbit = controls.current;
    // Drain any pending damping/zoom before assigning the home pose. Otherwise
    // the previous gesture can keep moving the camera after Reset was pressed.
    const damping = orbit?.enableDamping;
    if (orbit) {orbit.enableDamping = false; orbit.update();}
    camera.position.set(0, .7, homeDistance);
    orbit?.target.set(0, 0, -.4);
    orbit?.update();
    if (orbit) orbit.enableDamping = damping ?? true;
    invalidate();
  }

  useEffect(() => {
    const orbit = new OrbitControls(camera, gl.domElement);
    controls.current = orbit;
    orbit.enableDamping = true; orbit.dampingFactor = .08; orbit.enablePan = false;
    orbit.minDistance = 3; orbit.maxDistance = 80;
    gl.domElement.tabIndex = 0;
    gl.domElement.setAttribute('aria-label', '3D視点操作：ドラッグで回転、ホイールまたはピンチでズーム');
    orbit.listenToKeyEvents(gl.domElement);
    if (view.current) {camera.position.set(...view.current.position); orbit.target.set(...view.current.target); orbit.update();}
    else resetView();
    const change = () => {
      view.current = {position: camera.position.toArray(), target: orbit.target.toArray()};
      invalidate();
    };
    orbit.addEventListener('change', change);
    const visibility = () => {skipDelta.current = true; if (!document.hidden) invalidate();};
    const lost = (event: Event) => {event.preventDefault(); onLost();};
    document.addEventListener('visibilitychange', visibility);
    gl.domElement.addEventListener('webglcontextlost', lost);
    return () => {
      orbit.removeEventListener('change', change); orbit.dispose(); controls.current = null;
      document.removeEventListener('visibilitychange', visibility);
      gl.domElement.removeEventListener('webglcontextlost', lost);
    };
  }, [camera, gl, invalidate, view, onLost]);

  useEffect(()=>{
    const orbit=controls.current;
    if(!orbit)return;
    orbit.enabled=!explore;
    if(!explore&&view.current){
      orbit.target.set(...view.current.target);
      orbit.update();
    }
    invalidate();
  },[explore,invalidate,view]);

  // Reframe on aspect-ratio changes, while material/color/density changes retain the view.
  const lastAspect = useRef(aspect);
  useEffect(() => {if (Math.abs(lastAspect.current - aspect) > 1e-6) {lastAspect.current = aspect; resetView();}}, [aspect]);
  // Keep the user's viewing angle and point of interest while reframing the
  // widened layout. A saved camera is left untouched on initial JSON restore.
  const spacingPercent=settings.spacingPercent??100;
  const lastSpacing=useRef(spacingPercent);
  useEffect(() => {
    const previous=lastSpacing.current;
    lastSpacing.current=spacingPercent;
    if(previous===spacingPercent)return;
    const orbit=controls.current;
    if(!orbit)return;
    const ratio=threeSpacingFactor(spacingPercent)/threeSpacingFactor(previous);
    camera.position.sub(orbit.target).multiplyScalar(ratio).add(orbit.target);
    orbit.update();
    invalidate();
  },[spacingPercent,camera,invalidate]);
  useEffect(() => {if(lastRestart.current!==restartKey)seconds.current=0;lastRestart.current=restartKey;skipDelta.current = true; invalidate();}, [restartKey, seconds, invalidate]);
  useEffect(() => {skipDelta.current = true; invalidate();}, [settings.animation, invalidate]);
  // A style may update only shader buffers (no changed JSX host properties).
  // Demand rendering must still refresh colors/pulses/poses while paused.
  useEffect(() => {invalidate();}, [settings, background, invalidate]);
  useFrame((_, delta) => {
    if (settings.animation && !document.hidden && !skipDelta.current) seconds.current += delta * settings.speed;
    skipDelta.current = false;
    if(!explore)controls.current?.update();
    if (settings.animation && !document.hidden) invalidate();
  }, -1);

  useEffect(() => {
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(512 * aspect); canvas.height = 512;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('背景の描画に失敗しました。');
    drawBackground(context, canvas.width, canvas.height, background);
    const texture = new CanvasTexture(canvas); texture.colorSpace = SRGBColorSpace;
    scene.background = texture; invalidate();
    return () => {if (scene.background === texture) scene.background = null; texture.dispose(); canvas.width = 0; canvas.height = 0;};
  }, [scene, background.mode, background.solid, background.colors, background.angle, aspect, invalidate]);

  useEffect(() => {
    if (low) return;
    const composer = new EffectComposer(gl);
    const bloom = new UnrealBloomPass(new Vector2(size.width, size.height), .25, .2, .9);
    const output = new OutputPass();
    composer.addPass(new RenderPass(scene, camera)); composer.addPass(bloom); composer.addPass(output);
    pipeline.current = {composer, bloom, output};
    invalidate();
    return () => {pipeline.current = null; bloom.dispose(); output.dispose(); composer.dispose();};
  }, [gl, scene, camera, low, invalidate]);
  useEffect(() => {pipeline.current?.composer.setSize(size.width, size.height); invalidate();}, [size.width, size.height, low, invalidate]);

  function render() {
    if (gl.getContext().isContextLost()) throw new Error('3D描画が中断されました。解像度を下げて再度お試しください。');
    const network=settings.network??networkDefaults,neon=settings.neon??neonDefaults;
    const floor=settings.floorGrid??floorGridDefaults;
    const celestial=settings.celestial??celestialDefaults;
    const styled=network.enabled||neon.enabled||floor.enabled||celestial.enabled||(settings.sky?.kind??'classic')!=='classic';
    const glow = Math.max(background.glowIntensity??0,network.enabled?network.glow:0,neon.enabled?neon.glow:0,floor.enabled?floor.glow:0,celestial.enabled?120:0) / 100;
    if (pipeline.current) {
      pipeline.current.bloom.enabled = glow > 0;
      pipeline.current.bloom.strength = Math.min(.55, glow * .28);
      // Dark scenes can reveal colored glow without overexposing the surface;
      // lift the threshold on pale backgrounds so the background itself won't bloom.
      const backgroundColors = background.mode === 'solid' ? [background.solid] : background.colors;
      const threshold=.4 + Math.max(...backgroundColors.map(luminance)) * .9;
      // Style lines use HDR only when their own glow is positive. Keep ordinary
      // [0,1] line colors outside bloom even if the base shapes still glow.
      pipeline.current.bloom.threshold = styled?Math.max(1.01,threshold):threshold;
      pipeline.current.composer.render();
    } else gl.render(scene, camera);
  }
  useFrame(() => {if (!gl.getContext().isContextLost()) {render();if(!ready.current){ready.current=true;onReady(true);}}}, 1);
  useEffect(() => () => onReady(false), [onReady]);

  useImperativeHandle(api, () => ({resetView,getElapsedSeconds:()=>seconds.current, async savePNG(width, height) {
    const error = threeResolutionError(width, height); if (error) throw new Error(error);
    const maxSize = Math.min(gl.capabilities.maxTextureSize, gl.getContext().getParameter(gl.getContext().MAX_RENDERBUFFER_SIZE));
    if (width > maxSize || height > maxSize || (low && width * height > 4_194_304)) throw new Error('この描画設定では解像度が大きすぎます。軽量設定では合計4,194,304画素以内にしてください。');
    const output = document.createElement('canvas'); output.width = width; output.height = height;
    const context = output.getContext('2d'); if (!context) throw new Error('PNG用のメモリを確保できませんでした。');
    const scale = Math.min(width / size.width, height / size.height);
    const renderWidth = Math.max(1, Math.round(size.width * scale)), renderHeight = Math.max(1, Math.round(size.height * scale));
    const dpr = gl.getPixelRatio();
    try {
      gl.setPixelRatio(1); gl.setSize(renderWidth, renderHeight, false);
      pipeline.current?.composer.setPixelRatio(1); pipeline.current?.composer.setSize(renderWidth, renderHeight);
      // Render synchronously and copy immediately; preserveDrawingBuffer is not
      // needed during normal playback. This captures the current camera and pose.
      render();
      drawBackground(context, width, height, background);
      context.drawImage(gl.domElement, Math.round((width - renderWidth) / 2), Math.round((height - renderHeight) / 2));
    } finally {
      gl.setPixelRatio(dpr); gl.setSize(size.width, size.height, false);
      pipeline.current?.composer.setPixelRatio(dpr); pipeline.current?.composer.setSize(size.width, size.height);
      invalidate();
    }
    try {
      return await new Promise<Blob>((resolve, reject) => output.toBlob(blob => blob ? resolve(blob) : reject(new Error('PNGを作成できませんでした。解像度を下げてください。')), 'image/png'));
    } finally {output.width = 0; output.height = 0;}
  }}));
  return null;
}

function webGLAvailable() {
  const canvas = document.createElement('canvas');
  try {
    const context = canvas.getContext('webgl2');
    if (!context) return false;
    context.getExtension('WEBGL_lose_context')?.loseContext(); return true;
  } catch {return false;}
}

export default function ThreePreview(props: Props) {
  const [supported] = useState(webGLAvailable), [lost, setLost] = useState(false);
  const [smallDevice, setSmallDevice] = useState(() => matchMedia('(max-width: 720px), (pointer: coarse)').matches);
  useEffect(() => {
    const query = matchMedia('(max-width: 720px), (pointer: coarse)');
    const update = () => setSmallDevice(query.matches);
    query.addEventListener('change', update); return () => query.removeEventListener('change', update);
  }, []);
  const low = effectiveThreeQuality(props.settings.quality, smallDevice) === 'low';
  const seconds = useRef(props.initialTime??0);
  const touchActions=useRef(new Set<string>());
  const world=props.settings.sky?.world??worldDefaults;
  const exploring=!!world.explore;
  const outdoor=!!props.settings.sky&&props.settings.sky.kind!=='classic';
  const sunlight=sunlightAtHour(world.timeOfDay);
  const objects = useMemo(() => visibleThreeObjects(props.composition, props.density, props.settings.enabledKinds), [props.composition, props.density, props.settings.enabledKinds]);
  const network=props.settings.network??networkDefaults,neon=props.settings.neon??neonDefaults;
  // Preserve network topology as the entire figure constellation spreads.
  const spacingFactor=threeSpacingFactor(props.settings.spacingPercent??100);
  const edges=useMemo(()=>network.enabled?
    networkConnections(objects,network.distance*spacingFactor,network.maxConnections):[],
    [objects,network.enabled,network.distance,network.maxConnections,spacingFactor]);
  const celestial=props.settings.celestial??celestialDefaults;
  // Generate celestial appearance from unscaled positions, then spread the
  // constellation without re-rolling its sizes, phases or surface patterns.
  const celestialBase=useMemo(()=>generateCelestialBodies(props.sourceComposition,celestial,props.density),
    [props.sourceComposition,celestial,props.density]);
  const celestialObjects=useMemo(()=>spaceCelestialBodies(celestialBase,props.settings.spacingPercent??100),
    [celestialBase,props.settings.spacingPercent]);
  const outlines=useOutlineGeometry(neon.enabled,low);
  const onLost = useMemo(() => () => {props.onReady(false); setLost(true);}, [props.onReady]);
  if (!supported || lost) return <div className="three-fallback" role="alert"><h3>{lost ? '3D描画が中断されました' : 'この環境では3Dを表示できません'}</h3><p>WebGL 2対応ブラウザとハードウェアアクセラレーションが必要です。2Dモードは引き続き利用できます。中断した場合は軽量設定で3Dモードを開き直してください。</p></div>;
  return <div className="three-preview" data-testid="three-preview" data-quality={low ? 'low' : 'high'} data-object-count={objects.length}
    data-network-count={edges.length} data-neon-mode={neon.enabled?neon.display:'off'}
    data-visibility-enabled={(props.settings.visibilityAnimation??visibilityDefaults).enabled?'true':'false'}
    data-visibility-mode={(props.settings.visibilityAnimation??visibilityDefaults).mode}
     data-entrance-enabled={(props.settings.entrance??entranceDefaults).enabled?'true':'false'}
     data-entrance-mode={(props.settings.entrance??entranceDefaults).mode}
    data-floor-grid={(props.settings.floorGrid??floorGridDefaults).enabled?'on':'off'} data-celestial-count={celestialObjects.length}
    data-sky-kind={(props.settings.sky??skyDefaults).kind} data-explore={exploring?'on':'off'}>
    <Canvas frameloop="demand" dpr={low ? 1 : [1, 1.75]} shadows={!low} camera={{position: [0, 1, 18], fov: 40, near: .1, far: 1200}}
      gl={{antialias: true, alpha: false, powerPreference: low ? 'low-power' : 'high-performance', toneMapping: ACESFilmicToneMapping}}
      onCreated={({gl}) => {gl.outputColorSpace = SRGBColorSpace; gl.toneMappingExposure = .95;}}>
      <SkyRenderer sky={props.settings.sky} seed={props.skySeed} seconds={seconds} low={low}
        sceneHeight={props.composition.height} floorGridEnabled={(props.settings.floorGrid??floorGridDefaults).enabled} view={props.view}/>
      <ambientLight intensity={props.settings.lightIntensity*.5*(outdoor?.24+.76*sunlight.strength:1)}/>
      <directionalLight position={outdoor?
        [Math.cos(sunlight.azimuth)*12,Math.max(1,sunlight.altitude*18),Math.sin(sunlight.azimuth)*12]:
        [5,6,7]} intensity={props.settings.lightIntensity*2*(outdoor?sunlight.strength*world.sunStrength/100:1)}
        color={outdoor&&(world.timeOfDay<8||world.timeOfDay>17)?'#ffb47a':'#ffffff'}
        castShadow={!low} shadow-mapSize-width={1024} shadow-mapSize-height={1024} shadow-bias={-.001}/>
      <directionalLight position={[-6, -2, 4]} intensity={props.settings.lightIntensity * .7} color={props.background.figureColors?.support ?? '#a4caff'}/>
      <pointLight position={[2, 4, -4]} intensity={props.settings.lightIntensity * 12} color={props.background.figureColors?.accent ?? '#d5b5ff'}/>
      <FloorGrid grid={props.settings.floorGrid??floorGridDefaults} sceneHeight={props.composition.height} seconds={seconds} view={props.view}/>
      {objects.map(object => <Solid key={object.id} object={object} settings={props.settings} background={props.background} visualTheme={props.visualTheme} low={low} seconds={seconds} outlines={outlines} seed={props.skySeed}/>)}
      {celestialObjects.map(body => <CelestialObjectMesh key={body.id} body={body} settings={props.settings} low={low} seconds={seconds} seed={props.skySeed}/>)}
      {edges.length>0&&<NetworkLines objects={objects} edges={edges} settings={props.settings} background={props.background} low={low} seconds={seconds} seed={props.skySeed}/>}
      <SceneRuntime {...props} low={low} seconds={seconds} onLost={onLost}/>
      <ExploreController enabled={exploring} speed={(props.settings.sky?.world??worldDefaults).exploreSpeed}
        view={props.view} touchActions={touchActions}/>
    </Canvas>
    {exploring&&<div className="three-explore-pad" aria-label="探索カメラの操作"
      style={{position:'absolute',left:10,bottom:12,zIndex:6,display:'grid',
        gridTemplateColumns:'repeat(5,43px)',gap:5,touchAction:'none',userSelect:'none'}}>
      {([
        ['w','↑'],['a','←'],['s','↓'],['d','→'],['ascend','上昇'],
        ['turn-left','↶'],['turn-right','↷'],['look-up','仰ぐ'],['look-down','見下'],['descend','下降'],
      ] as const).map(([action,label])=><button type="button" key={action}
        aria-label={'探索 '+label}
        onPointerDown={e=>{e.preventDefault();e.currentTarget.setPointerCapture(e.pointerId);touchActions.current.add(action);}}
        onPointerUp={()=>touchActions.current.delete(action)}
        onPointerCancel={()=>touchActions.current.delete(action)}
        onLostPointerCapture={()=>touchActions.current.delete(action)}
        style={{background:'#162438dd',color:'#f4ffff',border:'1px solid #829bb2',borderRadius:7,
          minHeight:38,fontSize:label.length>1?11:19}}>{label}</button>)}
    </div>}
    <span className="three-quality-badge">{low ? '軽量描画' : '高品質描画'}</span>
  </div>;
}
