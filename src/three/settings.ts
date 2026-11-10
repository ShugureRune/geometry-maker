import type {VisualTheme} from '../themes';
import type {Vector3Tuple} from './model';

export type ThreeSettings = {
  quality: 'auto' | 'low' | 'high'; material: 'theme' | 'matte' | 'metal' | 'glass' | 'wireframe';
  roughness: number; metalness: number; lightIntensity: number;
  animation: boolean; speed: number; floatAmount: number; rotationAmount: number;
};
export const threeDefaults: ThreeSettings = {
  quality: 'auto', material: 'theme', roughness: .32, metalness: .45, lightIntensity: 1,
  animation: true, speed: 1, floatAmount: 1, rotationAmount: 1,
};
export type ThreeView = {position: Vector3Tuple; target: Vector3Tuple};
export type ThreePreviewHandle = {savePNG: (width: number, height: number) => Promise<Blob>; resetView: () => void};
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
