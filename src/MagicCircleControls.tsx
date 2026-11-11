import {HelpInfo} from './HelpInfo';
import type {MagicCircleSettings} from './magic-circle';
import {buildMagicBlueprint} from './magic-blueprint';
import {MAGIC_PALETTES,magicPaletteById,magicPaletteFromSeed} from './magic-colors';

type Props={value:MagicCircleSettings;onChange:(settings:MagicCircleSettings)=>void};
export function MagicCircleControls({value,onChange,seed}:Props&{seed:string}){
  const set=<K extends keyof MagicCircleSettings,>(key:K,next:MagicCircleSettings[K])=>
    onChange({...value,[key]:next});
  const range=(id:string,label:string,key:'complexity'|'ringCount'|'symmetry'|'ornamentDensity'|'strokeScale'|'rotationTurns'|'chaos',min:number,max:number,step=1,suffix='')=>
    <div className="magic-range" key={id}>
      <label className="range-label" htmlFor={id}>{label} <output htmlFor={id}>{value[key]}{suffix}</output></label>
      <input id={id} type="range" min={min} max={max} step={step} value={value[key]} onChange={e=>set(key,Number(e.target.value))}/>
    </div>;
  return <section className="control-section magic-controls" aria-labelledby="magic-controls-title" data-testid="magic-controls">
    <h3 id="magic-controls-title">魔法陣スタジオ <span aria-hidden="true">✧</span></h3>
    <HelpInfo>中心対称の専用アルゴリズム。シードを変えても円環と紋様が整うように生成します。</HelpInfo>
    <label htmlFor="magic-generation-mode">魔法陣の生成方式</label>
    <select id="magic-generation-mode" value={value.generationMode} onChange={e=>set('generationMode',e.target.value as MagicCircleSettings['generationMode'])}>
      <option value="classic">クラシック — 3種類のスタイル</option>
      <option value="infinite">無限生成 — シードで構造から変える</option>
    </select>
    {value.generationMode==='classic'?<>
    <label htmlFor="magic-style">魔法陣のスタイル</label>
    <select id="magic-style" value={value.style} onChange={e=>set('style',e.target.value as MagicCircleSettings['style'])}>
      <option value="star">星紋・召喚陣</option>
      <option value="geometric">幾何学・錬成陣</option>
      <option value="crest">紋章・花弁陣</option>
    </select>
    </>:<div className="magic-infinite-options" data-testid="magic-infinite-controls">
      <HelpInfo>シードごとに中心紋様・各円環の役割・装飾・対称性を組み替えます。必ず放射状の整った構図になる生成方式です。</HelpInfo>
      {range('magic-chaos','構造のランダム度','chaos',0,100,5,'%')}
      <label className="glow-toggle"><input type="checkbox" checked={value.rareEffects}
        onChange={e=>set('rareEffects',e.target.checked)}/> レアな特殊紋様を生成する</label>
      <button type="button" onClick={()=>set('variation',(value.variation+1)%1_000_000)}>
        ✧ 同じシードから別の魔法陣を生成
      </button>
      <p className="help" data-testid="magic-variation">派生番号：{value.variation}（シードと設定JSONで再現可能）</p>
      {(()=>{const b=buildMagicBlueprint(seed,value);return <p className="help" data-testid="magic-blueprint-summary">設計図：{b.symmetry}方向対称 · {b.ringCount}層 · 中心{b.coreKind} · 装飾{b.motifFamily}{b.rareEffect?' · 特殊：'+b.rareEffect:''}</p>})()}
    </div>}
    {range('magic-complexity','紋様の複雑さ','complexity',0,100,5,'%')}
    {range('magic-rings',value.generationMode==='infinite'?'基準の円環数':'同心円の数','ringCount',2,8)}
    {range('magic-symmetry',value.generationMode==='infinite'?'基準の対称数':'対称数','symmetry',3,12)}
    {range('magic-ornaments','装飾密度','ornamentDensity',0,100,5,'%')}
    {range('magic-stroke','魔法陣の線幅','strokeScale',50,200,5,'%')}
    <label htmlFor="magic-rune-style">円環の装飾</label>
    <select id="magic-rune-style" value={value.runeStyle} onChange={e=>set('runeStyle',e.target.value as MagicCircleSettings['runeStyle'])}>
      <option value="runes">オリジナルのルーン風紋様</option>
      <option value="dots">星のドット刻印</option>
      <option value="arcs">曲線の刻印</option>
    </select>
    {range('magic-rotation','円環の回転速度','rotationTurns',0,3,1,'周/周期')}
    <HelpInfo>召喚アニメが完成しても円環は回り続けます。隣接する円環は反対方向に回転。0なら停止します（端末の「視差効果を減らす」設定は尊重します）。</HelpInfo>
    <div className="magic-export-options">
      <label className="glow-toggle"><input type="checkbox" checked={!value.showBackground}
        onChange={e=>set('showBackground',!e.target.checked)}/> 背景なしでプレビュー</label>
      <label className="glow-toggle"><input type="checkbox" checked={value.transparentExport}
        onChange={e=>set('transparentExport',e.target.checked)}/> 魔法陣だけを透過PNG / SVGで書き出す</label>
    </div>
    <HelpInfo>透過保存は背景・グリッド・文字を除外し、余白も透明になります。動画は従来どおり背景付きです。</HelpInfo>
  </section>;
}

export function MagicColorControls({value,onChange,seed}:Props&{seed:string}){
  const current=value.colorMode==='auto'?magicPaletteFromSeed(seed,value.paletteReroll):
    value.colorMode==='preset'?magicPaletteById(value.colorPreset):
    {...value.customColors,id:'custom',name:'オリジナルの配色'};
  const setColor=(key:'primary'|'support'|'accent'|'solid',color:string)=>
    onChange({...value,customColors:{...value.customColors,[key]:color}});
  const setGradient=(index:number,color:string)=>{
    const gradient=[...value.customColors.gradient] as [string,string,string];
    gradient[index]=color;
    onChange({...value,customColors:{...value.customColors,gradient,
      ...(index===0?{solid:color}:{})}});
  };
  return <section className="control-section magic-color-controls" aria-labelledby="magic-colors-title" data-testid="magic-colors">
    <h3 id="magic-colors-title">魔法陣専用カラー</h3>
    <HelpInfo>普通の2Dの配色とは完全に独立。魔法陣をシードに合った8系統の光色と暗色背景で描きます。</HelpInfo>
    <label htmlFor="magic-color-mode">魔法陣の配色モード</label>
    <select id="magic-color-mode" value={value.colorMode}
      onChange={e=>onChange({...value,colorMode:e.target.value as MagicCircleSettings['colorMode']})}>
      <option value="auto">自動 — 魔法陣向けランダム配色</option>
      <option value="preset">プリセットを指定</option>
      <option value="custom">手動 — 魔法陣専用カラー</option>
    </select>
    {value.colorMode==='auto'&&<>
      <p data-testid="magic-auto-palette" className="help">シードから選ばれた配色：<strong>{current.name}</strong></p>
      <button type="button" onClick={()=>onChange({...value,paletteReroll:(value.paletteReroll+1)%1_000_001})}>
        ✧ 魔法の色を再抽選
      </button>
      <HelpInfo>押すたび別の配色を選びます。シード・再抽選回数と一緒にJSONへ保存できます。</HelpInfo>
    </>}
    {value.colorMode==='preset'&&<>
      <label htmlFor="magic-color-preset">魔法陣パレット</label>
      <select id="magic-color-preset" value={value.colorPreset}
        onChange={e=>onChange({...value,colorPreset:e.target.value as MagicCircleSettings['colorPreset']})}>
        {MAGIC_PALETTES.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
      </select>
    </>}
    <div className="magic-palette-swatches" aria-label="魔法陣パレットの色見本">
      {[current.primary,current.support,current.accent,...current.gradient].map((color,i)=>
        <span key={i} style={{backgroundColor:color}} title={color} aria-label={color}/>)}
    </div>
    {value.colorMode==='custom'&&<div className="magic-custom-colors">
      {([
        ['primary','主線'],['support','補助線'],['accent','発光アクセント']
      ] as const).map(([key,label])=>
        <label key={key}>{label}
          <input type="color" aria-label={'魔法陣'+label} value={value.customColors[key]}
            onChange={e=>setColor(key,e.target.value)}/>
        </label>)}
      {value.customColors.gradient.map((color,i)=>
        <label key={i}>背景グラデーション{i+1}
          <input type="color" aria-label={'魔法陣背景色'+(i+1)} value={color}
            onChange={e=>setGradient(i,e.target.value)}/>
        </label>)}
    </div>}
    <HelpInfo>自動・プリセット・手動の設定は魔法陣だけに適用されます。透過書き出しでは背景だけが除去され、魔法陣の色はそのまま残ります。</HelpInfo>
  </section>;
}
