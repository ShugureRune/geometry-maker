import {RATIOS,type Background,type Ratio} from '../scene';
import {validateColors,type ColorSettings} from '../colors';
import {validVisualTheme,type VisualTheme} from '../themes';
import {THREE_ALGORITHM_VERSION,type Vector3Tuple} from './model';
import {threeResolutionError,validateThreeSettings,type ThreeSettings,type ThreeView} from './settings';
import {enumField,hexField,numberField,record} from './style-settings';

export const MAX_THREE_PROJECT_BYTES=64*1024;
export type ThreeProject={
  kind:'geometry-maker-3d';schemaVersion:1;algorithmVersion:typeof THREE_ALGORITHM_VERSION;
  seed:string;aspectRatio:Ratio;density:number;visualTheme:VisualTheme;background:Background;
  colorSettings?:ColorSettings;settings:ThreeSettings;view?:ThreeView;elapsedSeconds:number;exportWidth:number;exportHeight:number;
  /** Persist whether a standby morph has completed, to restore its exact static pose. */
  standbyComplete?:boolean;
};
export function validateThreeProject(value:unknown):ThreeProject {
  const d=record(value);
  if(d.kind!=='geometry-maker-3d'||d.schemaVersion!==1||d.algorithmVersion!==THREE_ALGORITHM_VERSION)
    throw new Error('3D専用設定（geometry-maker-3d / 3d-v1）が必要です。2D設定は2Dモードで読み込んでください。');
  if(typeof d.seed!=='string'||d.seed.length>4096)throw new Error('シードは4096文字以下で指定してください。');
  const aspectRatio=enumField(d.aspectRatio,Object.keys(RATIOS) as Ratio[],'縦横比');
  if(!validVisualTheme(d.visualTheme))throw new Error('3Dテーマが不正です。');
  const b=record(d.background);
  if(!Array.isArray(b.colors)||b.colors.length!==3)throw new Error('グラデーションは3色で指定してください。');
  const background:Background={mode:enumField(b.mode,['solid','gradient'],'背景方式'),solid:hexField(b.solid),
    colors:b.colors.map(hexField) as Background['colors'],angle:numberField(b.angle,0,360,'背景の角度')};
  if(b.glowIntensity!==undefined)background.glowIntensity=numberField(b.glowIntensity,0,200,'図形発光');
  if(b.lineWidth!==undefined)background.lineWidth=numberField(b.lineWidth,50,300,'2Dの線幅');
  if(b.figureColors!==undefined){const colors=record(b.figureColors);background.figureColors={};for(const role of ['primary','support','accent'] as const)if(colors[role]!==undefined)background.figureColors[role]=hexField(colors[role]);}
  let view:ThreeView|undefined;
  if(d.view!==undefined){
    const v=record(d.view);
    const vector=(value:unknown):Vector3Tuple=>{
      if(!Array.isArray(value)||value.length!==3)throw new Error('カメラ座標が不正です。');
      return value.map(n=>numberField(n,-10_000,10_000,'カメラ座標')) as Vector3Tuple;
    };
    view={position:vector(v.position),target:vector(v.target)};
    const distance=Math.hypot(...view.position.map((n,i)=>n-view!.target[i]));
    if(distance<.1||distance>100)throw new Error('カメラ距離が不正です。');
  }
  const exportWidth=numberField(d.exportWidth,256,4096,'3D出力幅',true),exportHeight=numberField(d.exportHeight,256,4096,'3D出力高さ',true);
  if(threeResolutionError(exportWidth,exportHeight))throw new Error(threeResolutionError(exportWidth,exportHeight)!);
  if(d.standbyComplete!==undefined&&typeof d.standbyComplete!=='boolean')
    throw new Error('3D待機画面の復元状態が不正です。');
  return {kind:'geometry-maker-3d',schemaVersion:1,algorithmVersion:THREE_ALGORITHM_VERSION,seed:d.seed,aspectRatio,
    density:numberField(d.density,0,100,'密度',true),visualTheme:d.visualTheme,background,
    ...(d.colorSettings===undefined?{}:{colorSettings:validateColors(d.colorSettings)}),settings:validateThreeSettings(d.settings),
    ...(view?{view}:{}),elapsedSeconds:numberField(d.elapsedSeconds??0,0,1e9,'経過時間'),exportWidth,exportHeight,
    ...(d.standbyComplete===undefined?{}:{standbyComplete:d.standbyComplete as boolean})};
}
export function parseThreeProject(text:string):ThreeProject {
  if(new TextEncoder().encode(text).length>MAX_THREE_PROJECT_BYTES)throw new Error('3D設定JSONは64KB以下にしてください。');
  let value:unknown;try{value=JSON.parse(text);}catch{throw new Error('JSONの書式が正しくありません。');}
  return validateThreeProject(value);
}
export const threeProjectText=(project:ThreeProject)=>JSON.stringify(validateThreeProject(project),null,2)+'\n';
