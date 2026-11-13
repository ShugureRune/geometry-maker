import {ALGORITHM_VERSION,LEGACY_ALGORITHM_VERSION,seededRandom,type AlgorithmVersion} from '../scene';
import {MAGIC_ALGORITHM_VERSION,magicDefaults,validateMagicSettings,type MagicCircleSettings} from '../magic-circle';
import {ALL_SHAPE_KINDS,validateShapeKinds,type ShapeKind} from '../shape-controls';
import {booleanField,enumField,numberField,record} from './style-settings';

/** An SVG-derived, transparent 2D composition placed on a real 3D plane. */
export type Hybrid2DSettings={
  enabled:boolean;
  x:number;y:number;z:number;
  size:number;
  rotationX:number;rotationY:number;rotationZ:number;
  opacity:number;
  billboard:boolean;
  spinSpeed:number;
  /** Number of independent native 2D seed compositions (1 preserves old projects). */
  count:number;
  spread:number;
  layout:'cloud'|'spiral'|'grid';
  variation:number;
};
export const hybrid2DDefaults:Hybrid2DSettings={
  enabled:false,x:0,y:0,z:0,size:7,
  rotationX:0,rotationY:0,rotationZ:0,
  opacity:1,billboard:false,spinSpeed:0,
  count:1,spread:10,layout:'cloud',variation:0,
};
export function validateHybrid2D(value:unknown):Hybrid2DSettings{
  const source=record(value);
  if(Object.keys(source).some(key=>!Object.hasOwn(hybrid2DDefaults,key)))
    throw new Error('2D合成設定に未対応の項目があります。');
  const d={...hybrid2DDefaults,...source};
  return {
    enabled:booleanField(d.enabled,'2D合成ON/OFF'),
    x:numberField(d.x,-8,8,'2DレイヤーX'),
    y:numberField(d.y,-8,8,'2DレイヤーY'),
    z:numberField(d.z,-8,8,'2DレイヤーZ'),
    size:numberField(d.size,1,16,'2Dレイヤーの高さ'),
    rotationX:numberField(d.rotationX,-180,180,'2DレイヤーのX回転'),
    rotationY:numberField(d.rotationY,-180,180,'2DレイヤーのY回転'),
    rotationZ:numberField(d.rotationZ,-180,180,'2DレイヤーのZ回転'),
    opacity:numberField(d.opacity,0,1,'2Dレイヤーの不透明度'),
    billboard:booleanField(d.billboard,'2Dレイヤーのカメラ追従'),
    spinSpeed:numberField(d.spinSpeed,-90,90,'2Dレイヤーの自転速度'),
    count:numberField(d.count,1,32,'2D召喚数',true),
    spread:numberField(d.spread,1,20,'2D召喚範囲'),
    layout:enumField(d.layout,['cloud','spiral','grid'],'2Dの配置方法'),
    variation:numberField(d.variation,0,999999,'2D召喚の再抽選番号',true),
  };
}

/** Preserve the source 2D generator when exporting a hybrid 3D project.
 * Only parameters are stored: no raw SVG, remote URLs, or arbitrary markup. */
export type Hybrid2DSource={
  algorithmVersion:AlgorithmVersion;
  enabledShapeKinds:ShapeKind[];
  magicCircle:MagicCircleSettings;
};
export function validateHybrid2DSource(value:unknown):Hybrid2DSource{
  const d=record(value);
  if(Object.keys(d).some(key=>!['algorithmVersion','enabledShapeKinds','magicCircle'].includes(key)))
    throw new Error('合成元2Dの設定に未対応の項目があります。');
  return {
    algorithmVersion:enumField(d.algorithmVersion,
      [ALGORITHM_VERSION,LEGACY_ALGORITHM_VERSION,MAGIC_ALGORITHM_VERSION],
      '合成元2Dアルゴリズム'),
    enabledShapeKinds:validateShapeKinds(d.enabledShapeKinds??ALL_SHAPE_KINDS),
    magicCircle:validateMagicSettings(d.magicCircle??magicDefaults),
  };
}

/** Unique deterministic seeds for the secondary 2D images. The first plane
 * retains the original seed and artwork, so count=1 is pixel-compatible. */
export function hybrid2DSeed(seed:string,variation:number,index:number):string{
  return index===0?seed:`${seed}::native-2d-multiseed-v1::${variation}::${index}`;
}

export type Hybrid2DInstance={
  seed:string;
  offset:[number,number,number];
  rotation:[number,number,number];
  scale:number;
};

/** Spatial placement is independent of all 2D artwork generation and stable
 * across slider changes, reloads, screenshots and video frame seeking. */
export function hybrid2DInstances(seed:string,options:Hybrid2DSettings):Hybrid2DInstance[]{
  const count=options.count;
  const random=seededRandom(`hybrid-2d-layout-v1:${seed}:${options.variation}:${options.layout}`);
  if(count===1)return [{seed,offset:[0,0,0],rotation:[0,0,0],scale:1}];
  const result:Hybrid2DInstance[]=[];
  const scale=1/Math.sqrt(count);
  const goldenAngle=Math.PI*(3-Math.sqrt(5));
  const columns=Math.ceil(Math.sqrt(count));
  const rows=Math.ceil(count/columns);
  for(let i=0;i<count;i++){
    let x:number,y:number,z:number;
    if(options.layout==='grid'){
      x=((i%columns)-(columns-1)/2)*options.spread/Math.max(1,columns-1);
      y=((rows-1)/2-Math.floor(i/columns))*options.spread/Math.max(1,rows-1);
      z=(i%3-1)*options.spread*.10;
    }else if(options.layout==='spiral'){
      const angle=i*goldenAngle;
      const radius=Math.sqrt((i+.5)/count)*options.spread*.48;
      x=Math.cos(angle)*radius;
      y=Math.sin(angle)*radius;
      z=(i/(count-1)-.5)*options.spread*.65;
    }else{
      const vertical=1-2*(i+.5)/count;
      const ring=Math.sqrt(Math.max(0,1-vertical*vertical));
      const angle=i*goldenAngle+random()*.22;
      const radius=options.spread*(.37+.13*random());
      x=Math.cos(angle)*ring*radius;
      y=vertical*radius;
      z=Math.sin(angle)*ring*radius;
    }
    result.push({
      seed:hybrid2DSeed(seed,options.variation,i),
      offset:[x,y,z],
      rotation:[(random()-.5)*22,(random()-.5)*22,(random()-.5)*16],
      scale,
    });
  }
  return result;
}
