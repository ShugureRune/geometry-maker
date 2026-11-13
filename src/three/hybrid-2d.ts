import {ALGORITHM_VERSION,LEGACY_ALGORITHM_VERSION,type AlgorithmVersion} from '../scene';
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
};
export const hybrid2DDefaults:Hybrid2DSettings={
  enabled:false,x:0,y:0,z:0,size:7,
  rotationX:0,rotationY:0,rotationZ:0,
  opacity:1,billboard:false,spinSpeed:0,
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
