// Lazily loaded only inside ThreePreview. No extra 3D dependencies or network assets.
import {useEffect, useMemo, useRef, type RefObject} from 'react';
import {useFrame} from '@react-three/fiber';
import {AdditiveBlending, CanvasTexture, DoubleSide, Group, SRGBColorSpace} from 'three';
import {seededRandom} from '../scene';
import {celestialSpin, type CelestialBody, type CelestialKind} from './celestial';
import type {ThreeSettings} from './settings';
import {threeVisibility, visibilityDefaults} from './visibility';

function glowTexture(): CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 128;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('天体の発光テクスチャを作成できませんでした。');
  const halo = ctx.createRadialGradient(64, 64, 5, 64, 64, 64);
  halo.addColorStop(0, 'rgba(255,255,255,0.9)');
  halo.addColorStop(.22, 'rgba(255,255,255,0.5)');
  halo.addColorStop(.52, 'rgba(255,255,255,0.15)');
  halo.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = halo; ctx.fillRect(0, 0, 128, 128);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

function Glow({color, diameter, opacity = 1}: {color: string; diameter: number; opacity?: number}) {
  const texture = useMemo(glowTexture, []);
  useEffect(() => () => texture.dispose(), [texture]);
  return <sprite scale={[diameter, diameter, 1]}>
    <spriteMaterial map={texture} color={color} opacity={opacity} transparent depthWrite={false}
      blending={AdditiveBlending} toneMapped={false}/>
  </sprite>;
}

/** Equirectangular color maps make planets visibly non-emissive, with gas bands
 * and crater texture rather than relying on the current neon theme. */
function surfaceTexture(body: CelestialBody, low: boolean): CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = low ? 128 : 256; canvas.height = low ? 64 : 128;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('惑星表面テクスチャを作成できませんでした。');
  const random = seededRandom('celestial-surface:' + body.id + ':' + body.phase);
  const moon = body.kind === 'moon', gas = body.kind === 'ringed-planet';
  ctx.fillStyle = moon ? '#737b89' : gas ? '#c8a77d' : '#234a70';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (gas) {
    for (let i = 0; i < 24; i++) {
      const y = random() * canvas.height;
      ctx.fillStyle = ['#dfc49c', '#9c705b', '#e6d6ad', '#b08368'][i % 4];
      ctx.globalAlpha = .38 + random() * .38;
      ctx.fillRect(0, y, canvas.width, 1 + random() * 8);
    }
  } else if (moon) {
    for (let i = 0; i < (low ? 65 : 130); i++) {
      const x = random() * canvas.width, y = random() * canvas.height, radius = 1 + random() * 5;
      ctx.fillStyle = i % 3 ? '#555d6c' : '#a3aab2'; ctx.globalAlpha = .26 + random() * .28;
      ctx.beginPath(); ctx.ellipse(x, y, radius * 1.5, radius, 0, 0, Math.PI * 2); ctx.fill();
    }
  } else {
    for (let i = 0; i < (low ? 55 : 110); i++) {
      const x = random() * canvas.width, y = random() * canvas.height;
      ctx.fillStyle = i % 3 ? '#438b83' : '#79b3ac'; ctx.globalAlpha = .3 + random() * .48;
      ctx.beginPath(); ctx.ellipse(x, y, 3 + random() * 22, 1 + random() * 7, random() * .5, 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillStyle = '#a5d5e5'; ctx.globalAlpha = .34;
    ctx.fillRect(0, 0, canvas.width, 3); ctx.fillRect(0, canvas.height - 3, canvas.width, 3);
  }
  ctx.globalAlpha = 1;
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

function RockyBody({body, low}: {body: CelestialBody; low: boolean}) {
  const texture = useMemo(() => surfaceTexture(body, low), [body, low]);
  useEffect(() => () => texture.dispose(), [texture]);
  return <>
    <mesh castShadow={!low} receiveShadow={!low}>
      <sphereGeometry args={[1, low ? 24 : 48, low ? 16 : 32]}/>
      <meshStandardMaterial map={texture} color="#ffffff" roughness={body.kind === 'moon' ? 1 : .82} metalness={0}/>
    </mesh>
    {body.kind === 'ringed-planet' && <group rotation={[.70, .12, -.22]}>
      <mesh>
        <ringGeometry args={[1.15, 1.38, low ? 48 : 128]}/>
        <meshStandardMaterial color="#e9cfaa" side={DoubleSide} transparent opacity={.82} depthWrite={false} roughness={1}/>
      </mesh>
      <mesh>
        <ringGeometry args={[1.43, 1.62, low ? 48 : 128]}/>
        <meshStandardMaterial color="#9d8aa0" side={DoubleSide} transparent opacity={.57} depthWrite={false} roughness={1}/>
      </mesh>
      <mesh>
        <ringGeometry args={[1.70, 1.75, low ? 48 : 128]}/>
        <meshStandardMaterial color="#edccad" side={DoubleSide} transparent opacity={.6} depthWrite={false} roughness={1}/>
      </mesh>
    </group>}
  </>;
}

function Star({low}: {low: boolean}) {
  return <>
    <Glow color="#ffb44b" diameter={3.7} opacity={.8}/>
    <mesh>
      <sphereGeometry args={[1, low ? 24 : 48, low ? 16 : 32]}/>
      <meshBasicMaterial color="#ffe4a3" toneMapped={false}/>
    </mesh>
    <mesh scale={1.055}>
      <sphereGeometry args={[1, low ? 20 : 32, low ? 12 : 24]}/>
      <meshBasicMaterial color="#ff9941" transparent opacity={.14} depthWrite={false} blending={AdditiveBlending} toneMapped={false}/>
    </mesh>
    {!low && <pointLight color="#ffc377" intensity={7} distance={13} decay={2}/>}
  </>;
}

/** Approximate gravitational lens: photon ring + bent, colored accretion arcs.
 * This is deliberately an inexpensive visual approximation, not ray tracing. */
function BlackHole({low}: {low: boolean}) {
  const segments = low ? 48 : 96;
  return <>
    <Glow color="#f19f4c" diameter={3.25} opacity={.58}/>
    <group rotation={[.95, .18, .24]}>
      <mesh>
        <torusGeometry args={[1.07, .16, low ? 8 : 12, segments]}/>
        <meshBasicMaterial color="#ff9d4a" transparent opacity={.78} depthWrite={false} blending={AdditiveBlending} toneMapped={false}/>
      </mesh>
      <mesh>
        <torusGeometry args={[1.28, .055, 8, segments]}/>
        <meshBasicMaterial color="#e8aaff" transparent opacity={.65} depthWrite={false} blending={AdditiveBlending} toneMapped={false}/>
      </mesh>
    </group>
    <mesh>
      <sphereGeometry args={[.77, low ? 24 : 48, low ? 16 : 32]}/>
      <meshBasicMaterial color="#000008" toneMapped={false}/>
    </mesh>
    <mesh>
      <torusGeometry args={[.8, .031, 8, segments]}/>
      <meshBasicMaterial color="#fff1c8" toneMapped={false}/>
    </mesh>
    <group rotation={[0, 0, -.23]}>
      <mesh>
        <torusGeometry args={[1.13, .025, 8, segments, Math.PI * 1.3]}/>
        <meshBasicMaterial color="#d0b9ff" transparent opacity={.9} depthWrite={false} blending={AdditiveBlending} toneMapped={false}/>
      </mesh>
      <mesh rotation={[0, 0, Math.PI]}>
        <torusGeometry args={[1.40, .019, 8, segments, Math.PI * .7]}/>
        <meshBasicMaterial color="#f9b76b" transparent opacity={.8} depthWrite={false} blending={AdditiveBlending} toneMapped={false}/>
      </mesh>
    </group>
  </>;
}

function Jet({direction, low}: {direction: 1 | -1; low: boolean}) {
  const length = 2.15;
  return <group position={[0, direction * length / 2, 0]} rotation={[0, 0, direction === 1 ? Math.PI : 0]}>
    <mesh>
      <coneGeometry args={[.38, length, low ? 12 : 24, 1, true]}/>
      <meshBasicMaterial color="#45d9ff" transparent opacity={.26} side={DoubleSide} depthWrite={false}
        blending={AdditiveBlending} toneMapped={false}/>
    </mesh>
    <mesh>
      <coneGeometry args={[.14, length * .98, low ? 10 : 18, 1, true]}/>
      <meshBasicMaterial color="#e8ffff" transparent opacity={.51} side={DoubleSide} depthWrite={false}
        blending={AdditiveBlending} toneMapped={false}/>
    </mesh>
  </group>;
}

function NeutronStar({low, seconds, settings}: {low: boolean; seconds: RefObject<number>; settings: ThreeSettings}) {
  const beams = useRef<Group>(null);
  useFrame(() => {
    if (beams.current) beams.current.rotation.y = celestialSpin('neutron-star', seconds.current, settings.rotationAmount);
  });
  return <>
    <Glow color="#4ccaff" diameter={2.9} opacity={.9}/>
    <mesh>
      <sphereGeometry args={[.89, low ? 24 : 48, low ? 16 : 32]}/>
      <meshBasicMaterial color="#e0faff" toneMapped={false}/>
    </mesh>
    <group ref={beams} rotation={[0, 0, .52]}>
      <Jet direction={1} low={low}/><Jet direction={-1} low={low}/>
    </group>
  </>;
}

export function CelestialObjectMesh({body, low, seconds, settings}: {
  body: CelestialBody; low: boolean; seconds: RefObject<number>; settings: ThreeSettings;
}) {
  const root = useRef<Group>(null);
  const appearance = settings.visibilityAnimation ?? visibilityDefaults;
  useFrame(() => {
    if (!root.current) return;
    const visible = threeVisibility(body, seconds.current, appearance);
    root.current.visible = visible > .001;
    // A reversible scale envelope hides every child, including halo and beam,
    // so fading never leaves black GPU transparency ghosts.
    root.current.scale.setScalar(body.radius * Math.max(.001, visible));
    root.current.rotation.y = body.kind === 'neutron-star' ? 0 :
      celestialSpin(body.kind, seconds.current, settings.rotationAmount) + body.phase * .12;
  });
  return <group ref={root} position={body.position} scale={body.radius} name={body.id}>
    {(body.kind === 'planet' || body.kind === 'ringed-planet' || body.kind === 'moon') &&
      <RockyBody body={body} low={low}/>}
    {body.kind === 'star' && <Star low={low}/>}
    {body.kind === 'black-hole' && <BlackHole low={low}/>}
    {body.kind === 'neutron-star' && <NeutronStar low={low} seconds={seconds} settings={settings}/>}
  </group>;
}

export const CELESTIAL_LABELS: Record<CelestialKind, string> = {
  star: '光る恒星', planet: '惑星（非発光）', 'ringed-planet': 'リング付き惑星',
  moon: '衛星', 'black-hole': 'ブラックホール', 'neutron-star': '中性子星（双方向ビーム）',
};
