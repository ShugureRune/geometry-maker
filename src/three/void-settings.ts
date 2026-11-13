import {networkDefaults,neonDefaults,record,validateNetwork,validateNeon,type NetworkSettings,type NeonSettings} from './style-settings';
import type {ThreeSettings} from './settings';
import {entranceDefaults} from './entrance';

export const VOID_ALGORITHM_VERSION='void-filaments-v1';
export type VoidSettings={enabled:boolean;version:typeof VOID_ALGORITHM_VERSION;network:NetworkSettings;neon:NeonSettings};
export const voidDefaults:VoidSettings={enabled:false,version:VOID_ALGORITHM_VERSION,
  network:{...networkDefaults,enabled:true,mode:'neural',animation:'signal',contrast:true},
  neon:{...neonDefaults,enabled:true,display:'surface',glow:110,contrast:true}};
export function validateVoidSettings(value:unknown):VoidSettings{
  const d={...voidDefaults,...record(value)};
  if(typeof d.enabled!=='boolean'||d.version!==VOID_ALGORITHM_VERSION)throw new Error('VOIDプロトタイプの設定／版が不正です。');
  const network=validateNetwork(d.network);
  if(network.mode!=='neural')throw new Error('VOIDの配線はフィラメント固定です。');
  return {enabled:d.enabled,version:VOID_ALGORITHM_VERSION,network,neon:validateNeon(d.neon)};
}
/** Never mutate the saved ordinary-3D styles. Slow drift protects the cavities. */
export function voidRenderSettings(settings:ThreeSettings):ThreeSettings{
  if(!settings.voidMode?.enabled)return settings;
  return {...settings,floatAmount:settings.floatAmount*.18,
    entrance:{...(settings.entrance??entranceDefaults),mode:'neural-grow'},
    network:{...settings.voidMode.network,mode:'neural'},neon:settings.voidMode.neon};
}
