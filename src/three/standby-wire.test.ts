import {describe,expect,it} from 'vitest';
import {generateThreeComposition,threePose,type ThreeObject} from './model';
import {entranceDefaults} from './entrance';
import {threeDefaults} from './settings';
import {matchThreeObjects,morphPose,splitExitEnter,standbyMeshVisibility,standbyMorphMotionProgress,standbyMorphWireProgress,MORPH_WIRE_RELEASE_END,MORPH_WIRE_ATTACH_START,type ThreeStandbyTransition} from './standby';
import {standbyWirePose} from './standby-wire';
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
  it('holds both configurations steady while old cables shrink or new cables grow',()=>{
    const pair=matchThreeObjects(from.objects,to.objects).find(m=>m.from&&m.to)!;
    const a=standbyWirePose(pair.from!,'old',pair,transition,0,settings,'wire-new');
    const b=standbyWirePose(pair.from!,'old',pair,transition,.5,settings,'wire-new');
    expect(b.position).toEqual(a.position);
    const end=standbyWirePose(pair.to!,'new',pair,transition,4,settings,'wire-new');
    const reconnecting=standbyWirePose(pair.to!,'new',pair,transition,3.5,settings,'wire-new');
    expect(reconnecting.position).toEqual(end.position);
    const middle=standbyWirePose(pair.to!,'new',pair,transition,2,settings,'wire-new');
    expect(middle.position).not.toEqual(a.position);
    // Network-free modes still retain the existing uninterrupted morph motion.
    expect(standbyMorphMotionProgress(.5,4,false)).toBeCloseTo(.125);
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

describe('3D standby wire endpoint synchronization',()=>{
  it('tracks the exact same camera-safe morph path as solid objects in both layers',()=>{
    const pairs=matchThreeObjects(from.objects.slice(0,8),to.objects.slice(0,9));
    for(const match of pairs){
      if(!match.from||!match.to)continue;
      for(const t of [0,.25,.5,.75,1]){
        const time=t*transition.duration;
        const oldPose=threePose(match.from,transition.fromTime,settings.floatAmount,settings.rotationAmount);
        const newPose=threePose(match.to,transition.duration,settings.floatAmount,settings.rotationAmount);
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
