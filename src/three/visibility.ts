import type {ThreeObject} from './model';

/** A loopable, seekable object entrance/exit envelope. Default OFF preserves all previous 3D scenes. */
export type ThreeVisibilitySettings={
  enabled:boolean;
  mode:'fade'|'scale'|'fade-scale';
  duration:number;
  visibleRatio:number;
  stagger:boolean;
  keepPrimaryVisible:boolean;
};
export const visibilityDefaults:ThreeVisibilitySettings={
  enabled:false,mode:'fade-scale',duration:12,visibleRatio:.65,
  stagger:true,keepPrimaryVisible:true,
};
export function validateThreeVisibility(value:unknown):ThreeVisibilitySettings {
  if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('3D出現・消失設定が不正です。');
  const v=value as Record<string,unknown>;
  if(typeof v.enabled!=='boolean'||!['fade','scale','fade-scale'].includes(String(v.mode))||
    typeof v.duration!=='number'||!Number.isFinite(v.duration)||v.duration<4||v.duration>30||
    typeof v.visibleRatio!=='number'||!Number.isFinite(v.visibleRatio)||v.visibleRatio<.1||v.visibleRatio>.9||
    typeof v.stagger!=='boolean'||typeof v.keepPrimaryVisible!=='boolean')
    throw new Error('3D出現・消失設定が不正です。');
  return {enabled:v.enabled,mode:v.mode as ThreeVisibilitySettings['mode'],duration:v.duration,
    visibleRatio:v.visibleRatio,stagger:v.stagger,keepPrimaryVisible:v.keepPrimaryVisible};
}

/** Returns 0–1 for a full fade-in, hold, fade-out and genuinely invisible gap.
 * An existing deterministic object phase gives each mesh a stable entrance time.
 * Loop boundaries and exported/restored timestamps always reproduce exactly.
 */
export function threeVisibility(object:Pick<ThreeObject,'role'|'phase'>,seconds:number,
  settings:ThreeVisibilitySettings=visibilityDefaults):number {
  if(!settings.enabled||(settings.keepPrimaryVisible&&object.role==='primary'))return 1;
  const time=Number.isFinite(seconds)?Math.max(0,seconds):0;
  const offset=settings.stagger?object.phase/(Math.PI*2):0;
  const cycle=((time/settings.duration+offset)%1+1)%1;
  const fade=Math.min(.14,settings.visibleRatio/3);
  if(cycle<fade)return cycle/fade;
  if(cycle<settings.visibleRatio-fade)return 1;
  if(cycle<settings.visibleRatio)return (settings.visibleRatio-cycle)/fade;
  return 0;
}
export const visibilityUsesFade=(settings:ThreeVisibilitySettings)=>settings.enabled&&(settings.mode==='fade'||settings.mode==='fade-scale');
export const visibilityUsesScale=(settings:ThreeVisibilitySettings)=>settings.enabled&&(settings.mode==='scale'||settings.mode==='fade-scale');
