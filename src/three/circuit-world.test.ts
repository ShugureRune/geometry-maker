import {describe,expect,it} from 'vitest';
import {circuitPointAt,circuitRouteLength,circuitSignalAt,makeCircuitLayout} from './circuit-world';
import {floorGridDefaults,validateFloorGrid} from './floor-grid';

const pcb={...floorGridDefaults,enabled:true,style:'circuit' as const,circuitDensity:85,
  circuitWorldEnabled:true,circuitChipCount:12,circuitCoreScale:1};

describe('living 3D motherboard',()=>{
  it('constructs a deterministic central processor with four shared trunks',()=>{
    const a=makeCircuitLayout(pcb,false),b=makeCircuitLayout(pcb,false);
    expect(a).toEqual(b);
    expect(a.coreHalf).toBeGreaterThan(0);
    expect(a.chips).toHaveLength(12);
    expect(a.routes).toHaveLength(12);
    expect(a.tracks.filter(t=>t.kind==='trunk')).toHaveLength(4);
    expect(a.tracks.filter(t=>t.kind==='branch')).toHaveLength(24);
    for(const route of a.routes){
      expect(route.points).toHaveLength(4);
      expect(route.length).toBeCloseTo(circuitRouteLength(route.points));
      expect(route.length).toBeGreaterThan(3);
      const chip=a.chips.find(c=>c.id===route.chipId)!;
      const end=route.points.at(-1)!;
      expect(Math.hypot(end[0]-chip.position[0],end[1]-chip.position[1]))
        .toBeCloseTo(chip.size*.55);
      for(let i=1;i<route.points.length;i++){
        const prev=route.points[i-1],next=route.points[i];
        expect(prev[0]===next[0]||prev[1]===next[1]).toBe(true);
      }
    }
  });
  it('follows straight segments and 90-degree bends without jumping off a route',()=>{
    const route=makeCircuitLayout(pcb).routes[0];
    expect(circuitPointAt(route.points,0)).toEqual(route.points[0]);
    expect(circuitPointAt(route.points,route.length)).toEqual(route.points.at(-1));
    expect(circuitPointAt(route.points,route.length+100)).toEqual(route.points.at(-1));
    expect(circuitPointAt(route.points,0.5)).not.toEqual(route.points.at(-1));
    for(let i=0;i<40;i++){
      const point=circuitPointAt(route.points,route.length*i/39);
      expect(point.every(Number.isFinite)).toBe(true);
    }
  });
  it('moves signal packets and lights the correct chip only at arrival',()=>{
    const route=makeCircuitLayout(pcb).routes[0];
    const a=circuitSignalAt(route,0,2),b=circuitSignalAt(route,0.2,2);
    expect(a).toEqual(circuitSignalAt(route,0,2));
    expect(a.position).not.toEqual(b.position);
    expect(circuitSignalAt(route,2,0).visible).toBe(false);
    expect(circuitSignalAt(route,2,0).activation).toBe(0);
    const t=(route.length+0.5-route.offset)/(2*2.2);
    const arrived=circuitSignalAt(route,t,2);
    expect(arrived.visible).toBe(false);
    expect(arrived.activation).toBeGreaterThan(0);
    expect(arrived.position).toEqual(route.points.at(-1));
  });
  it('reduces chip count for low quality and allows hiding near-world hardware',()=>{
    expect(makeCircuitLayout({...pcb,circuitChipCount:24},false).chips.length).toBe(20);
    expect(makeCircuitLayout({...pcb,circuitChipCount:24},true).chips.length).toBe(8);
    expect(makeCircuitLayout({...pcb,circuitWorldEnabled:false}).chips).toHaveLength(0);
    expect(makeCircuitLayout({...pcb,circuitDensity:0}).routes).toHaveLength(0);
    expect(makeCircuitLayout({...pcb,style:'grid'}).coreHalf).toBe(0);
    expect(makeCircuitLayout({...pcb,enabled:false}).coreHalf).toBe(0);
  });
  it('saves new options with the old grid JSON defaults preserved',()=>{
    expect(validateFloorGrid(pcb)).toEqual(pcb);
    const {circuitWorldEnabled:_,circuitChipCount:__,circuitCoreScale:___,...legacy}=pcb;
    expect(validateFloorGrid(legacy)).toMatchObject({
      circuitWorldEnabled:true,circuitChipCount:12,circuitCoreScale:1,
    });
    for(const bad of [{circuitChipCount:-1},{circuitChipCount:25},
      {circuitChipCount:5.5},{circuitChipCount:'12'},{circuitChipCount:null},
      {circuitCoreScale:.49},{circuitCoreScale:2.01},{circuitCoreScale:NaN},
      {circuitWorldEnabled:null},{circuitWorldEnabled:'yes'}]){
      expect(()=>validateFloorGrid({...pcb,...bad})).toThrow();
    }
  });
});
