// This is the only entry importing WebGL libraries. App loads it with React.lazy.
import {Canvas, useFrame, useThree} from '@react-three/fiber';
import {useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState, type Ref, type RefObject} from 'react';
import {ACESFilmicToneMapping, CanvasTexture, Color, Mesh, MeshPhysicalMaterial, MeshStandardMaterial, SRGBColorSpace, Vector2, Vector3} from 'three';
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
import {NeonOutline,NetworkLines,NeuralSignals,useOutlineGeometry,type OutlineGeometries} from './StyleRenderer';
import {FloorGrid} from './FloorGrid';
import {SkyRenderer} from './SkyRenderer';
import {skyDefaults} from './sky-settings';
import {worldDefaults,sunlightAtHour} from './world-settings';
import {ExploreController} from './ExploreController';
import {generateCelestialBodies,spaceCelestialBodies,celestialDefaults} from './celestial';
import {CelestialObjectMesh} from './CelestialRenderer';
import {floorGridDefaults,floorGridOffset} from './floor-grid';
import {threeVisibility,visibilityDefaults,visibilityUsesFade,visibilityUsesScale} from './visibility';
import {entranceDefaults,threeEntrancePose} from './entrance';
import {neuralStartupFlash} from './neural-signals';
import {standbyDefaults,easeInOut,matchThreeObjects,standbyMeshVisibility,standbyObjectPose,type MorphMatch,type ThreeStandbyTransition} from './standby';
import {advanceStandbyClock} from './standby-clock';
import {inclinedCameraOrbitStep} from './camera-orbit';

type Props = {
  composition: ThreeComposition; sourceComposition: ThreeComposition; skySeed: string; density: number; background: Background; visualTheme: VisualTheme;
  settings: ThreeSettings; restartKey: string; view: RefObject<ThreeView | undefined>;
  api: Ref<ThreePreviewHandle>; onReady: (ready: boolean) => void;
  initialTime?:number;
  initialFloorTime?:number;
  transition?:ThreeStandbyTransition|null;
  onTransitionComplete?:(id:number)=>void;
  skipEntrance?:boolean;
  /** Read-only transition progress for UI and regression tests. */
  progressHost?:RefObject<HTMLDivElement|null>;
};
type Clock = RefObject<number>;
type StandbySolid={transition:ThreeStandbyTransition;variant:'shared'|'old'|'new';from?:ThreeObject;to?:ThreeObject};

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

function Solid({object, settings, background, visualTheme, low, seconds, outlines, seed, standby, skipEntrance=false}: {
  object: ThreeObject; settings: ThreeSettings; background: Background; visualTheme: VisualTheme; low: boolean; seconds: Clock; outlines:OutlineGeometries; seed:string;
  standby?:StandbySolid;skipEntrance?:boolean;
}) {
  const mesh = useRef<Mesh>(null);
  const fromColor=useMemo(()=>{
    const role=standby?.from?.role??object.role;
    return new Color(standby?.transition.fromBackground.figureColors?.[role]??{primary:'#b995ff',support:'#76cfe8',accent:'#beffd4'}[role]);
  },[standby?.transition.fromBackground,standby?.from?.role,object.role]);
  const toColor=useMemo(()=>{
    const role=standby?.to?.role??object.role;
    return new Color(background.figureColors?.[role]??{primary:'#b995ff',support:'#76cfe8',accent:'#beffd4'}[role]);
  },[background,standby?.to?.role,object.role]);
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
  // New morph layers start invisible, including their neon outline. A line ref
  // initialized at 1 causes a single bright frame before the first useFrame.
  const standbyStartAlpha=standby?
    (standby.variant==='new'?0:1)*standbyMeshVisibility(
      standby.from,standby.to,standby.variant,0,standby.transition,appearance):1;
  const morphLineAlpha=useRef(standbyStartAlpha);
  useLayoutEffect(()=>{
    if(standby)morphLineAlpha.current=standbyStartAlpha;
  },[standby?.transition.id,standby?.variant]);
  const entrance=settings.entrance??entranceDefaults;
  // Paused static scenes initially show the complete figure; pausing during a reveal freezes the current frame.
  const entranceFade=!skipEntrance&&entrance.enabled&&(settings.animation||seconds.current>0);
  const standbyFade=!!standby;
  const baseOpacity=material==='glass'?(translucent?neon.faceOpacity:low?.65:.92):(translucent?neon.faceOpacity:1);
  const updateSolid=()=>{
    if (!mesh.current) return;
    // The ignition begins only after the last entrance wire finishes.
    // Update emissive intensity directly so pause/seek/export stay deterministic.
    if(surfaceRef.current){
      const circuit=settings.network??networkDefaults;
      const ignition=circuit.enabled&&circuit.mode==='neural'&&!standby&&
        !skipEntrance&&entrance.enabled
        ?neuralStartupFlash(seconds.current,entrance.duration):0;
      surfaceRef.current.emissiveIntensity=emissive*(material==='glass'?.45:1)+ignition*1.35;
    }
    if(standby){
      const {transition,variant}=standby;
      const {position,rotation,radius,opacity:alpha,colorMix}=standbyObjectPose(
        standby.from,standby.to,seconds.current,transition,variant,
        settings.floatAmount,settings.rotationAmount,entrance,seed,
        (settings.network??networkDefaults).enabled
      );
      const visibility=standbyMeshVisibility(
        standby.from,standby.to,variant,seconds.current,transition,appearance);
      const totalAlpha=alpha*visibility;
      mesh.current.position.set(...position);mesh.current.rotation.set(...rotation);
      mesh.current.scale.setScalar(Math.max(.0001,radius)*(scales?Math.max(.001,visibility):1));
      mesh.current.visible=totalAlpha>.001;
      mesh.current.castShadow=!low&&surfaceVisible&&!translucent&&!fades&&totalAlpha>=.999;
      morphLineAlpha.current=totalAlpha;
      if(surfaceRef.current){
        surfaceRef.current.opacity=baseOpacity*totalAlpha;
        surfaceRef.current.depthWrite=!translucent&&!fades&&totalAlpha>=.999;
        surfaceRef.current.color.copy(fromColor).lerp(toColor,colorMix);
        surfaceRef.current.emissive.copy(surfaceRef.current.color);
      }
      return;
    }
    const pose = threePose(object, seconds.current, settings.floatAmount, settings.rotationAmount);
    const arrival=!skipEntrance&&entrance.enabled&&(settings.animation||seconds.current>0)
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
  };
  // A seed transition replaces the matched-mesh React keys. Set visibility,
  // position, scale and opacity before paint so a newly mounted object cannot
  // flash at its full default size for a single render frame.
  useLayoutEffect(updateSolid,[object,settings,background,visualTheme,low,
    seconds,seed,standby,skipEntrance,entrance,appearance,baseOpacity]);
  useFrame(updateSolid);
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
    {material === 'glass' ? <meshPhysicalMaterial ref={surfaceRef} key={`${translucent?'translucent':'surface'}-${fades||entranceFade||standbyFade?'fade':'normal'}`} visible={surfaceVisible} color={color} roughness={settings.roughness * .6} metalness={settings.metalness * .2}
      transmission={low||translucent ? 0 : .65} thickness={.6} transparent opacity={baseOpacity}
      depthWrite={!translucent&&!fades&&!entranceFade&&!standbyFade} polygonOffset={neon.enabled} polygonOffsetFactor={1} polygonOffsetUnits={1} emissive={color} emissiveIntensity={emissive * .45}/>
      : <meshStandardMaterial ref={surfaceRef} key={`${translucent?'translucent':'surface'}-${fades||entranceFade||standbyFade?'fade':'normal'}`} visible={surfaceVisible} color={color} roughness={material === 'matte' ? Math.max(.65, settings.roughness) : settings.roughness}
        transparent={translucent||fades||entranceFade||standbyFade} opacity={baseOpacity} depthWrite={!translucent&&!fades&&!entranceFade&&!standbyFade}
        polygonOffset={neon.enabled} polygonOffsetFactor={1} polygonOffsetUnits={1}
        metalness={material === 'matte' ? 0 : settings.metalness} wireframe={material === 'wireframe'&&!translucent}
        flatShading={!['sphere','torus','capsule','torus-knot'].includes(kind)} emissive={color} emissiveIntensity={emissive}/>}
    {neon.enabled&&outlines&&<NeonOutline geometry={outlines.get(object.kind)!} object={object} settings={settings} background={background} low={low} seconds={seconds} morphOpacity={standby?morphLineAlpha:undefined} skipEntrance={skipEntrance}/>}
  </mesh>;
}

function SceneRuntime({composition, background, settings, restartKey, view, api, onReady, seconds, floorSeconds, low, onLost, transition, onTransitionComplete, progressHost}: Props & {seconds: Clock; floorSeconds:Clock; low: boolean; onLost: () => void}) {
  const {gl, scene, camera, size, invalidate} = useThree();
  const controls = useRef<OrbitControls | null>(null);
  const cameraInteractionUntil=useRef(0);
  const cameraReset=useRef<{from:Vector3;focus:Vector3;elapsed:number;damping:boolean}|null>(null);
  const explore=!!(settings.sky?.world??worldDefaults).explore;
  const pipeline = useRef<{composer: EffectComposer; bloom: UnrealBloomPass; output: OutputPass} | null>(null);
  const skipDelta = useRef(true);
  const exportingVideo=useRef(false);
  const beforeVideoTime=useRef(0);
  const beforeVideoFloorTime=useRef(0);
  type PendingVideoFrame={time:number;width:number;height:number;canvas:HTMLCanvasElement;
    resolve:()=>void;reject:(error:Error)=>void};
  const pendingVideoFrame=useRef<PendingVideoFrame|null>(null);
  const lastRestart=useRef(restartKey),ready=useRef(false);
  const lastTransitionId=useRef<number|null>(transition?.id??null);
  const finishedTransition=useRef<number|null>(null);
  const backdrop=useRef<{context:CanvasRenderingContext2D;texture:CanvasTexture;width:number;height:number}|null>(null);
  const lastBackdropBlend=useRef(-1);
  const aspect = composition.width / composition.height;
  const homeDistance = Math.max(composition.height, composition.width / aspect) / (2 * Math.tan(40 * Math.PI / 360)) * 1.2 + 2;
  function resetView() {
    cameraReset.current=null;
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

  function smoothResetView(){
    const orbit=controls.current;
    // Never teleport a user who is exploring the world in free-flight mode.
    if(!orbit||explore)return;
    cameraReset.current={from:camera.position.clone(),focus:orbit.target.clone(),elapsed:0,
      damping:orbit.enableDamping};
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
    const interrupt=()=>{
      cameraInteractionUntil.current=performance.now()+1500;
      if(cameraReset.current){orbit.enableDamping=cameraReset.current.damping;cameraReset.current=null;}
    };
    const release=()=>{cameraInteractionUntil.current=performance.now()+1500;};
    orbit.addEventListener('start',interrupt);
    orbit.addEventListener('end',release);
    const visibility = () => {skipDelta.current = true; if (!document.hidden) invalidate();};
    const lost = (event: Event) => {event.preventDefault(); onLost();};
    document.addEventListener('visibilitychange', visibility);
    gl.domElement.addEventListener('webglcontextlost', lost);
    return () => {
      orbit.removeEventListener('change', change);orbit.removeEventListener('start',interrupt);
      orbit.removeEventListener('end',release);
      orbit.dispose(); controls.current = null;
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
  // Passive effects can run AFTER the first WebGL frame of a newly seeded scene.
  // That old frame clock could exceed the transition duration, instantly
  // completing both shapes and background. Reset synchronously before paint.
  // Removing a completed transition is NOT a new clock, so never rewind then.
  useLayoutEffect(()=>{
    const restarted=lastRestart.current!==restartKey;
    const newTransition=transition!=null&&lastTransitionId.current!==transition.id;
    if(restarted||newTransition)seconds.current=0;
    lastRestart.current=restartKey;
    lastTransitionId.current=transition?.id??null;
    skipDelta.current=true;
    if(transition&&progressHost?.current){
      progressHost.current.dataset.standbyElapsed='0.000';
      progressHost.current.dataset.standbyBackgroundBlend='0.000';
    }
    invalidate();
  },[restartKey,transition?.id,seconds,invalidate]);
  useEffect(() => {skipDelta.current = true; invalidate();}, [settings.animation, invalidate]);
  // A style may update only shader buffers (no changed JSX host properties).
  // Demand rendering must still refresh colors/pulses/poses while paused.
  useEffect(() => {invalidate();}, [settings, background, invalidate]);
  useFrame((_, delta) => {
    if(exportingVideo.current){
      if(pendingVideoFrame.current){
        seconds.current=pendingVideoFrame.current.time;
        // A video deliberately starts its frame clock at zero; do not reset
        // the live PCB/floor phase, just replay it relative to export start.
        floorSeconds.current=beforeVideoFloorTime.current+pendingVideoFrame.current.time;
      }
    }else if(settings.animation&&!document.hidden&&!skipDelta.current){
      seconds.current=transition?
        advanceStandbyClock(seconds.current,delta,settings.speed,transition.duration):
        seconds.current+delta*settings.speed;
      // Scene/entrance time MUST restart at each seed switch. Environment time
      // MUST NOT: it drives the moving grid, PCB shader and raised circuit
      // signals, and always advances from the last visible floor frame.
      floorSeconds.current+=Math.min(Math.max(0,delta*settings.speed),.12);
    }
    if(progressHost?.current){
      if(transition)progressHost.current.dataset.standbyElapsed=seconds.current.toFixed(3);
      const grid=settings.floorGrid??floorGridDefaults;
      progressHost.current.dataset.floorTime=floorSeconds.current.toFixed(6);
      progressHost.current.dataset.floorOffset=floorGridOffset(floorSeconds.current,grid).toFixed(6);
    }
    skipDelta.current = false;
    if(!explore){
      const journey=cameraReset.current,orbit=controls.current;
      if(journey&&orbit){
        journey.elapsed+=Math.min(.05,Math.max(0,delta));
        const t=easeInOut(journey.elapsed/1.15);
        orbit.autoRotate=false;
        orbit.enableDamping=false;
        camera.position.lerpVectors(journey.from,new Vector3(0,.7,homeDistance),t);
        orbit.target.lerpVectors(journey.focus,new Vector3(0,0,-.4),t);
        orbit.update();
        if(t>=1){orbit.enableDamping=journey.damping;cameraReset.current=null;}
        invalidate();
      }else if(orbit){
        // OrbitControls autoRotate preserves the existing target, distance and
        // zoom. Rotation is opt-in, frame-rate independent and temporarily
        // pauses after a manual drag / pinch / wheel interaction.
        const standby=settings.standby??standbyDefaults;
        const autoOrbit=standby.enabled&&standby.cameraAutoRotate&&
          settings.animation&&!exportingVideo.current&&!document.hidden&&
          performance.now()>=cameraInteractionUntil.current;
        const tiltedOrbit=autoOrbit&&standby.cameraOrbitMode==='inclined';
        // Preserve the existing horizontal OrbitControls orbit exactly as
        // before. Inclined orbit takes over only the angular step, never
        // repositions or reinitializes the camera when modes change.
        orbit.autoRotate=autoOrbit&&!tiltedOrbit;
        orbit.autoRotateSpeed=standby.cameraRotateSpeed;
        orbit.enableDamping=!autoOrbit;
        if(tiltedOrbit){
          const next=inclinedCameraOrbitStep(camera.position.toArray() as [number,number,number],
            orbit.target.toArray() as [number,number,number],
            delta,standby.cameraRotateSpeed,standby.cameraOrbitTilt);
          camera.position.set(...next);
        }
        orbit.update(Math.min(.1,Math.max(0,delta)));
      }
    }
    if (settings.animation && !document.hidden && !exportingVideo.current) invalidate();
    if(!exportingVideo.current&&transition && seconds.current>=transition.duration&&finishedTransition.current!==transition.id){
      finishedTransition.current=transition.id;
      onTransitionComplete?.(transition.id);
    }
  }, -1);

  useLayoutEffect(() => {
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(512 * aspect); canvas.height = 512;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('背景の描画に失敗しました。');
    drawBackground(context, canvas.width, canvas.height, transition?.fromBackground??background);
    const texture = new CanvasTexture(canvas); texture.colorSpace = SRGBColorSpace;
    backdrop.current={context,texture,width:canvas.width,height:canvas.height};
    lastBackdropBlend.current=-1;
    scene.background = texture; invalidate();
    return () => {if (scene.background === texture) scene.background = null;
      if(backdrop.current?.texture===texture)backdrop.current=null;
      texture.dispose(); canvas.width = 0; canvas.height = 0;};
  }, [scene, background.mode, background.solid, background.colors, background.angle, aspect, invalidate,transition]);
  // Blend the two seed backgrounds in ~24 smooth color steps, without a full-frame
  // Canvas2D redraw on every WebGL frame. Static scenes retain the old path.
  useFrame(()=>{
    if(!transition)return;
    const current=backdrop.current;
    if(!current||scene.background!==current.texture)return;
    const blend=easeInOut(seconds.current/transition.duration);
    if(progressHost?.current)progressHost.current.dataset.standbyBackgroundBlend=blend.toFixed(3);
    if(blend<1&&Math.abs(blend-lastBackdropBlend.current)<.04)return;
    const {context,width,height,texture}=current;
    context.clearRect(0,0,width,height);
    drawBackground(context,width,height,transition.fromBackground);
    context.globalAlpha=blend;
    drawBackground(context,width,height,background);
    context.globalAlpha=1;
    texture.needsUpdate=true;
    lastBackdropBlend.current=blend;
  },-.5);

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
  // All geometry, materials, particles and sky shaders have already updated
  // using the requested exact timestamp by this later callback. Capture in the
  // SAME WebGL frame before the drawing buffer is discarded by Safari/WebGL.
  useFrame(()=>{
    const frame=pendingVideoFrame.current;
    if(!frame)return;
    pendingVideoFrame.current=null;
    try{
      if(gl.getContext().isContextLost())throw new Error('3D描画が中断されました。');
      const context=frame.canvas.getContext('2d');
      if(!context)throw new Error('動画フレーム用メモリを確保できません。');
      context.clearRect(0,0,frame.width,frame.height);
      drawBackground(context,frame.width,frame.height,background);
      const scale=Math.min(frame.width/size.width,frame.height/size.height);
      const renderWidth=Math.max(1,Math.round(size.width*scale));
      const renderHeight=Math.max(1,Math.round(size.height*scale));
      context.drawImage(gl.domElement,Math.round((frame.width-renderWidth)/2),
        Math.round((frame.height-renderHeight)/2),renderWidth,renderHeight);
      frame.resolve();
    }catch(error){
      frame.reject(error instanceof Error?error:new Error('3Dのフレームを保存できませんでした。'));
    }
  }, 2);
  useEffect(() => () => onReady(false), [onReady]);

  useImperativeHandle(api, () => ({
    resetView,smoothResetView,getElapsedSeconds:()=>seconds.current,
    getFloorElapsedSeconds:()=>floorSeconds.current,
    beginVideoExport(){
      if(exportingVideo.current)throw new Error('3D動画はすでに書き出し中です。');
      beforeVideoTime.current=seconds.current;
      beforeVideoFloorTime.current=floorSeconds.current;
      exportingVideo.current=true;
      skipDelta.current=true;
    },
    async captureVideoFrame(time,width,height,canvas,signal){
      if(!exportingVideo.current)throw new Error('3D動画の書き出しが開始されていません。');
      if(pendingVideoFrame.current)throw new Error('前の動画フレームを処理中です。');
      if(signal.aborted)throw new DOMException('動画の保存をキャンセルしました。','AbortError');
      const error=threeResolutionError(width,height);
      if(error)throw new Error(error);
      const glContext=gl.getContext();
      const maxSize=Math.min(gl.capabilities.maxTextureSize,
        glContext.getParameter(glContext.MAX_RENDERBUFFER_SIZE));
      if(width>maxSize||height>maxSize||(low&&width*height>2_073_600))
        throw new Error('この端末では動画の解像度が高すぎます。720p以下を試してください。');
      canvas.width=width;canvas.height=height;
      const scale=Math.min(width/size.width,height/size.height);
      const rw=Math.max(1,Math.round(size.width*scale));
      const rh=Math.max(1,Math.round(size.height*scale));
      const dpr=gl.getPixelRatio();
      try{
        gl.setPixelRatio(1);gl.setSize(rw,rh,false);
        pipeline.current?.composer.setPixelRatio(1);
        pipeline.current?.composer.setSize(rw,rh);
        await new Promise<void>((resolve,reject)=>{
          const onAbort=()=>{
            pendingVideoFrame.current=null;
            reject(new DOMException('動画の保存をキャンセルしました。','AbortError'));
          };
          const cleanup=()=>signal.removeEventListener('abort',onAbort);
          signal.addEventListener('abort',onAbort,{once:true});
          pendingVideoFrame.current={
            time,width,height,canvas,
            resolve:()=>{cleanup();resolve();},
            reject:e=>{cleanup();reject(e);},
          };
          // React Three Fiber will render one deterministic frame through its
          // normal useFrame hierarchy, rather than replaying stale GPU data.
          invalidate();
        });
      }finally{
        gl.setPixelRatio(dpr);gl.setSize(size.width,size.height,false);
        pipeline.current?.composer.setPixelRatio(dpr);
        pipeline.current?.composer.setSize(size.width,size.height);
      }
    },
    endVideoExport(){
      if(!exportingVideo.current)return;
      exportingVideo.current=false;
      seconds.current=beforeVideoTime.current;
      floorSeconds.current=beforeVideoFloorTime.current;
      pendingVideoFrame.current?.reject(new Error('動画書き出しが終了しました。'));
      pendingVideoFrame.current=null;
      skipDelta.current=true;
      invalidate();
    },
    async savePNG(width, height) {
    const error = threeResolutionError(width, height); if (error) throw new Error(error);
    const maxSize = Math.min(gl.capabilities.maxTextureSize, gl.getContext().getParameter(gl.getContext().MAX_RENDERBUFFER_SIZE));
    if (width > maxSize || height > maxSize || (low && width * height > 4_194_304)) throw new Error('この描画設定では解像度が大きすぎます。軽量設定では合計4,194,304画素以内にしてください。');
    const output = document.createElement('canvas'); output.width = width; output.height = height;
    const context = output.getContext('2d'); if (!context) throw new Error('PNG用のメモリを確保できませんでした。');
    const scale = Math.min(width / size.width, height / size.height);
    const renderWidth = Math.max(1, Math.round(size.width * scale)), renderHeight = Math.max(1, Math.round(size.height * scale));
    // The new 3D PCB uses instanced materials updated in useFrame. When
    // toggling a hardware layer or restoring JSON, the PNG button can fire
    // before that first demand-render frame. Give R3F one real frame to apply
    // the exact paused route, chip and processor state before capture.
    if(settings.floorGrid?.style==='circuit'&&settings.floorGrid.circuitWorldEnabled&&!document.hidden){
      invalidate();
      await new Promise<void>(resolve=>requestAnimationFrame(()=>resolve()));
    }
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
  // Independent from the seed/entrance clock. Never reset it when a standby
  // morph begins, otherwise animated grid lines and PCB signals teleport.
  const floorSeconds=useRef(props.initialFloorTime??props.initialTime??0);
  const progressHost=useRef<HTMLDivElement>(null);
  const touchActions=useRef(new Set<string>());
  const world=props.settings.sky?.world??worldDefaults;
  const exploring=!!world.explore;
  const outdoor=!!props.settings.sky&&props.settings.sky.kind!=='classic';
  const sunlight=sunlightAtHour(world.timeOfDay);
  const objects = useMemo(() => visibleThreeObjects(props.composition, props.density, props.settings.enabledKinds), [props.composition, props.density, props.settings.enabledKinds]);
  const previousObjects=useMemo(()=>props.transition?
    visibleThreeObjects(props.transition.fromComposition,props.density,props.settings.enabledKinds):[],
    [props.transition,props.density,props.settings.enabledKinds]);
  const matches=useMemo<MorphMatch[]>(()=>props.transition?.mode==='morph'?
    matchThreeObjects(previousObjects,objects):[],[props.transition,previousObjects,objects]);
  const network=props.settings.network??networkDefaults,neon=props.settings.neon??neonDefaults;
  // Preserve network topology as the entire figure constellation spreads.
  const spacingFactor=threeSpacingFactor(props.settings.spacingPercent??100);
  const edges=useMemo(()=>network.enabled?
    networkConnections(objects,network.distance*spacingFactor,network.maxConnections,network.mode):[],
    [objects,network.enabled,network.distance,network.maxConnections,network.mode,spacingFactor]);
  const previousEdges=useMemo(()=>props.transition&&network.enabled?
    networkConnections(previousObjects,network.distance*spacingFactor,network.maxConnections,network.mode):[],
    [props.transition,previousObjects,network.enabled,network.distance,network.maxConnections,network.mode,spacingFactor]);
  const celestial=props.settings.celestial??celestialDefaults;
  // Generate celestial appearance from unscaled positions, then spread the
  // constellation without re-rolling its sizes, phases or surface patterns.
  const celestialBase=useMemo(()=>generateCelestialBodies(props.sourceComposition,celestial,props.density),
    [props.sourceComposition,celestial,props.density]);
  const celestialObjects=useMemo(()=>spaceCelestialBodies(celestialBase,props.settings.spacingPercent??100),
    [celestialBase,props.settings.spacingPercent]);
  const previousCelestial=useMemo(()=>props.transition?
    spaceCelestialBodies(generateCelestialBodies(props.transition.fromSourceComposition,celestial,props.density),props.settings.spacingPercent??100):[],
    [props.transition,celestial,props.density,props.settings.spacingPercent]);
  const outlines=useOutlineGeometry(neon.enabled,low);
  const onLost = useMemo(() => () => {props.onReady(false); setLost(true);}, [props.onReady]);
  if (!supported || lost) return <div className="three-fallback" role="alert"><h3>{lost ? '3D描画が中断されました' : 'この環境では3Dを表示できません'}</h3><p>WebGL 2対応ブラウザとハードウェアアクセラレーションが必要です。2Dモードは引き続き利用できます。中断した場合は軽量設定で3Dモードを開き直してください。</p></div>;
  return <div ref={progressHost} className="three-preview" data-testid="three-preview" data-quality={low ? 'low' : 'high'} data-object-count={objects.length}
    data-network-count={edges.length} data-network-mode={network.mode}
    data-neural-signals={network.enabled&&network.mode==='neural'&&network.animation==='signal'?'on':'off'}
    data-neon-mode={neon.enabled?neon.display:'off'}
    data-visibility-enabled={(props.settings.visibilityAnimation??visibilityDefaults).enabled?'true':'false'}
    data-visibility-mode={(props.settings.visibilityAnimation??visibilityDefaults).mode}
     data-entrance-enabled={(props.settings.entrance??entranceDefaults).enabled?'true':'false'}
     data-entrance-mode={(props.settings.entrance??entranceDefaults).mode}
    data-standby-active={props.transition?'true':'false'}
    data-standby-mode={props.transition?.mode??'off'}
    data-standby-pairs={matches.length}
    data-standby-entrance-complete={props.skipEntrance?'true':'false'}
    data-camera-auto-rotate={(props.settings.standby??standbyDefaults).enabled&&
      (props.settings.standby??standbyDefaults).cameraAutoRotate?'on':'off'}
    data-camera-orbit-mode={(props.settings.standby??standbyDefaults).cameraOrbitMode}
    data-floor-grid={(props.settings.floorGrid??floorGridDefaults).enabled?'on':'off'} data-floor-style={(props.settings.floorGrid??floorGridDefaults).style}
      data-celestial-count={celestialObjects.length}
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
      <FloorGrid grid={props.settings.floorGrid??floorGridDefaults} sceneHeight={props.composition.height} seconds={floorSeconds} view={props.view} low={low}/>
      {props.transition ? props.transition.mode==='morph'?
        matches.map(match=><group key={match.id}>
          {match.from&&match.to&&match.from.kind===match.to.kind?
            <Solid object={match.to} settings={props.settings} background={props.background}
              visualTheme={props.visualTheme} low={low} seconds={seconds} outlines={outlines} seed={props.skySeed}
              standby={{transition:props.transition!,variant:'shared',from:match.from,to:match.to}}/> :
            <>
              {match.from&&<Solid object={match.from} settings={props.settings} background={props.transition!.fromBackground}
                visualTheme={props.transition!.fromTheme} low={low} seconds={seconds} outlines={outlines}
                seed={props.transition!.fromSeed}
                standby={{transition:props.transition!,variant:'old',from:match.from,to:match.to}}/>}
              {match.to&&<Solid object={match.to} settings={props.settings} background={props.background}
                visualTheme={props.visualTheme} low={low} seconds={seconds} outlines={outlines} seed={props.skySeed}
                standby={{transition:props.transition!,variant:'new',from:match.from,to:match.to}}/>}
            </>}
        </group>):
        <>
          {previousObjects.map(object=><Solid key={'exit-'+object.id} object={object} settings={props.settings}
            background={props.transition!.fromBackground} visualTheme={props.transition!.fromTheme}
            low={low} seconds={seconds} outlines={outlines} seed={props.transition!.fromSeed}
            standby={{transition:props.transition!,variant:'old',from:object}}/>)}
          {objects.map(object=><Solid key={'enter-'+object.id} object={object} settings={props.settings}
            background={props.background} visualTheme={props.visualTheme}
            low={low} seconds={seconds} outlines={outlines} seed={props.skySeed}
            standby={{transition:props.transition!,variant:'new',to:object}}/>)}
        </>:
        objects.map(object=><Solid key={object.id} object={object} settings={props.settings}
          background={props.background} visualTheme={props.visualTheme} low={low}
          seconds={seconds} outlines={outlines} seed={props.skySeed} skipEntrance={props.skipEntrance}/>)}
      {props.transition&&previousCelestial.map(body=><CelestialObjectMesh key={'old-'+body.id}
        body={body} settings={props.settings} low={low} seconds={seconds} seed={props.transition!.fromSeed}
        standby={{transition:props.transition!,layer:'old'}}/>)}
      {celestialObjects.map(body=><CelestialObjectMesh key={body.id} body={body}
        settings={props.settings} low={low} seconds={seconds} seed={props.skySeed}
        standby={props.transition?{transition:props.transition,layer:'new'}:undefined}
        skipEntrance={props.skipEntrance}/>)}
      {props.transition&&previousEdges.length>0&&<NetworkLines objects={previousObjects} edges={previousEdges}
        settings={props.settings} background={props.transition.fromBackground} low={low} seconds={seconds}
        seed={props.transition.fromSeed} standby={{transition:props.transition,layer:'old',matches}}/>}
      {edges.length>0&&<NetworkLines objects={objects} edges={edges}
        settings={props.settings} background={props.background} low={low} seconds={seconds}
        seed={props.skySeed} standby={props.transition?{transition:props.transition,layer:'new',matches}:undefined}
        skipEntrance={props.skipEntrance}/>}
      {!props.transition&&edges.length>0&&network.enabled&&network.mode==='neural'&&network.animation==='signal'&&
        <NeuralSignals objects={objects} edges={edges} settings={props.settings}
          background={props.background} low={low} seconds={seconds} skipEntrance={props.skipEntrance}/>}
      <SceneRuntime {...props} progressHost={progressHost} low={low} seconds={seconds} floorSeconds={floorSeconds} onLost={onLost}/>
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
