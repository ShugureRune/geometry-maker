import {Color} from 'three';
import type {Background} from '../scene';
import type {ThreeObject} from './model';
import {fallbackThreeColors,radiance,styleColor} from './style-paint';
import type {NetworkSettings} from './style-settings';

/** Exactly the vertex color that NetworkLines uses at a wire endpoint.
 * Reuse for signal heads and trails so gradients never drift out of sync
 * when auto/custom colors, background contrast or glow settings change.
 */
export function networkEndpointColor(
  role:ThreeObject['role'],network:NetworkSettings,background:Background,low:boolean,
):Color{
  const color=new Color(styleColor(network.colorMode,network.customColor,
    role,background,network.contrast));
  return color.multiplyScalar(radiance(color,network.glow,low));
}

/** The *solid figure* color, intentionally NOT the network's custom tint,
 * background-contrast correction or HDR wire glow. Receiver flashes should
 * visually belong to the node that receives the impulse.
 */
export function networkReceiverColor(
  role:ThreeObject['role'],background:Background,
):Color{
  return new Color(background.figureColors?.[role]??fallbackThreeColors[role]);
}

/** Arrival halos are additive and unlit, so the receiver's exact dark
 * surface RGB can disappear against the background. Brighten ONLY the halo
 * to a minimum peak intensity in linear RGB, preserving the ratios between
 * channels (and thus the figure's hue). Bright nodes are left untouched.
 * Pure black has no hue to preserve: use a neutral glow so it is still seen.
 * The solid itself and the traveling wire/packet gradient stay unchanged.
 */
export const MIN_NEURAL_ARRIVAL_GLOW_PEAK=.85;
export function networkArrivalGlowColor(
  role:ThreeObject['role'],background:Background,
):Color{
  const color=networkReceiverColor(role,background);
  const peak=Math.max(color.r,color.g,color.b);
  if(peak<=1e-12)return new Color('#ededed');
  return color.multiplyScalar(Math.max(1,MIN_NEURAL_ARRIVAL_GLOW_PEAK/peak));
}

/** Sample the same linear-RGB interpolation as a LineMaterial vertex-color
 * gradient. The reusable output avoids Color allocations on every frame.
 */
export function neuralWireColorAt(
  source:Color,target:Color,progress:number,result:Color,
):Color{
  const t=Number.isFinite(progress)?Math.max(0,Math.min(1,progress)):0;
  // Exact endpoint copies avoid small rounding differences from Color.lerp(1),
  // so the signal tip cannot be a slightly different hue at its receiver.
  if(t<=0)return result.copy(source);
  if(t>=1)return result.copy(target);
  return result.copy(source).lerp(target,t);
}
