import {describe,expect,it} from 'vitest';
import {centerSnap,normalizeDegrees,resizeTextCorner,rotateTextAroundCenter,rotateTextToAngle} from './preview-text-transform';
describe('Canva-style text transforms',()=>{
 it('snaps only positions near the canvas center',()=>{
  expect(centerSnap({x:49.1,y:51.5})).toEqual({position:{x:50,y:50},snapX:true,snapY:true});
  expect(centerSnap({x:44,y:75})).toEqual({position:{x:44,y:75},snapX:false,snapY:false});
 });
 it('scales corner handles proportionally while holding opposite corner fixed',()=>{
  const initial={handle:{x:100,y:100},opposite:{x:0,y:0},origin:{x:50,y:50},fontSize:100,
   canvas:{width:200,height:200}};
  const enlarged=resizeTextCorner(initial,{x:150,y:150});
  expect(enlarged).toEqual({fontSize:150,x:37.5,y:37.5});
  const reduced=resizeTextCorner(initial,{x:50,y:50});
  expect(reduced).toEqual({fontSize:50,x:12.5,y:12.5});
  expect(resizeTextCorner(initial,{x:-200,y:-200}).fontSize).toBe(12);
  expect(resizeTextCorner(initial,{x:600,y:600}).fontSize).toBe(250);
 });
 it('rotates about the visible center rather than shifting an off-center text box',()=>{
  const rotated=rotateTextAroundCenter({
   origin:{x:80,y:100},center:{x:100,y:100},startRotation:0,
   startPointer:{x:140,y:100},pointer:{x:100,y:140},canvas:{width:200,height:200}
  });
  expect(rotated).toEqual({rotation:90,x:50,y:40});
  expect(rotateTextAroundCenter({
   origin:{x:100,y:100},center:{x:100,y:100},startRotation:0,
   startPointer:{x:140,y:100},pointer:{x:128,y:128},canvas:{width:200,height:200}
  }).rotation).toBe(45);
 });
 it('normalizes full rotations and supports a stationary hold angle',()=>{
  expect(normalizeDegrees(190)).toBe(-170);
  expect(normalizeDegrees(-190)).toBe(170);
  expect(rotateTextToAngle({origin:{x:100,y:100},center:{x:100,y:100},
   startRotation:175,degrees:190,canvas:{width:200,height:200}}).rotation).toBe(-170);
 });
});
