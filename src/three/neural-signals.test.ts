import {describe,it,expect} from 'vitest';
import {generateThreeComposition} from './model';
import {networkConnections} from './network';
import {neuralStartupFlash,neuralPacketAt,neuralSignalPlan,
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
      expect(neuralPacketAt(sample+plan.cycle,6,route,plan.cycle)).toEqual(
        neuralPacketAt(sample,6,route,plan.cycle));
      expect(neuralPacketAt(sample+2*plan.cycle,6,route,plan.cycle)).toEqual(
        neuralPacketAt(sample,6,route,plan.cycle));
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
