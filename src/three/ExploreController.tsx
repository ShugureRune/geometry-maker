import {useFrame,useThree} from '@react-three/fiber';
import {useEffect,useRef,type RefObject} from 'react';
import {Euler,Vector3} from 'three';
import type {ThreeView} from './settings';

/** Free-fly mode leaves OrbitControls intact, so it can be turned off safely.
 * No background timer: movement runs only on the Canvas render loop. */
export function ExploreController({enabled,speed,view,touchActions}:{
  enabled:boolean;speed:number;
  view:RefObject<ThreeView|undefined>;touchActions:RefObject<Set<string>>;
}){
  const {camera,gl,invalidate}=useThree();
  const keys=useRef(new Set<string>());
  const look=useRef({yaw:0,pitch:0});
  useEffect(()=>{
    if(!enabled){keys.current.clear();return;}
    const euler=new Euler().setFromQuaternion(camera.quaternion,'YXZ');
    look.current={yaw:euler.y,pitch:euler.x};
    const down=(event:KeyboardEvent)=>{
      const focus=event.target as HTMLElement|null;
      if(focus&&['INPUT','TEXTAREA','SELECT'].includes(focus.tagName))return;
      const key=event.key.toLowerCase();
      if(['w','a','s','d',' ','shift','arrowup','arrowdown','arrowleft','arrowright'].includes(key)){
        keys.current.add(key);event.preventDefault();invalidate();
      }
    };
    const up=(event:KeyboardEvent)=>keys.current.delete(event.key.toLowerCase());
    const clear=()=>keys.current.clear();
    const mouse=(event:MouseEvent)=>{
      if(document.pointerLockElement!==gl.domElement)return;
      look.current.yaw-=event.movementX*.0025;
      look.current.pitch=Math.max(-1.48,Math.min(1.48,look.current.pitch-event.movementY*.0025));
      invalidate();
    };
    const lock=()=>{
      if(!matchMedia('(pointer: coarse)').matches&&document.pointerLockElement!==gl.domElement)
        void gl.domElement.requestPointerLock?.();
    };
    document.addEventListener('keydown',down);
    document.addEventListener('keyup',up);
    document.addEventListener('mousemove',mouse);
    window.addEventListener('blur',clear);
    gl.domElement.addEventListener('click',lock);
    invalidate();
    return ()=>{
      keys.current.clear();
      touchActions.current.clear();
      document.removeEventListener('keydown',down);
      document.removeEventListener('keyup',up);
      document.removeEventListener('mousemove',mouse);
      window.removeEventListener('blur',clear);
      gl.domElement.removeEventListener('click',lock);
      if(document.pointerLockElement===gl.domElement)document.exitPointerLock();
    };
  },[enabled,camera,gl,invalidate,touchActions]);

  useFrame((_,delta)=>{
    if(!enabled||document.hidden)return;
    const pressed=(key:string)=>keys.current.has(key)||touchActions.current.has(key);
    look.current.yaw+=((pressed('turn-left')?1:0)-(pressed('turn-right')?1:0))*Math.min(delta,.08)*1.35;
    look.current.pitch=Math.max(-1.48,Math.min(1.48,look.current.pitch+
      ((pressed('look-up')?1:0)-(pressed('look-down')?1:0))*Math.min(delta,.08)));
    camera.rotation.set(look.current.pitch,look.current.yaw,0,'YXZ');
    const direction=new Vector3(0,0,-1).applyQuaternion(camera.quaternion);
    const right=new Vector3(1,0,0).applyQuaternion(camera.quaternion);
    const forward=(pressed('w')||pressed('arrowup')?1:0)-(pressed('s')||pressed('arrowdown')?1:0);
    const strafe=(pressed('d')||pressed('arrowright')?1:0)-(pressed('a')||pressed('arrowleft')?1:0);
    const vertical=(pressed(' ')||pressed('ascend')?1:0)-(pressed('shift')||pressed('descend')?1:0);
    const movement=direction.multiplyScalar(forward).addScaledVector(right,strafe);
    movement.y+=vertical;
    if(movement.lengthSq()>0){
      movement.normalize().multiplyScalar(Math.min(delta,.08)*speed*3);
      camera.position.add(movement);
      camera.position.x=Math.max(-850,Math.min(850,camera.position.x));
      camera.position.z=Math.max(-850,Math.min(850,camera.position.z));
      camera.position.y=Math.max(-40,Math.min(450,camera.position.y));
    }
    const target=new Vector3(0,0,-8).applyQuaternion(camera.quaternion).add(camera.position);
    view.current={position:camera.position.toArray(),target:target.toArray()};
    invalidate();
  },-.5);
  return null;
}
