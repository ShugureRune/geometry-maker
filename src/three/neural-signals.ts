import {rootedWireSteps,type NetworkEdge} from './network';
import type {ThreeObject} from './model';

/** Visual-only 3D neural circuit ignition and traveling packets.
 * All signal timing is derived from scene time: pause, seek, screenshots and
 * video exports stay identical without timers or frame-dependent state.
 */
export const NEURAL_SIGNAL_LAUNCH_DELAY=.48;
export const NEURAL_SIGNAL_SPEED=3.2; // three-dimensional world units per second
export const NEURAL_SIGNAL_REST=.9; // silence after the last leaf is reached

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
export type NeuralSignalRoute={
  source:'a'|'b';sourceId:string;rootId:string;component:number;
  /** Seconds elapsed since the current synchronized signal wave began. */
  start:number;end:number;
};
export type NeuralSignalPlan={routes:NeuralSignalRoute[];cycle:number};

/** Convert the already-rooted wire propagation graph into a signal schedule.
 *
 * Every hero has start=0, so every outgoing hero cable emits in unison.
 * A medium-to-small cable starts at exactly the arrival time of the packet
 * on its parent hero-to-medium cable. Siblings split at the same instant.
 * Route times use actual 3D path length, not the edge's array index or size
 * rank; a single shared cycle keeps the entire forest synchronized forever.
 */
export function neuralSignalPlan(
  objects:readonly ThreeObject[],edges:readonly NetworkEdge[],
  parallelComponents=false,
):NeuralSignalPlan{
  const rooted=rootedWireSteps(objects,edges,parallelComponents);
  if(rooted.length===0)return {routes:[],cycle:1};
  // Animating independent VOID filaments in parallel must NOT speed up
  // electrical packets. Recover each component's OWN world-distance scale;
  // the normal 3D mode still uses its original single global scale.
  const scaleByComponent=new Map<number,number>();
  for(let i=0;i<rooted.length;i++){
    const route=rooted[i];
    const scale=Math.max(.001,edges[i].distance)/
      Math.max(1e-12,route.end-route.start);
    scaleByComponent.set(route.component,Math.max(
      scaleByComponent.get(route.component)??0,scale));
  }
  const distanceScale=parallelComponents?0:Math.max(...scaleByComponent.values());
  const routes=rooted.map(route=>{
    const secondsPerNormalized=(parallelComponents?
      scaleByComponent.get(route.component)!:distanceScale)/NEURAL_SIGNAL_SPEED;
    return {...route,start:route.start*secondsPerNormalized,
      end:route.end*secondsPerNormalized};
  });
  const lastArrival=Math.max(...routes.map(route=>route.end));
  return {routes,cycle:lastArrival+NEURAL_SIGNAL_REST};
}

/** A packet moves on the segment only after its upstream source is reached.
 * The entire tree repeats as one wave; using the same cycle for every edge
 * prevents disconnected per-wire pulses and makes branch arrivals exact.
 * A second visual lane uses a half-cycle offset but retains the same routing.
 */
export function neuralPacketAt(
  seconds:number,completion:number,route:Pick<NeuralSignalRoute,'start'|'end'>,
  cycle:number,lane=0,
):NeuralPacket|null{
  if(![seconds,completion,route.start,route.end,cycle,lane].every(Number.isFinite)||
    route.start<0||route.end<=route.start||cycle<=route.end||lane<0)return null;
  const elapsed=seconds-completion-NEURAL_SIGNAL_LAUNCH_DELAY-lane*cycle*.5;
  if(elapsed<=0)return null;
  const withinWave=elapsed%cycle;
  if(withinWave<=route.start||withinWave>=route.end)return null;
  const progress=(withinWave-route.start)/(route.end-route.start);
  const alpha=Math.min(1,progress*10,(1-progress)*10);
  return alpha>.001?{progress,alpha}:null;
}

/** A thin, fading wake behind each packet. Sampling earlier positions gives a
 * deterministic light streak without allocating timers, objects or motion
 * history. Never cross a route's source when a new signal is just arriving. */
export const NEURAL_TRAIL_STEP=.045;
export function neuralPacketTrailAt(
  seconds:number,completion:number,route:Pick<NeuralSignalRoute,'start'|'end'>,
  cycle:number,lane=0,count=3,
):NeuralPacket[]{
  if(!Number.isInteger(count)||count<0||count>8)return [];
  const samples:NeuralPacket[]=[];
  for(let i=0;i<=count;i++){
    const packet=neuralPacketAt(seconds-i*NEURAL_TRAIL_STEP,completion,route,cycle,lane);
    if(!packet)continue;
    const fade=Math.pow(.62,i);
    samples.push({progress:packet.progress,alpha:packet.alpha*fade});
  }
  return samples;
}

/** Brief node ignition exactly when an upstream packet reaches the relay or
 * leaf. Shared cycle and launch offset keep it synchronized with every split.
 * The first cycle never flashes before its first real arrival. */
export const NEURAL_ARRIVAL_FLASH_DURATION=.3;
export function neuralArrivalFlashAt(
  seconds:number,completion:number,route:Pick<NeuralSignalRoute,'start'|'end'>,
  cycle:number,lane=0,
):number{
  if(![seconds,completion,route.start,route.end,cycle,lane].every(Number.isFinite)||
    route.start<0||route.end<=route.start||cycle<=route.end||lane<0)return 0;
  const elapsed=seconds-completion-NEURAL_SIGNAL_LAUNCH_DELAY-lane*cycle*.5;
  // A half-cycle lane offset may round an exact arrival a few ulps early.
  if(elapsed<route.end-1e-9)return 0;
  // Treat near-zero and near-cycle remainders as an exact arrival. This
  // avoids missing one flash frame at repeated or offset wave boundaries.
  const remainder=(elapsed-route.end)%cycle;
  const sinceArrival=Math.abs(remainder)<1e-9||cycle-remainder<1e-9?0:remainder;
  if(sinceArrival<0||sinceArrival>=NEURAL_ARRIVAL_FLASH_DURATION)return 0;
  return Math.pow(1-sinceArrival/NEURAL_ARRIVAL_FLASH_DURATION,2);
}
