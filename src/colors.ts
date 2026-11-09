import { seededRandom, type Background } from './scene';
export const SLOTS = ['solid','gradient0','gradient1','gradient2','primary','support','accent'] as const;
export type Slot = typeof SLOTS[number];
export type ColorSettings = { edited?: Slot[]; version: 1; mode: 'manual'|'seed'; appearance: 'seed'|'light'|'dark'; slots: Record<Slot,{ color:string; locked:boolean; reroll:number }> };
export const isHex = (v:unknown):v is string => typeof v==='string' && /^#[0-9a-f]{6}$/i.test(v);
export function generatedColor(seed:string,slot:Slot,count:number,appearance:ColorSettings['appearance']):string {
 const background=slot==='solid'||slot.startsWith('gradient');
 const hue=seededRandom(`colors-v1:${seed}:harmony`)()*360+(background?0:24);
 const light=appearance==='light'||(appearance==='seed'&&seededRandom(`colors-v1:${seed}:light`)()>0.5);
 const local=seededRandom(`colors-v1:${seed}:${slot}:${count}`);
 const shift=slot==='accent'?150:slot==='support'?25:slot==='gradient2'?-22:0;
 const h=((hue+shift+(local()-.5)*32+count*47)%360+360)%360;
 const s=background?(light?28:38):55+local()*20;
 const l=background?(light?91+local()*5:8+local()*10):(light?27+local()*12:68+local()*17);
 const a=s*Math.min(l,100-l)/100;
 const channel=(n:number)=>{const k=(n+h/30)%12;return Math.round((l-a*Math.max(-1,Math.min(k-3,9-k,1)))*2.55).toString(16).padStart(2,'0');};
 return '#'+channel(0)+channel(8)+channel(4);
}
export function legacyColors(bg:Background):ColorSettings {
 const values=[bg.solid,...bg.colors,'#ba9bff','#b9d4ff','#9af5d8'];
 return {version:1,mode:'manual',appearance:'seed',slots:Object.fromEntries(SLOTS.map((id,i)=>[id,{color:values[i],locked:false,reroll:0}])) as ColorSettings['slots']};
}
export function reseedColors(c:ColorSettings,seed:string):ColorSettings {
 return {...c,slots:Object.fromEntries(SLOTS.map(id=>[id,c.mode==='seed'&&!c.slots[id].locked?{...c.slots[id],color:generatedColor(seed,id,c.slots[id].reroll,c.appearance)}:{...c.slots[id]}])) as ColorSettings['slots']};
}
export function rerollColor(c:ColorSettings,seed:string,id:Slot):ColorSettings {
 const n=c.slots[id].reroll+1;
 if(!Number.isSafeInteger(n)) throw new Error('再抽選回数の上限です。');
 return {...c,edited:[...new Set([...(c.edited??[]),id])],slots:{...c.slots,[id]:{...c.slots[id],reroll:n,color:generatedColor(seed,id,n,c.appearance)}}};
}
export function coloredBackground(bg:Background,c:ColorSettings):Background {
 return {...bg,solid:c.slots.solid.color,colors:[c.slots.gradient0.color,c.slots.gradient1.color,c.slots.gradient2.color],
  figureColors:Object.fromEntries((['primary','support','accent'] as const).filter(id=>c.mode==='seed'||c.edited?.includes(id)).map(id=>[id,c.slots[id].color]))};
}
export function validateColors(value:unknown):ColorSettings {
 const c=value as ColorSettings;
 if(!c||c.version!==1||!['manual','seed'].includes(c.mode)||!['seed','light','dark'].includes(c.appearance)||!c.slots)throw new Error('配色設定の形式が正しくありません。');
 const slots=Object.fromEntries(SLOTS.map(id=>{const s=c.slots[id];if(!s||!isHex(s.color)||typeof s.locked!=='boolean'||!Number.isSafeInteger(s.reroll)||s.reroll<0)throw new Error(`配色スロット${id}が不正です。`);return [id,{color:s.color,locked:s.locked,reroll:s.reroll}];})) as ColorSettings['slots'];
 if(c.edited!==undefined&&(!Array.isArray(c.edited)||!c.edited.every(id=>SLOTS.includes(id))))throw new Error('配色の編集状態が不正です。');
 return {version:1,mode:c.mode,appearance:c.appearance,slots,...(c.edited?{edited:[...c.edited]}:{})};
}
