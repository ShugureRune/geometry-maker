import {describe,it,expect} from 'vitest';
import {generateThreeComposition} from './model';
import {networkConnections} from './network';
import {neuralStartupFlash,neuralPacketAt,neuralSignalPlan,neuralPacketTrailAt,
  neuralArrivalFlashAt,NEURAL_ARRIVAL_FLASH_DURATION,NEURAL_TRAIL_STEP,
  NEURAL_SIGNAL_LAUNCH_DELAY,NEURAL_SIGNAL_SPEED,NEURAL_SIGNAL_REST} from './neural-signals';

const base=generateThreeComposition('impulse-branching','16:9').objects[0];
const node=(id:string,role:'primary'|'support'|'accent',x:number,y=0,radius=1)=>({
  ...base,id,role,radius,position:[x,y,0] as [number,number,number],
});
const objects=[
  node('small-b','accent',24),node('middle-a','support',3.2,0,2),
  node('hero-b','primary',20,0,.1),node('small-a2','accent',3.2,1.6),
  node('hero-a','primary',0,0,.2),node('small-a1','accent',4.8),
  node('middle-b','support',22.4),
];
const edges=networkConnections(objects,15,6,'neural');
const plan=neuralSignalPlan(objects,edges);
const byChild=new Map(edges.map((edge,i)=>[edge.b,plan.routes[i]]));

describe('deterministic neural circuit ignition',()=>{
  it('flashes all nodes only after the full entrance duration',()=>{
    expect(neuralStartupFlash(5.999,6)).toBe(0);
    expect(neuralStartupFlash(6,6)).toBeGreaterThan(2);
    expect(neuralStartupFlash(6.2,6)).toBeGreaterThan(0);
    expect(neuralStartupFlash(6.65,6)).toBe(0);
    expect(neuralStartupFlash(10,6)).toBe(0);
    expect(neuralStartupFlash(NaN,6)).toBe(0);
  });
  it('launches both primary trees at exactly the same time, even when the relays are physically larger',()=>{
    const primaryA=byChild.get('middle-a')!,primaryB=byChild.get('middle-b')!;
    expect(primaryA.start).toBe(0);
    expect(primaryB.start).toBe(0);
    expect(primaryA.rootId).toBe('hero-a');
    expect(primaryB.rootId).toBe('hero-b');
    expect(primaryA.sourceId).toBe('hero-a');
    expect(primaryB.sourceId).toBe('hero-b');
    expect(primaryA.source).toBe('a');
    expect(primaryB.source).toBe('a');
    expect(primaryA.end).toBeCloseTo(3.2/NEURAL_SIGNAL_SPEED,10);
    expect(primaryB.end).toBeCloseTo(2.4/NEURAL_SIGNAL_SPEED,10);
    const begin=6+NEURAL_SIGNAL_LAUNCH_DELAY;
    expect(neuralPacketAt(begin,6,primaryA,plan.cycle)).toBeNull();
    expect(neuralPacketAt(begin,6,primaryB,plan.cycle)).toBeNull();
    const simultaneous=begin+.08;
    expect(neuralPacketAt(simultaneous,6,primaryA,plan.cycle)).not.toBeNull();
    expect(neuralPacketAt(simultaneous,6,primaryB,plan.cycle)).not.toBeNull();
  });
  it('splits a pulse into ALL children at the exact moment the medium receives it',()=>{
    const parentA=byChild.get('middle-a')!,parentB=byChild.get('middle-b')!;
    const leafA1=byChild.get('small-a1')!,leafA2=byChild.get('small-a2')!;
    const leafB=byChild.get('small-b')!;
    expect(leafA1.sourceId).toBe('middle-a');
    expect(leafA2.sourceId).toBe('middle-a');
    expect(leafB.sourceId).toBe('middle-b');
    expect(leafA1.start).toBeCloseTo(parentA.end,10);
    expect(leafA2.start).toBeCloseTo(parentA.end,10);
    expect(leafB.start).toBeCloseTo(parentB.end,10);
    expect(leafA1.end-leafA1.start).toBeCloseTo(1.6/NEURAL_SIGNAL_SPEED,10);
    const begin=5+NEURAL_SIGNAL_LAUNCH_DELAY;
    const before=begin+parentA.end-.02;
    expect(neuralPacketAt(before,5,leafA1,plan.cycle)).toBeNull();
    expect(neuralPacketAt(before,5,leafA2,plan.cycle)).toBeNull();
    const after=begin+parentA.end+.03;
    const a1=neuralPacketAt(after,5,leafA1,plan.cycle);
    const a2=neuralPacketAt(after,5,leafA2,plan.cycle);
    expect(a1).not.toBeNull();
    expect(a2).not.toBeNull();
    expect(a1!.progress).toBeCloseTo(a2!.progress,10);
    // The shorter hero-B path branches independently, without waiting for A.
    const afterB=begin+parentB.end+.03;
    expect(afterB).toBeLessThan(after);
    expect(neuralPacketAt(afterB,5,leafB,plan.cycle)).not.toBeNull();
    expect(neuralPacketAt(afterB,5,leafA1,plan.cycle)).toBeNull();
  });
  it('repeats the whole network on ONE shared cycle and leaves a rest period between waves',()=>{
    const farthest=Math.max(...plan.routes.map(route=>route.end));
    expect(plan.cycle).toBeCloseTo(farthest+NEURAL_SIGNAL_REST,10);
    const begin=6+NEURAL_SIGNAL_LAUNCH_DELAY;
    const sample=begin+.15;
    for(const route of plan.routes){
      const first=neuralPacketAt(sample,6,route,plan.cycle);
      for(const repeat of [1,2]){
        const again=neuralPacketAt(sample+repeat*plan.cycle,6,route,plan.cycle);
        if(first===null)expect(again).toBeNull();
        else{
          expect(again).not.toBeNull();
          // Remainder arithmetic introduces sub-ulp differences on repeat.
          expect(again!.progress).toBeCloseTo(first.progress,10);
          expect(again!.alpha).toBeCloseTo(first.alpha,10);
        }
      }
      const quiet=begin+farthest+NEURAL_SIGNAL_REST*.5;
      expect(neuralPacketAt(quiet,6,route,plan.cycle)).toBeNull();
    }
    // Second high-quality lane shares the same parent/child routing,
    // but its complete wave starts halfway between the first lane's waves.
    const root=byChild.get('middle-a')!;
    expect(neuralPacketAt(begin+plan.cycle*.5+.1,6,root,plan.cycle,1)).not.toBeNull();
    expect(neuralPacketAt(begin+.1,6,root,plan.cycle,1)).toBeNull();
  });
  it('keeps schedule deterministic regardless of geometry or edge array order',()=>{
    const reversed=[...edges].reverse();
    const other=neuralSignalPlan([...objects].reverse(),reversed);
    const key=(edge:{a:string;b:string})=>[edge.a,edge.b].sort().join(':');
    const byKey=new Map(reversed.map((edge,i)=>[key(edge),other.routes[i]]));
    edges.forEach((edge,i)=>{
      const a=plan.routes[i],b=byKey.get(key(edge))!;
      expect(a.sourceId).toBe(b.sourceId);
      expect(a.rootId).toBe(b.rootId);
      expect(a.start).toBeCloseTo(b.start,10);
      expect(a.end).toBeCloseTo(b.end,10);
    });
    expect(other.cycle).toBeCloseTo(plan.cycle,10);
    expect(neuralSignalPlan(objects,[])).toEqual({routes:[],cycle:1});
  });
  it('never produces invalid packets, frozen positions, or a visible teleport at a loop boundary',()=>{
    const route=byChild.get('middle-a')!;
    expect(neuralPacketAt(Infinity,6,route,plan.cycle)).toBeNull();
    expect(neuralPacketAt(6,Infinity,route,plan.cycle)).toBeNull();
    expect(neuralPacketAt(6,6,{start:1,end:1},plan.cycle)).toBeNull();
    expect(neuralPacketAt(6,6,route,0)).toBeNull();
    expect(neuralPacketAt(6,6,route,plan.cycle,-1)).toBeNull();
    const begin=6+NEURAL_SIGNAL_LAUNCH_DELAY;
    const samples=Array.from({length:400},(_,i)=>
      neuralPacketAt(begin+i*.015,6,route,plan.cycle));
    expect(samples.some(x=>x===null)).toBe(true);
    expect(samples.some(x=>x!==null)).toBe(true);
    expect(samples.filter((x):x is NonNullable<typeof x>=>x!==null)
      .every(x=>x.progress>0&&x.progress<1&&x.alpha>0&&x.alpha<=1)).toBe(true);
    expect(neuralPacketAt(begin+plan.cycle-.01,6,route,plan.cycle)).toBeNull();
    expect(neuralPacketAt(begin+plan.cycle+.01,6,route,plan.cycle)?.progress??0)
      .toBeGreaterThan(0);
  });
});

describe('glowing neural trail and arrival feedback',()=>{
  it('leaves a series of fading positions BEHIND the packet head',()=>{
    const route=byChild.get('middle-a')!;
    const now=6+NEURAL_SIGNAL_LAUNCH_DELAY+route.end*.75;
    const trail=neuralPacketTrailAt(now,6,route,plan.cycle,0,4);
    expect(trail.length).toBe(5);
    const head=neuralPacketAt(now,6,route,plan.cycle)!;
    expect(trail[0]).toEqual(head);
    for(let i=1;i<trail.length;i++){
      expect(trail[i].progress).toBeLessThan(trail[i-1].progress);
      expect(trail[i].alpha).toBeLessThanOrEqual(trail[i-1].alpha);
      expect(trail[i].progress).toBeCloseTo(
        neuralPacketAt(now-i*NEURAL_TRAIL_STEP,6,route,plan.cycle)!.progress,10);
    }
    expect(neuralPacketTrailAt(now,6,route,plan.cycle,0,20)).toEqual([]);
    expect(neuralPacketTrailAt(now,6,route,plan.cycle,0,-1)).toEqual([]);
  });
  it('clips the trail at the START of its own wire instead of leaking from a parent edge',()=>{
    const root=byChild.get('middle-a')!;
    const child=byChild.get('small-a1')!;
    const firstArrival=6+NEURAL_SIGNAL_LAUNCH_DELAY+root.end;
    expect(neuralPacketTrailAt(firstArrival-.01,6,child,plan.cycle,0,4)).toEqual([]);
    const justAfter=firstArrival+.06;
    const tail=neuralPacketTrailAt(justAfter,6,child,plan.cycle,0,4);
    expect(tail.length).toBeGreaterThan(0);
    expect(tail.length).toBeLessThan(5);
    expect(tail.every(v=>v.progress>=0&&v.progress<=1)).toBe(true);
  });
  it('flashes the medium at its reception time, then all split branches run in parallel',()=>{
    const parent=byChild.get('middle-a')!;
    const childA=byChild.get('small-a1')!,childB=byChild.get('small-a2')!;
    const finish=6+NEURAL_SIGNAL_LAUNCH_DELAY+parent.end;
    expect(neuralArrivalFlashAt(finish-.001,6,parent,plan.cycle)).toBe(0);
    expect(neuralArrivalFlashAt(finish,6,parent,plan.cycle)).toBeCloseTo(1,10);
    expect(neuralArrivalFlashAt(finish+.15,6,parent,plan.cycle)).toBeGreaterThan(0);
    expect(neuralArrivalFlashAt(finish+NEURAL_ARRIVAL_FLASH_DURATION+.01,6,parent,plan.cycle))
      .toBe(0);
    expect(neuralPacketAt(finish+.04,6,childA,plan.cycle)).not.toBeNull();
    expect(neuralPacketAt(finish+.04,6,childB,plan.cycle)).not.toBeNull();
    const leafArrival=6+NEURAL_SIGNAL_LAUNCH_DELAY+childA.end;
    expect(neuralArrivalFlashAt(leafArrival,6,childA,plan.cycle)).toBeCloseTo(1,10);
  });
  it('starts new arrivals only on their own waves with no phantom startup or loop flashes',()=>{
    const root=byChild.get('middle-b')!;
    const begin=6+NEURAL_SIGNAL_LAUNCH_DELAY;
    for(const t of [-.5,0,.4]){
      expect(neuralArrivalFlashAt(begin+t,6,root,plan.cycle)).toBe(0);
    }
    const end=begin+root.end;
    expect(neuralArrivalFlashAt(end+plan.cycle,6,root,plan.cycle)).toBeCloseTo(1,10);
    expect(neuralArrivalFlashAt(end+2*plan.cycle,6,root,plan.cycle)).toBeCloseTo(1,10);
    expect(neuralArrivalFlashAt(end+plan.cycle*.5,6,root,plan.cycle,1)).toBeCloseTo(1,10);
    expect(neuralArrivalFlashAt(end,6,root,plan.cycle,1)).toBe(0);
    expect(neuralArrivalFlashAt(NaN,6,root,plan.cycle)).toBe(0);
    expect(neuralArrivalFlashAt(6,Infinity,root,plan.cycle)).toBe(0);
    expect(neuralArrivalFlashAt(6,6,{start:1,end:1},plan.cycle)).toBe(0);
  });
  it('restarts a fresh root wave late in the rewire, then maintains its clock across unmount',()=>{
    const route=byChild.get('middle-a')!;
    const duration=6,reconnectBegin=.8*duration;
    const absoluteLaunch=reconnectBegin+.12;
    const completion=absoluteLaunch-NEURAL_SIGNAL_LAUNCH_DELAY;
    expect(neuralPacketAt(reconnectBegin,completion,route,plan.cycle)).toBeNull();
    const inReconnect=neuralPacketAt(absoluteLaunch+.05,completion,route,plan.cycle);
    expect(inReconnect).not.toBeNull();
    const afterComplete=neuralPacketAt(duration+.1,completion,route,plan.cycle);
    const expected=neuralPacketAt(duration+.1,completion,route,plan.cycle);
    expect(afterComplete).toEqual(expected);
    const restartedWrongly=neuralPacketAt(duration+.1,duration,route,plan.cycle);
    expect(afterComplete).not.toEqual(restartedWrongly);
  });
});
