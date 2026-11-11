/** Keep seed transitions perceptible even if WebGL freezes for multiple seconds.
 * The normal 3D animation clock is intentionally unchanged. */
export const MAX_STANDBY_FRAME_ADVANCE=0.12;

/** Render-frame advance for a one-shot standby transition.
 * No elapsed wall-clock jump can skip the entire shape/background morph. */
export function advanceStandbyClock(
  elapsed:number,deltaSeconds:number,speed:number,duration:number
):number{
  const length=Number.isFinite(duration)&&duration>0?duration:1;
  const previous=Number.isFinite(elapsed)?Math.max(0,Math.min(elapsed,length)):0;
  const frame=Number.isFinite(deltaSeconds)&&deltaSeconds>0?deltaSeconds:0;
  const rate=Number.isFinite(speed)&&speed>0?speed:1;
  const increment=Math.min(frame*rate,MAX_STANDBY_FRAME_ADVANCE);
  return Math.min(length,previous+increment);
}
