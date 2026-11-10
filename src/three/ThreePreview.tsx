// This is the only entry importing WebGL libraries. App loads it with React.lazy.
import {Canvas, useFrame, useThree} from '@react-three/fiber';
import {useEffect, useImperativeHandle, useMemo, useRef, useState, type Ref, type RefObject} from 'react';
import {ACESFilmicToneMapping, CanvasTexture, Mesh, SRGBColorSpace, Vector2} from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import {UnrealBloomPass} from 'three/addons/postprocessing/UnrealBloomPass.js';
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js';
import {backgroundVector, luminance} from '../paint';
import type {Background} from '../scene';
import type {VisualTheme} from '../themes';
import {threePose, visibleThreeObjects, type ThreeComposition, type ThreeObject} from './model';
import {effectiveThreeQuality, themeMaterial, threeResolutionError, type ThreePreviewHandle, type ThreeSettings, type ThreeView} from './settings';

type Props = {
  composition: ThreeComposition; density: number; background: Background; visualTheme: VisualTheme;
  settings: ThreeSettings; restartKey: string; view: RefObject<ThreeView | undefined>;
  api: Ref<ThreePreviewHandle>; onReady: (ready: boolean) => void;
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

function Solid({object, settings, background, visualTheme, low, seconds}: {
  object: ThreeObject; settings: ThreeSettings; background: Background; visualTheme: VisualTheme; low: boolean; seconds: Clock;
}) {
  const mesh = useRef<Mesh>(null);
  const segments = low ? 16 : 40;
  const kind = object.kind;
  const material = settings.material === 'theme' ? themeMaterial(visualTheme) : settings.material;
  const color = background.figureColors?.[object.role] ?? {primary: '#b995ff', support: '#76cfe8', accent: '#beffd4'}[object.role];
  const glow = (background.glowIntensity ?? 0) / 100;
  const emissive = glow * (object.role === 'primary' ? .45 : object.role === 'accent' ? .3 : .16);
  useFrame(() => {
    if (!mesh.current) return;
    const pose = threePose(object, seconds.current, settings.floatAmount, settings.rotationAmount);
    mesh.current.position.set(...pose.position);
    mesh.current.rotation.set(...pose.rotation);
  });
  return <mesh ref={mesh} position={object.position} rotation={object.rotation} scale={object.radius} castShadow={!low} receiveShadow={!low}>
    {kind === 'sphere' && <sphereGeometry args={[1, segments, segments / 2]}/>}
    {kind === 'cube' && <boxGeometry args={[2 / Math.sqrt(3), 2 / Math.sqrt(3), 2 / Math.sqrt(3)]}/>}
    {kind === 'torus' && <torusGeometry args={[.72, .23, low ? 8 : 16, low ? 32 : 64]}/>}
    {kind === 'icosahedron' && <icosahedronGeometry args={[1, 0]}/>}
    {kind === 'dodecahedron' && <dodecahedronGeometry args={[1, 0]}/>}
    {kind === 'octahedron' && <octahedronGeometry args={[1, 0]}/>}
    {kind === 'tetrahedron' && <tetrahedronGeometry args={[1, 0]}/>}
    {material === 'glass' ? <meshPhysicalMaterial color={color} roughness={settings.roughness * .6} metalness={settings.metalness * .2}
      transmission={low ? 0 : .65} thickness={.6} transparent opacity={low ? .65 : .92} emissive={color} emissiveIntensity={emissive * .45}/>
      : <meshStandardMaterial color={color} roughness={material === 'matte' ? Math.max(.65, settings.roughness) : settings.roughness}
        metalness={material === 'matte' ? 0 : settings.metalness} wireframe={material === 'wireframe'}
        flatShading={kind !== 'sphere' && kind !== 'torus'} emissive={color} emissiveIntensity={emissive}/>}
  </mesh>;
}

function SceneRuntime({composition, background, settings, restartKey, view, api, onReady, seconds, low, onLost}: Props & {seconds: Clock; low: boolean; onLost: () => void}) {
  const {gl, scene, camera, size, invalidate} = useThree();
  const controls = useRef<OrbitControls | null>(null);
  const pipeline = useRef<{composer: EffectComposer; bloom: UnrealBloomPass; output: OutputPass} | null>(null);
  const skipDelta = useRef(true);
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

  // Reframe on aspect-ratio changes, while material/color/density changes retain the view.
  const lastAspect = useRef(aspect);
  useEffect(() => {if (lastAspect.current !== aspect) {lastAspect.current = aspect; resetView();}}, [aspect]);
  useEffect(() => {seconds.current = 0; skipDelta.current = true; invalidate();}, [restartKey, seconds, invalidate]);
  useEffect(() => {skipDelta.current = true; invalidate();}, [settings.animation, invalidate]);
  useFrame((_, delta) => {
    if (settings.animation && !document.hidden && !skipDelta.current) seconds.current += delta * settings.speed;
    skipDelta.current = false;
    controls.current?.update();
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
    const glow = (background.glowIntensity ?? 0) / 100;
    if (pipeline.current) {
      pipeline.current.bloom.enabled = glow > 0;
      pipeline.current.bloom.strength = Math.min(.55, glow * .28);
      // Dark scenes can reveal colored glow without overexposing the surface;
      // lift the threshold on pale backgrounds so the background itself won't bloom.
      const backgroundColors = background.mode === 'solid' ? [background.solid] : background.colors;
      pipeline.current.bloom.threshold = .4 + Math.max(...backgroundColors.map(luminance)) * .9;
      pipeline.current.composer.render();
    } else gl.render(scene, camera);
  }
  useFrame(() => {if (!gl.getContext().isContextLost()) render();}, 1);
  useEffect(() => {onReady(true); return () => onReady(false);}, [onReady]);

  useImperativeHandle(api, () => ({resetView, async savePNG(width, height) {
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
  const seconds = useRef(0);
  const objects = useMemo(() => visibleThreeObjects(props.composition, props.density), [props.composition, props.density]);
  const onLost = useMemo(() => () => {props.onReady(false); setLost(true);}, [props.onReady]);
  if (!supported || lost) return <div className="three-fallback" role="alert"><h3>{lost ? '3D描画が中断されました' : 'この環境では3Dを表示できません'}</h3><p>WebGL 2対応ブラウザとハードウェアアクセラレーションが必要です。2Dモードは引き続き利用できます。中断した場合は軽量設定で3Dモードを開き直してください。</p></div>;
  return <div className="three-preview" data-testid="three-preview" data-quality={low ? 'low' : 'high'} data-object-count={objects.length}>
    <Canvas frameloop="demand" dpr={low ? 1 : [1, 1.75]} shadows={!low} camera={{position: [0, 1, 18], fov: 40, near: .1, far: 150}}
      gl={{antialias: true, alpha: false, powerPreference: low ? 'low-power' : 'high-performance', toneMapping: ACESFilmicToneMapping}}
      onCreated={({gl}) => {gl.outputColorSpace = SRGBColorSpace; gl.toneMappingExposure = .95;}}>
      <ambientLight intensity={props.settings.lightIntensity * .5}/>
      <directionalLight position={[5, 6, 7]} intensity={props.settings.lightIntensity * 2} castShadow={!low} shadow-mapSize-width={1024} shadow-mapSize-height={1024} shadow-bias={-.001}/>
      <directionalLight position={[-6, -2, 4]} intensity={props.settings.lightIntensity * .7} color={props.background.figureColors?.support ?? '#a4caff'}/>
      <pointLight position={[2, 4, -4]} intensity={props.settings.lightIntensity * 12} color={props.background.figureColors?.accent ?? '#d5b5ff'}/>
      {objects.map(object => <Solid key={object.id} object={object} settings={props.settings} background={props.background} visualTheme={props.visualTheme} low={low} seconds={seconds}/>)}
      <SceneRuntime {...props} low={low} seconds={seconds} onLost={onLost}/>
    </Canvas>
    <span className="three-quality-badge">{low ? '軽量描画' : '高品質描画'}</span>
  </div>;
}
