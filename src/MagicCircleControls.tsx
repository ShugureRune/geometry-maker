import type {MagicCircleSettings} from './magic-circle';

type Props={value:MagicCircleSettings;onChange:(settings:MagicCircleSettings)=>void};
export function MagicCircleControls({value,onChange}:Props){
  const set=<K extends keyof MagicCircleSettings>(key:K,next:MagicCircleSettings[K])=>
    onChange({...value,[key]:next});
  const range=(id:string,label:string,key:'complexity'|'ringCount'|'symmetry'|'ornamentDensity'|'strokeScale'|'rotationTurns',min:number,max:number,step=1,suffix='')=>
    <div className="magic-range" key={id}>
      <label className="range-label" htmlFor={id}>{label} <output htmlFor={id}>{value[key]}{suffix}</output></label>
      <input id={id} type="range" min={min} max={max} step={step} value={value[key]} onChange={e=>set(key,Number(e.target.value))}/>
    </div>;
  return <section className="control-section magic-controls" aria-labelledby="magic-controls-title" data-testid="magic-controls">
    <h3 id="magic-controls-title">魔法陣スタジオ <span aria-hidden="true">✧</span></h3>
    <p className="help">中心対称の専用アルゴリズム。シードを変えても円環と紋様が整うように生成します。</p>
    <label htmlFor="magic-style">魔法陣のスタイル</label>
    <select id="magic-style" value={value.style} onChange={e=>set('style',e.target.value as MagicCircleSettings['style'])}>
      <option value="star">星紋・召喚陣</option>
      <option value="geometric">幾何学・錬成陣</option>
      <option value="crest">紋章・花弁陣</option>
    </select>
    {range('magic-complexity','紋様の複雑さ','complexity',0,100,5,'%')}
    {range('magic-rings','同心円の数','ringCount',2,8)}
    {range('magic-symmetry','対称数','symmetry',3,12)}
    {range('magic-ornaments','装飾密度','ornamentDensity',0,100,5,'%')}
    {range('magic-stroke','魔法陣の線幅','strokeScale',50,200,5,'%')}
    <label htmlFor="magic-rune-style">円環の装飾</label>
    <select id="magic-rune-style" value={value.runeStyle} onChange={e=>set('runeStyle',e.target.value as MagicCircleSettings['runeStyle'])}>
      <option value="runes">オリジナルのルーン風紋様</option>
      <option value="dots">星のドット刻印</option>
      <option value="arcs">曲線の刻印</option>
    </select>
    {range('magic-rotation','アニメ中の円環回転','rotationTurns',0,3,1,'回転')}
    <p className="help">「アニメーション」の成長描画・再生と連動。隣接する円環が反対向きに回ります。0回転なら停止します。</p>
    <div className="magic-export-options">
      <label className="glow-toggle"><input type="checkbox" checked={!value.showBackground}
        onChange={e=>set('showBackground',!e.target.checked)}/> 背景なしでプレビュー</label>
      <label className="glow-toggle"><input type="checkbox" checked={value.transparentExport}
        onChange={e=>set('transparentExport',e.target.checked)}/> 魔法陣だけを透過PNG / SVGで書き出す</label>
    </div>
    <p className="help">透過保存は背景・グリッド・文字を除外し、余白も透明になります。動画は従来どおり背景付きです。</p>
  </section>;
}
