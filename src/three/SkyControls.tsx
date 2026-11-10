import {ThreeRange} from './ThreeControls';
import {SKY_KINDS,SKY_LABELS,skyDefaults,skyPalette,type SkySettings,type SkyKind,type SkyPalette,type SkyEffectKind} from './sky-settings';

export function SkyControls({value,onChange}:{value?:SkySettings;onChange:(sky:SkySettings)=>void}){
  const sky=value??skyDefaults;
  const update=(patch:Partial<SkySettings>)=>onChange({...sky,...patch});
  const palette=skyPalette(sky);
  function setColor(channel:keyof SkyPalette,color:string){
    if(sky.kind==='classic')return;
    const palettes={...sky.palettes,[sky.kind]:{...palette,[channel]:color}};
    update({palettes});
  }
  function resetColors(){
    if(sky.kind==='classic')return;
    const palettes={...sky.palettes};
    delete palettes[sky.kind as SkyEffectKind];
    update({palettes});
  }
  return <section className="control-section three-controls" aria-labelledby="sky-heading">
    <h3 id="sky-heading">3D空間の背景（8種類）</h3>
    <label htmlFor="three-sky-kind">3D背景の種類</label>
    <select id="three-sky-kind" value={sky.kind} onChange={e=>update({kind:e.target.value as SkyKind})}>
      {SKY_KINDS.map(kind=><option value={kind} key={kind}>{SKY_LABELS[kind]}</option>)}
    </select>
    {sky.kind!=='classic'&&<>
      <ThreeRange id="three-sky-intensity" label="背景エフェクトの強さ" value={sky.intensity} min={0} max={200}
        step={5} unit="%" onChange={intensity=>update({intensity})}/>
      <ThreeRange id="three-sky-density" label="星・粒子・模様の密度" value={sky.density} min={0} max={200}
        step={10} unit="%" onChange={density=>update({density})}/>
      <ThreeRange id="three-sky-motion" label="背景が動く速さ" value={sky.motion} min={0} max={300}
        step={10} unit="%" onChange={motion=>update({motion})}/>
      <div className="three-sky-colors" role="group" aria-label="3D背景カラー">
        <label htmlFor="three-sky-primary">背景のメインカラー
          <input id="three-sky-primary" type="color" value={palette.primary}
            onChange={e=>setColor('primary',e.target.value)}/>
        </label>
        <label htmlFor="three-sky-secondary">背景のサブカラー
          <input id="three-sky-secondary" type="color" value={palette.secondary}
            onChange={e=>setColor('secondary',e.target.value)}/>
        </label>
        <button type="button" onClick={resetColors}>この背景のカラーを初期値に戻す</button>
      </div>
    </>}
    <p className="help">8つの背景を切り替えられます。星空・銀河・オーロラ・深海・星雲・サイバートンネル・レトロウェーブ・デジタル空間は、カメラの向きに合わせて見え方が変わる3D背景です。図形・天体・ネオン・床グリッドと併用できます。2色のカラー設定は背景の種類ごとに記憶します。レトロウェーブのピンクの床と通常の3D床グリッドも重ねて表示できます。背景の動きは3Dの再生・一時停止に連動します。従来の単色・グラデーションも引き続き使えます。</p>
  </section>;
}
