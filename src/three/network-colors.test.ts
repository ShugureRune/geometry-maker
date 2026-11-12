import {describe,it,expect} from 'vitest';
import {Color} from 'three';
import type {Background} from '../scene';
import {networkEndpointColor,networkReceiverColor,neuralWireColorAt} from './network-colors';
import {networkDefaults} from './style-settings';

const background:Background={
  mode:'solid',solid:'#131624',
  colors:['#131624','#131624','#131624'],angle:0,
  figureColors:{primary:'#b450f1',support:'#10d69c',accent:'#ef8c34'},
};
const roles=['primary','support','accent'] as const;

describe('neural signal color always matches the network wire underneath',()=>{
  it('uses the exact same endpoint RGB values as the wire for every color mode and glow setting',()=>{
    for(const low of [true,false]){
      for(const colorMode of ['auto','primary','support','accent','custom'] as const){
        for(const contrast of [false,true]){
          for(const glow of [0,100,200]){
            const settings={...networkDefaults,colorMode,contrast,glow,
              customColor:'#bb45e8'};
            for(const role of roles){
              const source=networkEndpointColor(role,settings,background,low);
              const halfway=neuralWireColorAt(source,source,.5,new Color());
              expect(halfway.equals(source)).toBe(true);
              expect(source.r).toBeGreaterThanOrEqual(0);
              expect(source.g).toBeGreaterThanOrEqual(0);
              expect(source.b).toBeGreaterThanOrEqual(0);
            }
          }
        }
      }
    }
  });

  it('changes the head AND trail tint continuously along the wire, using linear RGB interpolation',()=>{
    const settings={...networkDefaults,colorMode:'auto' as const,glow:100};
    const hero=networkEndpointColor('primary',settings,background,false);
    const medium=networkEndpointColor('support',settings,background,false);
    const buffer=new Color();
    expect(hero.equals(medium)).toBe(false);
    expect(neuralWireColorAt(hero,medium,0,buffer).equals(hero)).toBe(true);
    const q1=neuralWireColorAt(hero,medium,.25,buffer).clone();
    const q2=neuralWireColorAt(hero,medium,.75,buffer).clone();
    expect(q1.equals(hero)).toBe(false);
    expect(q2.equals(medium)).toBe(false);
    expect(q1.equals(q2)).toBe(false);
    const half=neuralWireColorAt(hero,medium,.5,buffer);
    for(const channel of ['r','g','b'] as const)
      expect(half[channel]).toBeCloseTo((hero[channel]+medium[channel])*.5,12);
    expect(neuralWireColorAt(hero,medium,1,buffer).equals(medium)).toBe(true);
    // If a route is stored in reverse order, its source/target are swapped,
    // but the sampled signal still follows the same vertex-color gradient.
    const reverseQuarter=neuralWireColorAt(medium,hero,.25,buffer);
    for(const channel of ['r','g','b'] as const)
      expect(reverseQuarter[channel]).toBeCloseTo(q2[channel],12);
    expect(neuralWireColorAt(hero,medium,-1,buffer).equals(hero)).toBe(true);
    expect(neuralWireColorAt(hero,medium,2,buffer).equals(medium)).toBe(true);
  });

  it('arrival flashes use the actual RECEIVING SOLID, not source tint, custom wire color or HDR glow',()=>{
    for(const role of roles){
      const receiver=networkReceiverColor(role,background);
      expect(receiver.equals(new Color(background.figureColors![role]))).toBe(true);
      expect(receiver.getHexString()).toBe(background.figureColors![role]!.slice(1));
    }
    for(const mode of ['auto','custom','primary'] as const){
      const network={...networkDefaults,colorMode:mode,customColor:'#ffffff',
        glow:200,contrast:true};
      const wireColor=networkEndpointColor('primary',network,background,false);
      const incoming=networkReceiverColor('support',background);
      expect(incoming.equals(new Color('#10d69c'))).toBe(true);
      expect(incoming.equals(wireColor)).toBe(false);
    }
  });

  it('uses the new seed figure palette for receiver flashes after switching compositions',()=>{
    const next={...background,figureColors:{
      primary:'#4fd2fc',support:'#f2794c',accent:'#b2f555',
    }} satisfies Background;
    const oldReceiver=networkReceiverColor('support',background);
    const newReceiver=networkReceiverColor('support',next);
    expect(oldReceiver.equals(newReceiver)).toBe(false);
    expect(newReceiver.equals(new Color('#f2794c'))).toBe(true);
    const fallback={...background,figureColors:undefined} satisfies Background;
    expect(networkReceiverColor('support',fallback).equals(new Color('#76cfe8'))).toBe(true);
  });
});
