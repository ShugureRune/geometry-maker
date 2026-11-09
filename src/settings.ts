import { ambientSettings, type AmbientSettings } from './ambient';
import { videoSettings, type VideoSettings } from './video-settings';
import { animationSettings,type AnimationSettings } from './animation';
import { validDensity } from './density';
import { validateColors, type ColorSettings } from './colors';
import { ALGORITHM_VERSION, LEGACY_ALGORITHM_VERSION, RATIOS, type Background, type Ratio } from './scene';

export const MIN_SIZE = 256;
export const MAX_SIZE = 8192;
export const MAX_PNG_PIXELS = 16_777_216;
export const MAX_SETTINGS_BYTES = 64 * 1024;
export const EXPORT_PRESETS = [
  { width: 1280, height: 720, ratio: '16:9' },
  { width: 1920, height: 1080, ratio: '16:9' },
  { width: 1080, height: 1920, ratio: '9:16' },
  { width: 1080, height: 1350, ratio: '4:5' },
  { width: 2048, height: 2048, ratio: '1:1' },
] as const;
export type ProjectSettings = Partial<AnimationSettings> & Partial<VideoSettings> & {
  ambient?:AmbientSettings; lineWidth?:number; glowIntensity?:number; density?:number; colorSettings?: ColorSettings; schemaVersion: 1; algorithmVersion: string; seed: string; aspectRatio: Ratio;
  backgroundMode: Background['mode']; solidColor: string; gradientColors: Background['colors']; gradientAngle: number;
  exportWidth: number; exportHeight: number;
};
export function resolutionError(width: number, height: number): string | null {
  return [width, height].every(n => Number.isInteger(n) && n >= MIN_SIZE && n <= MAX_SIZE)
    ? null : `幅・高さは${MIN_SIZE}〜${MAX_SIZE}pxの整数で指定してください。`;
}
export function parseSettings(text: string): ProjectSettings {
  if (new TextEncoder().encode(text).length > MAX_SETTINGS_BYTES) throw new Error('設定JSONは64KB以下にしてください。');
  let data: unknown;
  try { data = JSON.parse(text); } catch { throw new Error('JSONの書式が正しくありません。'); }
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('設定JSONはオブジェクトで指定してください。');
  const d = data as Record<string, unknown>;
  if (d.schemaVersion !== 1) throw new Error('未対応の設定スキーマです（schemaVersion: 1が必要）。');
  if (d.algorithmVersion !== ALGORITHM_VERSION && d.algorithmVersion !== LEGACY_ALGORITHM_VERSION) throw new Error(`未対応のアルゴリズム版です。このアプリは${LEGACY_ALGORITHM_VERSION} / ${ALGORITHM_VERSION}に対応しています。`);
  if (typeof d.seed !== 'string' || d.seed.length > 4096) throw new Error('seedは4096文字以下の文字列が必要です。');
  if (typeof d.aspectRatio !== 'string' || !Object.hasOwn(RATIOS, d.aspectRatio)) throw new Error('aspectRatioに対応する縦横比を指定してください。');
  if (d.backgroundMode !== 'solid' && d.backgroundMode !== 'gradient') throw new Error('backgroundModeはsolidまたはgradientが必要です。');
  const color = (v: unknown): v is string => typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v);
  if (!color(d.solidColor) || !Array.isArray(d.gradientColors) || d.gradientColors.length !== 3 || !d.gradientColors.every(color)) throw new Error('背景色は#RRGGBB、gradientColorsは3色で指定してください。');
  if (typeof d.gradientAngle !== 'number' || !Number.isFinite(d.gradientAngle) || d.gradientAngle < 0 || d.gradientAngle > 360) throw new Error('gradientAngleは0〜360の数値が必要です。');
  if (typeof d.exportWidth !== 'number' || typeof d.exportHeight !== 'number' || resolutionError(d.exportWidth, d.exportHeight)) throw new Error(resolutionError(NaN, NaN)!);
  if(d.density!==undefined&&!validDensity(d.density))throw new Error('図形密度は0〜100%の整数で指定してください。');
  if(d.glowIntensity!==undefined&&!(typeof d.glowIntensity==='number'&&Number.isInteger(d.glowIntensity)&&d.glowIntensity>=0&&d.glowIntensity<=200))throw new Error('発光強度は0〜200%の整数で指定してください。');
  if(d.lineWidth!==undefined&&!(typeof d.lineWidth==='number'&&Number.isInteger(d.lineWidth)&&d.lineWidth>=50&&d.lineWidth<=300))throw new Error('線の太さは50〜300%の整数で指定してください。');
  // Rebuild the allowlisted object; never merge arbitrary JSON into application state.
  return { ...(d.ambient===undefined?{}:{ambient:ambientSettings(d.ambient)}), ...(d.lineWidth===undefined?{}:{lineWidth:d.lineWidth as number}), ...(Object.keys(d).some(k=>k.startsWith('exportVideo'))?videoSettings(d):{}), ...(d.glowIntensity===undefined?{}:{glowIntensity:d.glowIntensity as number}), ...(Object.keys(d).some(k=>k.startsWith('animation')||k==='playbackSpeed'||k==='easingType')?animationSettings(d):{}), density:d.density===undefined?50:d.density as number, ...(d.colorSettings === undefined ? {} : {colorSettings: validateColors(d.colorSettings)}), schemaVersion: 1, algorithmVersion: d.algorithmVersion, seed: d.seed, aspectRatio: d.aspectRatio as Ratio,
    backgroundMode: d.backgroundMode, solidColor: d.solidColor, gradientColors: [...d.gradientColors] as Background['colors'],
    gradientAngle: d.gradientAngle, exportWidth: d.exportWidth, exportHeight: d.exportHeight };
}
export const settingsText = (settings: ProjectSettings) => JSON.stringify(parseSettings(JSON.stringify(settings)), null, 2) + '\n';
export function fileStem(seed: string, version = ALGORITHM_VERSION): string {
  const safe = seed.normalize('NFC').replace(/[^\p{L}\p{N}_-]/gu, '-').slice(0, 64) || 'empty';
  return `geometry-maker_${version}_seed-${safe}`;
}
