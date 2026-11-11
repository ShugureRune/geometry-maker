import {HelpInfo} from './HelpInfo';
import {ALL_SHAPE_KINDS,BASIC_SHAPE_KINDS,EXTENDED_SHAPE_KINDS,
 RECOMMENDED_SHAPE_KINDS,SHAPE_FAMILIES,SHAPE_LABELS,type ShapeKind} from './shape-controls';

export function ShapeKindControls({enabled,onChange}:{enabled:readonly ShapeKind[];onChange:(next:ShapeKind[])=>void}){
 const active=new Set(enabled);
 function setKind(kind:ShapeKind,checked:boolean){
  if(!checked&&enabled.length===1)return;
  onChange(checked?ALL_SHAPE_KINDS.filter(item=>active.has(item)||item===kind):enabled.filter(item=>item!==kind));
 }
 return <section className="control-section shape-kind-controls" aria-labelledby="shape-kinds-heading">
  <div className="section-heading">
   <h3 id="shape-kinds-heading">表示する図形</h3>
   <span className="tiny-label">{enabled.length} / {ALL_SHAPE_KINDS.length} 種類</span>
  </div>
  <HelpInfo>OFFの図形は非表示で終わらず、近い種類のON図形に自動で置き換えます。同じシードと設定なら同じ結果です。</HelpInfo>
  <div className="shape-kind-presets" role="group" aria-label="図形の一括選択">
   <button type="button" onClick={()=>onChange([...ALL_SHAPE_KINDS])}>すべてON</button>
   <button type="button" onClick={()=>onChange(['circle'])}>すべてOFF（円のみ残す）</button>
   <button type="button" onClick={()=>onChange([...RECOMMENDED_SHAPE_KINDS])}>おすすめ</button>
   <button type="button" onClick={()=>onChange([...BASIC_SHAPE_KINDS])}>基本のみ</button>
   <button type="button" onClick={()=>onChange([...EXTENDED_SHAPE_KINDS])}>拡張のみ</button>
  </div>
  {SHAPE_FAMILIES.map(family=><fieldset key={family.name} className="shape-kind-family">
   <legend>{family.name}</legend>
   <div className="shape-kind-grid">
    {family.kinds.map(kind=><label className="shape-kind-option" key={kind}>
     <input type="checkbox" value={kind} checked={active.has(kind)}
      disabled={active.has(kind)&&enabled.length===1}
      onChange={event=>setKind(kind,event.target.checked)}/>
     <span>{SHAPE_LABELS[kind]}</span>
    </label>)}
   </div>
  </fieldset>)}
  <p className="help" role="status">最低1種類はONにしてください。選んだ種類は主役・補助・装飾すべてに適用されます。</p>
 </section>;
}
