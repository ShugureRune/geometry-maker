import {ThreeRange} from './ThreeControls';
import {SKY_KINDS,SKY_LABELS,skyDefaults,skyPalette,type SkySettings,type SkyKind,type SkyEffectKind,type SkyPalette} from './sky-settings';

export function SkyControls({value,onChange}:{value?:SkySettings;onChange:(sky:SkySettings)=>void}){
  const sky=value??skyDefaults;
  const update=(patch:Partial<SkySettings>)=>onChange({...sky,...patch});
  const palette=skyPalette(sky);
  const updateColor=(key:keyof SkyPalette,color:string)=>{
    if(sky.kind==='classic')return;
    onChange({...sky,palettes:{...sky.palettes,[sky.kind]:{...palette,[key]:color}}});
  };
  const resetColors=()=>{
    if(sky.kind==='classic')return;
    const palettes={...sky.palettes};
    delete palettes[sky.kind as SkyEffectKind];
    onChange({...sky,palettes});
  };
  return <section className="control-section three-controls" aria-labelledby="sky-heading">
    <h3 id="sky-heading">3D空間の背景（8種類）</h3>
    <label htmlFor="three-sky-kind">3D背景の種類</label>
    <select id="three-sky-kind" value={sky.kind} onChange={e=>update({kind:e.target.value as SkyKind})}>
      {SKY_KINDS.map(kind=><option value={kind} key={kind}>{SKY_LABELS[kind]}</option>)}
    </select>
    {sky.kind!=='classic'&&<>
      <fieldset className="three-kind-fieldset">
        <legend>背景のカスタムカラー</legend>
        {([
          ['base','背景の暗部'],['primary','主役の光'],['accent','アクセントの光'],
        ] as const).map(([key,label])=><label key={key} htmlFor={`three-sky-color-${key}`} className="three-sky-color">
          {label} <input id={`three-sky-color-${key}`} type="color" value={palette[key]}
            onChange={e=>updateColor(key,e.target.value)} aria-label={`3D背景：${label}`}/>
          <span>{palette[key].toUpperCase()}</span>
        </label>)}
        <button type="button" onClick={resetColors} disabled={!sky.palettes?.[sky.kind]}>この背景の色を初期値に戻す</button>
        <p className="help">背景ごとに3色を保存します。別の背景へ切り替えても、この背景の色は残ります。2Dの配色には影響しません。</p>
      </fieldset>
      <ThreeRange id="three-sky-intensity" label="背景エフェクトの強さ" value={sky.intensity} min={0} max={200}
        step={5} unit="%" onChange={intensity=>update({intensity})}/>
      <ThreeRange id="three-sky-density" label="星・粒子・模様の密度" value={sky.density} min={0} max={200}
        step={10} unit="%" onChange={density=>update({density})}/>
      <ThreeRange id="three-sky-motion" label="背景が動く速さ" value={sky.motion} min={0} max={300}
        step={10} unit="%" onChange={motion=>update({motion})}/>
    </>}
    <p className="help">8つの背景を切り替えられます。星空・銀河・オーロラ・深海・星雲・サイバートンネル・レトロウェーブ・デジタル空間は、カメラの向きに合わせて見え方が変わる3D背景です。図形・天体・ネオン・床グリッドと併用できます。背景の動きは3Dの再生・一時停止に連動します。従来の単色・グラデーションも引き続き使えます。</p>
  </section>;
}
