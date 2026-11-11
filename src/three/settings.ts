import type {VisualTheme} from '../themes';
import {entranceDefaults,validateThreeEntrance,type ThreeEntranceSettings} from './entrance';
import {standbyDefaults,validateThreeStandby,type ThreeStandbySettings} from './standby';
import {THREE_KINDS,THREE_SPACING_DEFAULT,type ThreeKind,type Vector3Tuple} from './model';
import {visibilityDefaults,validateThreeVisibility,type ThreeVisibilitySettings} from './visibility';
import {floorGridDefaults,validateFloorGrid,type FloorGridSettings} from './floor-grid';
import {skyDefaults,validateSky,type SkySettings} from './sky-settings';
import {CELESTIAL_KINDS, celestialDefaults, validateCelestialSettings, type CelestialSettings} from './celestial';
import {networkDefaults, neonDefaults, record, enumField, numberField, booleanField, validateNetwork, validateNeon, type NetworkSettings, type NeonSettings} from './style-settings';

export type ThreeSettings = {
  network?: NetworkSettings; neon?: NeonSettings; enabledKinds?: ThreeKind[]; visibilityAnimation?:ThreeVisibilitySettings; entrance?:ThreeEntranceSettings; standby?:ThreeStandbySettings;
  floorGrid?:FloorGridSettings; celestial?:CelestialSettings; spacingPercent?: number; sky?:SkySettings;
  quality: 'auto' | 'low' | 'high'; material: 'theme' | 'matte' | 'metal' | 'glass' | 'wireframe';
  roughness: number; metalness: number; lightIntensity: number;
  animation: boolean; speed: number; floatAmount: number; rotationAmount: number;
};
export const threeDefaults: ThreeSettings = {
  network: {...networkDefaults}, neon: {...neonDefaults}, enabledKinds: [...THREE_KINDS], visibilityAnimation:{...visibilityDefaults}, entrance:{...entranceDefaults}, standby:{...standbyDefaults},
  floorGrid:{...floorGridDefaults}, celestial:{...celestialDefaults,kinds:[...CELESTIAL_KINDS]}, sky:{...skyDefaults},
  spacingPercent:THREE_SPACING_DEFAULT,
  quality: 'auto', material: 'theme', roughness: .32, metalness: .45, lightIntensity: 1,
  animation: true, speed: 1, floatAmount: 1, rotationAmount: 1,
};
/** Allowlisted rebuild: legacy settings without style fields keep normal 3D. */
export function validateThreeSettings(value: unknown): ThreeSettings {
  const source=record(value),d={...threeDefaults,...source};
  if(!Array.isArray(d.enabledKinds)||!d.enabledKinds.every(kind=>THREE_KINDS.includes(kind as ThreeKind))||new Set(d.enabledKinds).size!==d.enabledKinds.length)
    throw new Error('3D図形の種類設定が不正です。');
  return {enabledKinds:[...d.enabledKinds] as ThreeKind[],spacingPercent:numberField(d.spacingPercent,50,200,'3D図形の間隔'),quality:enumField(d.quality,['auto','low','high'],'3D描画品質'),
    material:enumField(d.material,['theme','matte','metal','glass','wireframe'],'3Dマテリアル'),
    roughness:numberField(d.roughness,0,1,'粗さ'), metalness:numberField(d.metalness,0,1,'金属感'),
    lightIntensity:numberField(d.lightIntensity,.1,3,'照明'), animation:booleanField(d.animation,'3Dアニメーション'),
    speed:numberField(d.speed,.25,4,'3D再生速度'), floatAmount:numberField(d.floatAmount,0,2,'浮遊量'),
    rotationAmount:numberField(d.rotationAmount,0,2,'回転量'), visibilityAnimation:validateThreeVisibility(d.visibilityAnimation),
    // Legacy project files did not have a one-shot entrance setting. Keep their old visuals.
    entrance:source.entrance===undefined?{...entranceDefaults,enabled:false}:validateThreeEntrance(d.entrance),
    standby:source.standby===undefined?{...standbyDefaults}:validateThreeStandby(d.standby),
    floorGrid:validateFloorGrid(d.floorGrid??floorGridDefaults), celestial:validateCelestialSettings(d.celestial??celestialDefaults),
    sky:validateSky(d.sky??skyDefaults), network:validateNetwork(d.network), neon:validateNeon(d.neon)};
}
export type ThreeView = {position: Vector3Tuple; target: Vector3Tuple};
export type ThreePreviewHandle = {
  savePNG:(width:number,height:number)=>Promise<Blob>;
  resetView:()=>void;smoothResetView?:()=>void;getElapsedSeconds?:()=>number;
  /** Export frame times are in animation seconds; canvas is reused by the encoder. */
  beginVideoExport:()=>void;
  captureVideoFrame:(seconds:number,width:number,height:number,canvas:HTMLCanvasElement,signal:AbortSignal)=>Promise<void>;
  endVideoExport:()=>void;
};
export const THREE_MAX_PIXELS = 16_777_216;
export function threeResolutionError(width: number, height: number) {
  return [width, height].every(n => Number.isInteger(n) && n >= 256 && n <= 4096) && width * height <= THREE_MAX_PIXELS
    ? null : '3D PNGは幅・高さ256〜4096px、合計16,777,216画素以内で指定してください。';
}
export function effectiveThreeQuality(quality: ThreeSettings['quality'], smallDevice: boolean): 'low' | 'high' {
  return quality === 'auto' ? smallDevice ? 'low' : 'high' : quality;
}
export function themeMaterial(theme: VisualTheme): Exclude<ThreeSettings['material'], 'theme'> {
  if (theme === 'blueprint' || theme === 'cyber') return 'wireframe';
  if (theme === 'hologram') return 'glass';
  if (theme === 'minimal' || theme === 'pastel' || theme === 'wa' || theme === 'pop') return 'matte';
  return 'metal';
}
