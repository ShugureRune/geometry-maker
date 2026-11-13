import {useFrame,useThree} from '@react-three/fiber';
import {useEffect,useRef,type RefObject} from 'react';
import {Euler,Vector3} from 'three';
import type {ThreeView} from './settings';

type Point={x:number;y:number};
type Gesture={center:Point;distance:number};
const clamp=(value:number,min:number,max:number)=>Math.min(max,Math.max(min,value));

/** One unified first-person camera: rotate in place with one pointer, translate
 * with two pointers, and travel along the viewing ray with pinch/wheel.
 * The saved target is only a direction marker, never an orbit pivot. */
export function ExploreController({speed,view,onNavigate}:{
  speed:number;view:RefObject<ThreeView|undefined>;
  onNavigate:(forwardTarget:Vector3)=>void;
}){
  const {camera,gl,invalidate}=useThree();
  const keys=useRef(new Set<string>());
  const look=useRef({yaw:0,pitch:0});
  const direction=useRef(new Vector3());
  const right=useRef(new Vector3());
  const up=useRef(new Vector3());

  useEffect(()=>{
    const canvas=gl.domElement;
    const pointers=new Map<number,Point>();
    let previousGesture:Gesture|null=null;
    let mousePan=false;
    const updateAngles=()=>{
      const euler=new Euler().setFromQuaternion(camera.quaternion,'YXZ');
      look.current={yaw:euler.y,pitch:euler.x};
    };
    const commit=()=>{
      camera.updateMatrixWorld();
      const target=new Vector3(0,0,-1).applyQuaternion(camera.quaternion).multiplyScalar(12).add(camera.position);
      onNavigate(target);
      view.current={position:camera.position.toArray(),target:target.toArray()};
      invalidate();
    };
    const moveCamera=(dx:number,dy:number,forward:number)=>{
      const factor=speed/8;
      right.current.set(1,0,0).applyQuaternion(camera.quaternion);
      up.current.set(0,1,0).applyQuaternion(camera.quaternion);
      direction.current.set(0,0,-1).applyQuaternion(camera.quaternion);
      // The camera travels in the swipe direction, without orbiting a pivot.
      camera.position.addScaledVector(right.current,dx*.014*factor);
      camera.position.addScaledVector(up.current,-dy*.014*factor);
      camera.position.addScaledVector(direction.current,forward*.04*factor);
      camera.position.x=clamp(camera.position.x,-850,850);
      camera.position.y=clamp(camera.position.y,-40,450);
      camera.position.z=clamp(camera.position.z,-850,850);
      commit();
    };
    const readGesture=():Gesture|null=>{
      if(pointers.size<2)return null;
      const [a,b]=[...pointers.values()];
      return {center:{x:(a.x+b.x)/2,y:(a.y+b.y)/2},distance:Math.hypot(a.x-b.x,a.y-b.y)};
    };
    const pointerDown=(event:PointerEvent)=>{
      if(event.pointerType==='mouse'&&event.button!==0&&event.button!==2)return;
      event.preventDefault();
      if(pointers.size===0)updateAngles();
      pointers.set(event.pointerId,{x:event.clientX,y:event.clientY});
      if(event.pointerType==='mouse')mousePan=event.button===2;
      previousGesture=readGesture();
      canvas.setPointerCapture(event.pointerId);
    };
    const pointerMove=(event:PointerEvent)=>{
      const before=pointers.get(event.pointerId);
      if(!before)return;
      const after={x:event.clientX,y:event.clientY};
      pointers.set(event.pointerId,after);
      if(pointers.size>=2){
        const current=readGesture()!;
        if(previousGesture){
          moveCamera(current.center.x-previousGesture.center.x,
            current.center.y-previousGesture.center.y,current.distance-previousGesture.distance);
        }
        previousGesture=current;
        return;
      }
      const dx=after.x-before.x,dy=after.y-before.y;
      if(mousePan){moveCamera(dx,dy,0);return;}
      look.current.yaw-=dx*.0035;
      look.current.pitch=clamp(look.current.pitch-dy*.0035,-1.48,1.48);
      camera.rotation.set(look.current.pitch,look.current.yaw,0,'YXZ');
      commit();
    };
    const pointerUp=(event:PointerEvent)=>{
      pointers.delete(event.pointerId);
      if(canvas.hasPointerCapture(event.pointerId))canvas.releasePointerCapture(event.pointerId);
      previousGesture=readGesture();
      if(pointers.size===1)updateAngles();
    };
    const wheel=(event:WheelEvent)=>{
      event.preventDefault();
      const dy=event.deltaY*(event.deltaMode===1?16:event.deltaMode===2?canvas.clientHeight:1);
      // Large wheel gestures should genuinely travel into a distant scene.
      // Cap only the single-event jump to avoid leaping straight past it.
      const desired=-dy*.07*(speed/8);
      const maxStep=Math.max(6,camera.position.length()*.9);
      const step=clamp(desired,-maxStep,maxStep);
      moveCamera(0,0,step/(.04*(speed/8)));
    };
    const down=(event:KeyboardEvent)=>{
      const target=event.target as HTMLElement|null;
      if(target&&(['INPUT','TEXTAREA','SELECT'].includes(target.tagName)||target.isContentEditable))return;
      const key=event.key.toLowerCase();
      if(['w','a','s','d',' ','shift','arrowup','arrowdown','arrowleft','arrowright'].includes(key)){
        event.preventDefault();
        keys.current.add(key);
        invalidate();
      }
    };
    const upKey=(event:KeyboardEvent)=>keys.current.delete(event.key.toLowerCase());
    const clear=()=>{keys.current.clear();pointers.clear();previousGesture=null;};
    const contextMenu=(event:MouseEvent)=>event.preventDefault();
    canvas.addEventListener('pointerdown',pointerDown);
    canvas.addEventListener('pointermove',pointerMove);
    canvas.addEventListener('pointerup',pointerUp);
    canvas.addEventListener('pointercancel',pointerUp);
    canvas.addEventListener('lostpointercapture',pointerUp);
    canvas.addEventListener('wheel',wheel,{passive:false});
    canvas.addEventListener('contextmenu',contextMenu);
    document.addEventListener('keydown',down);
    document.addEventListener('keyup',upKey);
    window.addEventListener('blur',clear);
    canvas.tabIndex=0;
    canvas.setAttribute('aria-label','3D視点操作：1本指で向きを変更、2本指スワイプで平行移動、ピンチで前進・後退');
    return ()=>{
      clear();
      canvas.removeEventListener('pointerdown',pointerDown);
      canvas.removeEventListener('pointermove',pointerMove);
      canvas.removeEventListener('pointerup',pointerUp);
      canvas.removeEventListener('pointercancel',pointerUp);
      canvas.removeEventListener('lostpointercapture',pointerUp);
      canvas.removeEventListener('wheel',wheel);
      canvas.removeEventListener('contextmenu',contextMenu);
      document.removeEventListener('keydown',down);
      document.removeEventListener('keyup',upKey);
      window.removeEventListener('blur',clear);
    };
  },[camera,gl,invalidate,onNavigate,speed,view]);

  useFrame((_,delta)=>{
    if(document.hidden||keys.current.size===0)return;
    const pressed=(key:string)=>keys.current.has(key);
    const forward=(pressed('w')||pressed('arrowup')?1:0)-(pressed('s')||pressed('arrowdown')?1:0);
    const strafe=(pressed('d')||pressed('arrowright')?1:0)-(pressed('a')||pressed('arrowleft')?1:0);
    const vertical=(pressed(' ')?1:0)-(pressed('shift')?1:0);
    const movement=new Vector3(0,0,-1).applyQuaternion(camera.quaternion).multiplyScalar(forward)
      .addScaledVector(new Vector3(1,0,0).applyQuaternion(camera.quaternion),strafe);
    movement.y+=vertical;
    if(movement.lengthSq()===0)return;
    movement.normalize().multiplyScalar(Math.min(delta,.08)*speed*3);
    camera.position.add(movement);
    camera.position.x=clamp(camera.position.x,-850,850);
    camera.position.y=clamp(camera.position.y,-40,450);
    camera.position.z=clamp(camera.position.z,-850,850);
    const target=new Vector3(0,0,-12).applyQuaternion(camera.quaternion).add(camera.position);
    onNavigate(target);
    view.current={position:camera.position.toArray(),target:target.toArray()};
    invalidate();
  },-.5);
  return null;
}
