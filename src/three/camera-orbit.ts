import type {Vector3Tuple} from './model';

/** Rotate the camera around its current focus using a satellite-like orbital
 * plane. Inclining the orbital axis by 10° yields gentle vertical movement
 * throughout one full orbit, without a phase reset or a zoom-distance jump.
 *
 * With angle=0 and no elapsed time this returns the exact starting position.
 * All angles are applied incrementally, preserving a user's drag and zoom.
 */
export function inclinedCameraOrbitStep(
  position:Vector3Tuple,target:Vector3Tuple,
  seconds:number,speed:number,tiltDegrees:number,
):Vector3Tuple{
  if(!Number.isFinite(seconds)||!Number.isFinite(speed)||seconds<=0||speed<=0)
    return [...position];
  const dt=Math.min(.1,seconds);
  // OrbitControls default is one full horizontal lap per 60 s at speed=1.
  // Negative orientation agrees with its clockwise world-Y auto rotation.
  const angle=-Math.PI*2/60*speed*dt;
  const tilt=Math.max(0,Math.min(30,tiltDegrees))*Math.PI/180;
  const axisX=Math.sin(tilt),axisY=Math.cos(tilt);
  const x=position[0]-target[0],y=position[1]-target[1],z=position[2]-target[2];
  const dot=axisX*x+axisY*y;
  const cosine=Math.cos(angle),sine=Math.sin(angle),inverse=1-cosine;
  // Rodrigues rotation around the world-space inclined Y axis.
  return [
    target[0]+x*cosine+axisY*z*sine+axisX*dot*inverse,
    target[1]+y*cosine-axisX*z*sine+axisY*dot*inverse,
    target[2]+z*cosine+(axisX*y-axisY*x)*sine,
  ];
}
