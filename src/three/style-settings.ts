import type {NetworkConnectionMode} from './network';

export const COLOR_MODES = ['auto', 'primary', 'support', 'accent', 'custom'] as const;
export type StyleColorMode = typeof COLOR_MODES[number];
export type NetworkSettings = {
  enabled: boolean; mode: NetworkConnectionMode; maxConnections: number; distance: number; width: number; opacity: number;
  glow: number; colorMode: StyleColorMode; customColor: string; animation: 'none' | 'pulse'; contrast: boolean;
};
export type NeonSettings = {
  enabled: boolean; display: 'lines' | 'transparent' | 'surface'; width: number;
  colorMode: StyleColorMode; customColor: string; glow: number; faceOpacity: number; contrast: boolean;
};
export const networkDefaults: NetworkSettings = {enabled:false, mode:'nearest', maxConnections:3, distance:4, width:1, opacity:.7,
  glow:100, colorMode:'auto', customColor:'#82dfff', animation:'none', contrast:false};
export const neonDefaults: NeonSettings = {enabled:false, display:'surface', width:1, colorMode:'auto',
  customColor:'#a3f2ff', glow:100, faceOpacity:.12, contrast:false};
export const STYLE_PRESETS = ['standard', 'network', 'cyber'] as const;
export type StylePreset = typeof STYLE_PRESETS[number];

export function stylePreset(preset: StylePreset): {network: NetworkSettings; neon: NeonSettings} {
  if (!STYLE_PRESETS.includes(preset)) throw new Error('未対応の3Dプリセットです。');
  if (preset === 'standard') return {network:{...networkDefaults}, neon:{...neonDefaults}};
  return {
    network:{...networkDefaults, enabled:true, glow:160, animation:preset==='network'?'pulse':'none', width:preset==='cyber'?.7:1},
    neon:{...neonDefaults, enabled:true, display:preset==='cyber'?'lines':'transparent', glow:160, width:preset==='cyber'?.8:1.2},
  };
}

export function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('3D設定はオブジェクトで指定してください。');
  return value as Record<string, unknown>;
}
export function numberField(value: unknown, min: number, max: number, name: string, integer=false): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max || (integer && !Number.isInteger(value))) throw new Error(`${name}は${min}〜${max}の${integer?'整数':'数値'}で指定してください。`);
  return value;
}
export function enumField<T extends string>(value: unknown, choices: readonly T[], name: string): T {
  if (typeof value !== 'string' || !choices.includes(value as T)) throw new Error(`${name}が不正です。`);
  return value as T;
}
export function booleanField(value: unknown, name: string): boolean {
  if (typeof value !== 'boolean') throw new Error(`${name}はtrueまたはfalseで指定してください。`);
  return value;
}
export function hexField(value: unknown): string {
  if (typeof value !== 'string' || !/^#[a-f0-9]{6}$/i.test(value)) throw new Error('3Dの色は#RRGGBBで指定してください。');
  return value;
}
export function validateNetwork(value: unknown): NetworkSettings {
  const d={...networkDefaults,...record(value)};
  return {enabled:booleanField(d.enabled,'接続ON/OFF'), mode:enumField(d.mode,['nearest','neural'],'接続方式'), maxConnections:numberField(d.maxConnections,1,6,'最大接続数',true),
    distance:numberField(d.distance,.5,15,'接続距離'), width:numberField(d.width,.25,6,'接続線の太さ'),
    opacity:numberField(d.opacity,0,1,'接続線の透明度'), glow:numberField(d.glow,0,200,'接続線の発光'),
    colorMode:enumField(d.colorMode,COLOR_MODES,'接続色モード'), customColor:hexField(d.customColor),
    animation:enumField(d.animation,['none','pulse'],'接続アニメーション'), contrast:booleanField(d.contrast,'接続色の補正')};
}
export function validateNeon(value: unknown): NeonSettings {
  const d={...neonDefaults,...record(value)};
  return {enabled:booleanField(d.enabled,'線画ON/OFF'), display:enumField(d.display,['lines','transparent','surface'],'線画表示方式'),
    width:numberField(d.width,.25,6,'輪郭線の太さ'), colorMode:enumField(d.colorMode,COLOR_MODES,'輪郭色モード'),
    customColor:hexField(d.customColor), glow:numberField(d.glow,0,200,'輪郭の発光'), faceOpacity:numberField(d.faceOpacity,0,1,'面の透明度'),
    contrast:booleanField(d.contrast,'輪郭色の補正')};
}
