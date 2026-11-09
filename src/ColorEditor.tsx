import { useEffect,useState } from 'react';
import { isHex } from './colors';
export function ColorEditor({label,value,locked,onColor,onRoll,onLock}:{label:string;value:string;locked:boolean;onColor:(v:string)=>void;onRoll:()=>void;onLock:()=>void}) {
 const [hex,setHex]=useState(value);useEffect(()=>setHex(value),[value]);
 return <div className="color-editor"><span>{label}</span><div>
 <input type="color" aria-label={label} value={value} onChange={e=>onColor(e.target.value)}/>
 <input aria-label={`${label} HEX`} value={hex} aria-invalid={!isHex(hex)} maxLength={7} onChange={e=>{setHex(e.target.value);if(isHex(e.target.value))onColor(e.target.value);}} onBlur={()=>{if(!isHex(hex))setHex(value);}}/>
 <button type="button" aria-label={`${label}をランダム変更`} title="この色だけ再抽選（シード・配置は維持）" onClick={onRoll}>🎲</button>
 <button type="button" aria-label={`${label}を固定`} aria-pressed={locked} title={locked?'固定中：シード変更でも維持':'自動：シード連動モードでは更新'} onClick={onLock}>{locked?'🔒':'🔓'}</button>
 </div></div>;
}
