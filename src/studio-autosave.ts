import {parseSettings,type ProjectSettings} from './settings';
import {validateThreeProject,type ThreeProject} from './three/project';
import type {Category} from './SettingsCategories';

export const STUDIO_AUTOSAVE_KEY='geometry-maker-studio-autosave-v1';
const MAX_AUTOSAVE_LENGTH=160_000;
const validCategories:readonly Category[]=['shapes','background','colors','text','decoration','animation','export'];

export type StudioAutosave={
  schemaVersion:1;
  mode:'2d'|'3d';
  category:Category|null;
  threeCategory:Category|null;
  focus:boolean;
  collapsed:boolean;
  twoD:ProjectSettings;
  threeD:ThreeProject;
};

const isCategory=(value:unknown):value is Category|null=>
  value===null||validCategories.includes(value as Category);

/** Never trust browser storage: validate both projects before restoring any state. */
export function validateStudioAutosave(value:unknown):StudioAutosave{
  if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('保存データの形式が不正です。');
  const v=value as Record<string,unknown>;
  if(v.schemaVersion!==1||(v.mode!=='2d'&&v.mode!=='3d')||
    !isCategory(v.category)||!isCategory(v.threeCategory)||
    typeof v.focus!=='boolean'||typeof v.collapsed!=='boolean')
    throw new Error('未対応の自動保存データです。');
  // Existing import validators rebuild allowlisted projects and reject
  // corrupt or obsolete values without merging arbitrary fields into React.
  const twoD=parseSettings(JSON.stringify(v.twoD));
  const threeD=validateThreeProject(v.threeD);
  if(twoD.seed!==threeD.seed||twoD.aspectRatio!==threeD.aspectRatio||
    twoD.density!==threeD.density)throw new Error('保存データの作品情報が一致しません。');
  return {schemaVersion:1,mode:v.mode,category:v.category,threeCategory:v.threeCategory,
    focus:v.focus,collapsed:v.collapsed,twoD,threeD};
}

export function loadStudioAutosave(storage:Pick<Storage,'getItem'>|null=
  typeof localStorage==='undefined'?null:localStorage):StudioAutosave|null{
  try{
    const text=storage?.getItem(STUDIO_AUTOSAVE_KEY);
    if(!text||text.length>MAX_AUTOSAVE_LENGTH)return null;
    return validateStudioAutosave(JSON.parse(text));
  }catch{
    // Private browsing, blocked storage, or a damaged older draft must never
    // prevent the studio from opening with a fresh default project.
    return null;
  }
}

export function saveStudioAutosave(value:StudioAutosave,
  storage:Pick<Storage,'setItem'>|null=
    typeof localStorage==='undefined'?null:localStorage):boolean{
  try{
    if(!storage)return false;
    const data=JSON.stringify(validateStudioAutosave(value));
    if(data.length>MAX_AUTOSAVE_LENGTH)return false;
    storage.setItem(STUDIO_AUTOSAVE_KEY,data);
    return true;
  }catch{return false;}
}
