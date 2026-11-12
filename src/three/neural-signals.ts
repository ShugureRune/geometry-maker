/** Visual-only 3D neural circuit ignition and traveling packets.
 * Depends solely on scene time: pause, seek, screenshots and video exports
 * produce the exact same positions without setTimeout or random state.
 */
export const NEURAL_SIGNAL_LAUNCH_DELAY=.48;

/** A sharp shared ignition at the end of the full entrance (including wires). */
export function neuralStartupFlash(seconds:number,completion:number):number{
  if(!Number.isFinite(seconds)||!Number.isFinite(completion))return 0;
  const t=seconds-completion;
  if(t<0||t>=.65)return 0;
  const initial=2.6*Math.pow(Math.max(0,1-t/.52),2);
  const echo=.45*Math.max(0,1-Math.abs(t-.25)/.13);
  return initial+echo;
}
export type NeuralPacket={progress:number;alpha:number};
/** Every wire carries packets from its larger node to its smaller node.
 * A short dark gap hides the loop reset, rather than teleporting a glowing dot.
 */
export function neuralPacketAt(
  seconds:number,completion:number,rank:number,distance:number,lane=0,
):NeuralPacket|null{
  if(![seconds,completion,rank,distance,lane].every(Number.isFinite))return null;
  const travel=Math.max(.26,Math.max(.1,distance)/3.2);
  const cycle=travel+Math.max(.75,1.5-travel*.12);
  const elapsed=seconds-completion-NEURAL_SIGNAL_LAUNCH_DELAY-
    Math.max(0,rank)*.055-Math.max(0,lane)*cycle*.5;
  if(elapsed<=0)return null;
  const position=elapsed%cycle;
  if(position>=travel)return null;
  const progress=Math.min(1,position/travel);
  const alpha=Math.min(1,progress*10,(1-progress)*10);
  return alpha>.001?{progress,alpha}:null;
}
