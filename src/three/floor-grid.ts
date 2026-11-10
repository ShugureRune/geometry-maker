/** A true horizontal 3D floor. The perspective comes from the camera, not a 2D overlay.
 * The grid does not participate in seeded geometry or shape selection.
 */
export type FloorGridSettings={
  enabled:boolean;
  color:string;
  opacity:number;
  spacing:number;
  thickness:number;
  glow:number;
  extent:number;
  scrollSpeed:number;
};
export const floorGridDefaults:FloorGridSettings={
  enabled:false,
  color:'#43cfff',
  opacity:.62,
  spacing:2.5,
  thickness:1.5,
  glow:80,
  extent:70,
  scrollSpeed:0,
};

export function validateFloorGrid(value:unknown):FloorGridSettings{
  if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('3D床グリッド設定が不正です。');
  const g=value as Record<string,unknown>;
  if(typeof g.enabled!=='boolean'||typeof g.color!=='string'||!/^#[0-9a-f]{6}$/i.test(g.color))
    throw new Error('3D床グリッドの有効状態・色が不正です。');
  const limits={opacity:[0,1],spacing:[.5,8],thickness:[.5,5],glow:[0,200],extent:[24,120],scrollSpeed:[0,8]} as const;
  for(const [key,[min,max]] of Object.entries(limits) as Array<[keyof typeof limits,readonly [number,number]]>){
    const v=g[key];
    if(typeof v!=='number'||!Number.isFinite(v)||v<min||v>max)
      throw new Error(`3D床グリッドの${key}が範囲外です。`);
  }
  return {enabled:g.enabled,color:g.color,opacity:g.opacity as number,spacing:g.spacing as number,
    thickness:g.thickness as number,glow:g.glow as number,extent:g.extent as number,scrollSpeed:g.scrollSpeed as number};
}

/** World-unit scroll, seamless every cell; obeys 3D play/pause and JSON restored time. */
export function floorGridOffset(seconds:number,grid:FloorGridSettings):number{
  if(!grid.enabled||grid.scrollSpeed===0||!Number.isFinite(seconds))return 0;
  const offset=(Math.max(0,seconds)*grid.scrollSpeed)%grid.spacing;
  return Math.abs(offset-grid.spacing)<1e-8?0:offset;
}


/** Physical stroke width in world units, independent of camera zoom/distance.
 * uThickness is a familiar relative slider, ~1–2px at the home camera.
 * Projection (rather than a fixed pixel thickness) determines distant width. */
export function floorGridStrokeWidth(thickness:number):number{
  return thickness*.012;
}

/** Stored extent (24..120) remains compatible with old 3D JSON.
 * Only the rendered diameter is enlarged, so grid spacing and motion stay unchanged. */
export const FLOOR_GRID_DIAMETER_MULTIPLIER = 10;
export function floorGridDiameter(extent:number):number{
  return extent*FLOOR_GRID_DIAMETER_MULTIPLIER;
}

/** Center horizontally under the OrbitControls look-at target, not an
 * extent-dependent Z offset. Keep the plane below the scene's solids. */
export function floorGridPlacement(sceneHeight:number,target:readonly [number,number,number]=[0,0,-.4]):[number,number,number]{
  return [target[0],-Math.max(3.3,sceneHeight*.51),target[2]];
}
