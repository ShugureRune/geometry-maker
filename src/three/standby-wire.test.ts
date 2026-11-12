import {describe,expect,it} from 'vitest';
import {generateThreeComposition,threePose,type ThreeObject} from './model';
import {entranceDefaults,neuralWireEndpoints} from './entrance';
import {threeDefaults} from './settings';
import {matchThreeObjects,morphPose,splitExitEnter,standbyMeshVisibility,standbyObjectPose,standbyMorphMotionProgress,standbyMorphWireProgress,MORPH_WIRE_RELEASE_END,MORPH_WIRE_ATTACH_START,type ThreeStandbyTransition} from './standby';
import {standbyWirePose} from './standby-wire';
import {networkConnections,rootedWireSteps} from './network';
import {threeVisibility,visibilityDefaults} from './visibility';

const from=generateThreeComposition('wire-old','16:9');
const to=generateThreeComposition('wire-new','16:9');
const settings={...threeDefaults,entrance:{...entranceDefaults,enabled:true}};
const transition:ThreeStandbyTransition={
  id:1,mode:'morph',duration:4,fromSeed:'wire-old',fromComposition:from,
  fromSourceComposition:from,
  fromBackground:{mode:'solid',solid:'#161626',colors:['#161626','#161626','#161626'],angle:0},
  fromTheme:'standard',fromTime:8.5,cameraPosition:[0,0,2]
};

describe('detached neural wiring during automatic seed morph',()=>{
  it('retracts ALL old wires before any figure moves and reconnects only after movement',()=>{
    for(const seconds of [0,.25,1,2,4]){
      const old=standbyMorphWireProgress(seconds,4,'old');
      const newest=standbyMorphWireProgress(seconds,4,'new');
      expect(old).toBeGreaterThanOrEqual(0);
      expect(newest).toBeGreaterThanOrEqual(0);
      expect(Math.min(old,newest)).toBe(0); // no crossing or dragging wires
    }
    expect(standbyMorphWireProgress(0,4,'old')).toBe(1);
    expect(standbyMorphWireProgress(0,4,'new')).toBe(0);
    expect(standbyMorphWireProgress(4*MORPH_WIRE_RELEASE_END,4,'old')).toBe(0);
    expect(standbyMorphWireProgress(4*MORPH_WIRE_ATTACH_START,4,'new')).toBe(0);
    expect(standbyMorphWireProgress(4,4,'new')).toBe(1);
    for(const t of [.2,.3,.5,.75,.8]){
      expect(standbyMorphWireProgress(t*4,4,'old')).toBe(0);
      expect(standbyMorphWireProgress(t*4,4,'new')).toBe(0);
    }
  });
  it('keeps floating/spinning alive while the base constellation waits for wires',()=>{
    const old={...from.objects[0],phase:0,floatRate:1.1,
      spin:[.12,.15,-.08] as [number,number,number]};
    const next={...to.objects[0],kind:old.kind,phase:.4,floatRate:.8,
      spin:[-.08,.11,.07] as [number,number,number]};
    const pair={id:'floating-pair',from:old,to:next};
    const active={...settings,floatAmount:1.5,rotationAmount:1.8};
    const at=(time:number)=>standbyObjectPose(old,next,time,transition,'shared',
      active.floatAmount,active.rotationAmount,active.entrance,'wire-new',true);
    // While cables retract, morph progress stays zero, but the old shape
    // bobbing and spinning must follow its actual advancing elapsed time.
    for(const time of [0,.1,.35,.7]){
      const pose=at(time);
      const live=threePose(old,transition.fromTime+time,
        active.floatAmount,active.rotationAmount);
      expect(pose.position).toEqual(live.position);
      expect(pose.rotation).toEqual(live.rotation);
      expect(pose.radius).toBe(old.radius);
      const wire=standbyWirePose(old,'old',pair,transition,time,active,'wire-new');
      expect(wire.position).toEqual(pose.position);
    }
    expect(at(.35).position).not.toEqual(at(0).position);
    expect(at(.35).rotation).not.toEqual(at(0).rotation);
    // At the other side of the morph, the incoming node ALSO keeps bobbing
    // while cables reconnect (and reaches normal playback with no jump).
    for(const time of [3.2,3.45,3.8,4]){
      const pose=at(time);
      const live=threePose(next,time,active.floatAmount,active.rotationAmount);
      expect(pose.position).toEqual(live.position);
      expect(pose.rotation).toEqual(live.rotation);
      expect(pose.radius).toBe(next.radius);
      const wire=standbyWirePose(next,'new',pair,transition,time,active,'wire-new');
      expect(wire.position).toEqual(pose.position);
    }
    expect(at(3.45).position).not.toEqual(at(3.8).position);
    expect(at(3.45).rotation).not.toEqual(at(3.8).rotation);
    // Network-free mode still retains its uninterrupted morph motion.
    expect(standbyMorphMotionProgress(.5,4,false)).toBeCloseTo(.125);
  });
});

describe('live moving endpoints while neural cables grow or retract',()=>{
  it('keeps the wire tip anchored to the actual floating source at every stage',()=>{
    const old={...from.objects[0],role:'primary' as const,phase:.15,floatRate:.9};
    const child={...from.objects[1],role:'support' as const,phase:.8,floatRate:1.05};
    const active={...settings,floatAmount:1.6,rotationAmount:1};
    for(const layer of ['old','new'] as const){
      for(const elapsed of layer==='old'?[0,.12,.36,.65]:[3.25,3.5,3.8,4]){
        const pa=standbyWirePose(old,layer,undefined,transition,elapsed,active,'wire-new');
        const pb=standbyWirePose(child,layer,undefined,transition,elapsed,active,'wire-new');
        const phase=standbyMorphWireProgress(elapsed,4,layer,0,1,{start:0,end:1});
        const tip=neuralWireEndpoints(old,child,pa.position,pb.position,phase,'a');
        expect(tip.start).toEqual(pa.position);
        expect(tip.end).toEqual(pa.position.map((v,i)=>
          v+(pb.position[i]-v)*phase));
      }
    }
  });
  it('respects float amount zero, and never snaps when morph movement begins or ends',()=>{
    const prior={...from.objects[0],phase:0,floatRate:1};
    const next={...to.objects[0],kind:prior.kind,phase:.5,floatRate:1.2};
    const at=(time:number,amount:number)=>standbyObjectPose(prior,next,time,transition,
      'shared',amount,1,entranceDefaults,'wire-new',true);
    for(const time of [0,.12,.5,3.2,3.5,4]){
      const stillPose=at(time,0);
      const moving=at(time,1);
      // Only the float offset changes: radius/color/morph staging is intact.
      expect(stillPose.radius).toBe(moving.radius);
      expect(stillPose.colorMix).toBe(moving.colorMix);
      expect(stillPose.rotation).toEqual(moving.rotation);
    }
    for(const boundary of [4*MORPH_WIRE_RELEASE_END,4*MORPH_WIRE_ATTACH_START]){
      const before=at(boundary-1e-4,1).position;
      const after=at(boundary+1e-4,1).position;
      expect(Math.hypot(...before.map((v,i)=>v-after[i]))).toBeLessThan(.003);
    }
    expect(at(0,1).position).toEqual(threePose(prior,transition.fromTime,1,1).position);
    expect(at(4,1).position).toEqual(threePose(next,4,1,1).position);
    expect(at(.4,0).position).toEqual(prior.position);
    expect(at(3.6,0).position).toEqual(next.position);
  });
});

describe('both standby wiring directions originate at the hero',()=>{
  it('retracts from distant child cables to the primary in exact reverse growth order',()=>{
    const parent={start:0,end:.4};
    const child={start:.4,end:1};
    for(const duration of [1,2,4,8]){
      for(const part of [0,.1,.25,.5,.75,1]){
        const removingTime=duration*MORPH_WIRE_RELEASE_END*part;
        // Release at 1 - part is the same frame as attachment at part.
        const mirroredJoiningTime=duration*(MORPH_WIRE_ATTACH_START+
          (1-MORPH_WIRE_ATTACH_START)*(1-part));
        for(const route of [parent,child]){
          const oldVisible=standbyMorphWireProgress(removingTime,duration,'old',0,1,route);
          const newVisible=standbyMorphWireProgress(mirroredJoiningTime,duration,'new',0,1,route);
          expect(oldVisible).toBeCloseTo(newVisible,10);
          expect(oldVisible).toBeGreaterThanOrEqual(0);
          expect(oldVisible).toBeLessThanOrEqual(1);
        }
      }
      const during=duration*.04;
      // Child is being recalled first, while the parent cable stays attached.
      expect(standbyMorphWireProgress(during,duration,'old',0,1,parent)).toBe(1);
      expect(standbyMorphWireProgress(during,duration,'old',1,2,child)).toBeLessThan(1);
      const midway=duration*.09;
      expect(standbyMorphWireProgress(midway,duration,'old',0,1,parent)).toBe(1);
      expect(standbyMorphWireProgress(midway,duration,'old',0,1,child)).toBeGreaterThan(0);
      expect(standbyMorphWireProgress(midway,duration,'old',0,1,child)).toBeLessThan(1);
      const nearEnd=duration*.15;
      expect(standbyMorphWireProgress(nearEnd,duration,'old',0,1,parent)).toBeLessThan(1);
      expect(standbyMorphWireProgress(nearEnd,duration,'old',0,1,child)).toBe(0);
      const reconnecting=duration*.85;
      expect(standbyMorphWireProgress(reconnecting,duration,'new',0,1,parent)).toBeGreaterThan(0);
      expect(standbyMorphWireProgress(reconnecting,duration,'new',1,2,child)).toBe(0);
    }
  });
  it('never leaves a detached child tail when a parent cable starts shrinking',()=>{
    const parent={start:0,end:.4},child={start:.4,end:1};
    for(const duration of [1,2,4,8]){
      let lastParent=1,lastChild=1;
      for(let i=0;i<=120;i++){
        const seconds=duration*MORPH_WIRE_RELEASE_END*i/120;
        const parentLength=standbyMorphWireProgress(seconds,duration,'old',0,2,parent);
        const childLength=standbyMorphWireProgress(seconds,duration,'old',1,2,child);
        expect(parentLength).toBeLessThanOrEqual(lastParent+1e-10);
        expect(childLength).toBeLessThanOrEqual(lastChild+1e-10);
        // A shrinking parent must never leave a full, dangling child.
        if(parentLength<1-1e-8)expect(childLength).toBe(0);
        if(childLength>1e-8)expect(parentLength).toBe(1);
        lastParent=parentLength;lastChild=childLength;
      }
    }
  });
  it('hides every cable throughout the move phase without changing total transition time',()=>{
    for(const duration of [1,2,4,8]){
      for(const p of [MORPH_WIRE_RELEASE_END,.3,.5,.75,MORPH_WIRE_ATTACH_START]){
        for(const rank of [0,3,9]){
          const window={start:rank/10,end:(rank+1)/10};
          expect(standbyMorphWireProgress(duration*p,duration,'old',rank,10,window)).toBe(0);
          expect(standbyMorphWireProgress(duration*p,duration,'new',rank,10,window)).toBe(0);
        }
      }
      expect(standbyMorphWireProgress(0,duration,'old',0,1,{start:0,end:1})).toBe(1);
      expect(standbyMorphWireProgress(duration,duration,'new',0,1,{start:0,end:1})).toBe(1);
    }
  });
});

describe('simultaneous hero-tree exit and entrance in standby',()=>{
  it('both roots reconnect together and both roots retract last',()=>{
    const base=from.objects[0];
    const node=(id:string,role:'primary'|'support'|'accent',x:number)=>({
      ...base,id,role,position:[x,0,0] as [number,number,number],
    });
    const objects=[
      node('hero-a','primary',0),node('medium-a','support',2),
      node('small-a','accent',3),node('hero-b','primary',20),
      node('medium-b','support',23),node('small-b','accent',25),
    ];
    const edges=networkConnections(objects,1,1,'neural');
    const routes=rootedWireSteps(objects,edges);
    const byChild=new Map(edges.map((edge,i)=>[edge.b,routes[i]]));
    const parentA=byChild.get('medium-a')!,parentB=byChild.get('medium-b')!;
    const childA=byChild.get('small-a')!,childB=byChild.get('small-b')!;
    for(const duration of [1,2,4,8]){
      const begin=duration*MORPH_WIRE_ATTACH_START;
      expect(standbyMorphWireProgress(begin,duration,'new',0,1,parentA)).toBe(0);
      expect(standbyMorphWireProgress(begin,duration,'new',0,1,parentB)).toBe(0);
      const justStarted=begin+duration*(1-MORPH_WIRE_ATTACH_START)*.1;
      expect(standbyMorphWireProgress(justStarted,duration,'new',0,1,parentA)).toBeGreaterThan(0);
      expect(standbyMorphWireProgress(justStarted,duration,'new',0,1,parentB)).toBeGreaterThan(0);
      expect(standbyMorphWireProgress(justStarted,duration,'new',0,1,childA)).toBe(0);
      expect(standbyMorphWireProgress(justStarted,duration,'new',0,1,childB)).toBe(0);
      // At the beginning of the old-scene release, distant child wires
      // disappear in each tree before either hero-connected parent retracts.
      const started=duration*MORPH_WIRE_RELEASE_END*.1;
      expect(standbyMorphWireProgress(started,duration,'old',0,1,parentA)).toBe(1);
      expect(standbyMorphWireProgress(started,duration,'old',0,1,parentB)).toBe(1);
      expect(standbyMorphWireProgress(started,duration,'old',0,1,childB)).toBeLessThan(1);
      for(let step=0;step<=80;step++){
        const elapsed=duration*MORPH_WIRE_RELEASE_END*step/80;
        for(const [parent,child] of [[parentA,childA],[parentB,childB]]){
          const p=standbyMorphWireProgress(elapsed,duration,'old',0,1,parent);
          const c=standbyMorphWireProgress(elapsed,duration,'old',0,1,child);
          if(p<1-1e-8)expect(c).toBe(0);
        }
      }
    }
  });
});

describe('3D standby wire endpoint synchronization',()=>{
  it('tracks the exact same camera-safe morph path as solid objects in both layers',()=>{
    const pairs=matchThreeObjects(from.objects.slice(0,8),to.objects.slice(0,9));
    for(const match of pairs){
      if(!match.from||!match.to)continue;
      for(const t of [0,.25,.5,.75,1]){
        const time=t*transition.duration;
        const oldPose=threePose(match.from,transition.fromTime+time,settings.floatAmount,settings.rotationAmount);
        const newPose=threePose(match.to,time,settings.floatAmount,settings.rotationAmount);
        const variant=match.from.kind===match.to.kind?'shared':'old';
        const expected=morphPose(match.from,match.to,standbyMorphMotionProgress(time,transition.duration),variant,oldPose,newPose,transition.cameraPosition).position;
        const oldWire=standbyWirePose(match.from,'old',match,transition,time,settings,'wire-new');
        const newWire=standbyWirePose(match.to,'new',match,transition,time,settings,'wire-new');
        expect(oldWire.position).toEqual(expected);
        expect(newWire.position).toEqual(expected);
        expect(oldWire.position.every(Number.isFinite)).toBe(true);
      }
    }
  });
  it('does not jump to new-seed wire positions before a morph even starts',()=>{
    const pair=matchThreeObjects(from.objects,to.objects).find(m=>m.from&&m.to)!;
    const first=standbyWirePose(pair.from!,'old',pair,transition,0,settings,'wire-new');
    const second=standbyWirePose(pair.to!,'new',pair,transition,0,settings,'wire-new');
    const expected=threePose(pair.from!,transition.fromTime,settings.floatAmount,settings.rotationAmount).position;
    expect(first.position).toEqual(expected);
    expect(second.position).toEqual(expected);
    const done=standbyWirePose(pair.to!,'new',pair,transition,transition.duration,settings,'wire-new');
    expect(done.position).toEqual(threePose(pair.to!,transition.duration,settings.floatAmount,settings.rotationAmount).position);
  });
  it('shrinks unmatched wires together with surplus objects and grows new connections later',()=>{
    const pairs=matchThreeObjects(from.objects.slice(0,5),to.objects.slice(0,8));
    const extra=pairs.find(m=>m.to&&!m.from)!;
    expect(extra).toBeTruthy();
    expect(standbyWirePose(extra.to!,'new',extra,transition,0,settings,'wire-new').opacity).toBe(0);
    expect(standbyWirePose(extra.to!,'new',extra,transition,transition.duration,settings,'wire-new').opacity).toBe(1);
    const removed=matchThreeObjects(from.objects.slice(0,7),to.objects.slice(0,3)).find(m=>m.from&&!m.to)!;
    expect(standbyWirePose(removed.from!,'old',removed,transition,0,settings,'wire-new').opacity).toBe(1);
    expect(standbyWirePose(removed.from!,'old',removed,transition,transition.duration,settings,'wire-new').opacity).toBe(0);
  });

  it('uses the visible shared mesh phase, never the invisible old seed phase, for both wire layers',()=>{
    const older={...from.objects[0],role:'support' as const,phase:Math.PI*2*.2};
    const newer={...to.objects[0],kind:older.kind,role:'support' as const,
      phase:Math.PI*2*.3};
    const pair={id:'linked-shared',from:older,to:newer};
    const visibility={...visibilityDefaults,enabled:true,keepPrimaryVisible:false,
      stagger:true};
    const combined={...settings,visibilityAnimation:visibility};
    const t=1;
    // Old visibility is zero, yet the shared mesh is drawn with the NEW
    // object's visibility. Both old/new wires must follow that SAME mesh.
    expect(threeVisibility(older,transition.fromTime+t,visibility)).toBe(0);
    expect(threeVisibility(newer,t,visibility)).toBe(1);
    const oldWire=standbyWirePose(older,'old',pair,transition,t,combined,'wire-new');
    const newWire=standbyWirePose(newer,'new',pair,transition,t,combined,'wire-new');
    // Shared meshes fade in smoothly from the old (hidden) visibility
    // instead of popping fully visible at the first seed-switch frame.
    expect(oldWire.opacity).toBeGreaterThan(0);
    expect(oldWire.opacity).toBeLessThan(.3);
    expect(newWire.opacity).toBeCloseTo(oldWire.opacity);
    expect(oldWire.position).toEqual(newWire.position);
    // When the actual shared mesh vanishes, both wire layers vanish too.
    const hiddenNew={...newer,phase:0};
    const hiddenPair={...pair,to:hiddenNew};
    const wire=standbyWirePose(older,'old',hiddenPair,transition,0,combined,'wire-new');
    expect(wire.opacity).toBe(0);
  });
  it('begins from the old appearance and ends at the new appearance without a one-frame pop',()=>{
    const previous={...from.objects[0],role:'support' as const,phase:Math.PI*2*.2};
    const target={...to.objects[0],role:'support' as const,phase:Math.PI*2*.3};
    const appearance={...visibilityDefaults,enabled:true,keepPrimaryVisible:false};
    expect(threeVisibility(previous,transition.fromTime,appearance)).toBe(0);
    expect(threeVisibility(target,0,appearance)).toBe(1);
    const phase=(time:number)=>standbyMeshVisibility(previous,target,'shared',time,transition,appearance);
    expect(phase(0)).toBe(0);
    expect(phase(.001)).toBeLessThan(.01);
    expect(phase(.1)).toBeLessThan(.05);
    expect(phase(transition.duration)).toBeCloseTo(
      threeVisibility(target,transition.duration,appearance),10);
    for(let t=0;t<transition.duration;t+=.01){
      // A renderer running at 60fps must never reveal a figure all at once
      // just because the new seed's staggered loop starts at a different phase.
      expect(Math.abs(phase(t+.01)-phase(t))).toBeLessThan(.08);
    }
  });
  it('hides transition wires whenever the exact old/new drawn mesh is invisible',()=>{
    const older={...from.objects[0],role:'support' as const,phase:Math.PI*2*.2};
    const newer:ThreeObject={...to.objects[0],role:'support',
      kind:older.kind==='sphere'?'cube':'sphere',phase:Math.PI*2*.3};
    const pair={id:'cross-geometry',from:older,to:newer};
    const combined={...settings,visibilityAnimation:{
      ...visibilityDefaults,enabled:true,keepPrimaryVisible:false,
    }};
    const t=1;
    expect(threeVisibility(older,transition.fromTime+t,combined.visibilityAnimation)).toBe(0);
    expect(standbyWirePose(older,'old',pair,transition,t,combined,'wire-new').opacity).toBe(0);
    // At 25% of a staged morph the new mesh is not fully faded in yet:
    // a disconnected network must not force it to appear prematurely.
    expect(standbyWirePose(newer,'new',pair,transition,t,combined,'wire-new').opacity).toBe(0);
  });
  it('matches reverse exit / new entrance without leading the solids',()=>{
    const exit={...transition,mode:'exit-enter' as const};
    const oldObject=from.objects[0],newObject=to.objects[0];
    for(const time of [0,1,2,3,4]){
      const old=standbyWirePose(oldObject,'old',undefined,exit,time,settings,'wire-new');
      const newest=standbyWirePose(newObject,'new',undefined,exit,time,settings,'wire-new');
      expect(old.position.every(Number.isFinite)).toBe(true);
      expect(newest.position.every(Number.isFinite)).toBe(true);
      if(time===0){expect(old.opacity).toBe(1);expect(newest.opacity).toBe(0);}
      if(time===4){expect(old.opacity).toBe(0);expect(newest.opacity).toBe(1);}
    }
    expect(splitExitEnter(2,4)).toEqual({exit:1,enter:0});
  });
});
