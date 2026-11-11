import {ThreeRange} from './ThreeControls';
import {hasTerrainRelief,terrainDefaults,type TerrainSettings} from './terrain';
import {hasOutdoorVisibility,outdoorVisibilityDefaults,SKY_KINDS,SKY_LABELS,SKY_PALETTES,skyDefaults,type SkySettings,type SkyKind,type SkyPalette,type OutdoorVisibilitySettings} from './sky-settings';

export function SkyControls({value,onChange}:{value?:SkySettings;onChange:(sky:SkySettings)=>void}){
  const sky=value??skyDefaults;
  const update=(patch:Partial<SkySettings>)=>onChange({...sky,...patch});
  const terrain=sky.terrain??terrainDefaults;
  const updateTerrain=(patch:Partial<TerrainSettings>)=>update({terrain:{...terrain,...patch}});
  const visibility=sky.visibility??outdoorVisibilityDefaults;
  const updateVisibility=(patch:Partial<OutdoorVisibilitySettings>)=>update({visibility:{...visibility,...patch}});
  const preset=SKY_PALETTES[sky.kind],palette=sky.colors?.[sky.kind]??preset;
  const outdoor=sky.kind==='shallow-water'||sky.kind==='whiteout-snow'||sky.kind==='foggy-grassland';
  const naturalDensity:Partial<Record<SkyKind,string>>={
    'endless-desert':'砂紋の細かさ','salt-flat':'塩の模様・水たまり',
    'moonlit-flowers':'花の密度','forest-edge':'木の密度',
    'twilight-plain':'地表の模様','cloud-sea':'雲の密度',
    'dark-mirror':'波紋の細かさ',
  };
  const naturalMotion:Partial<Record<SkyKind,string>>={
    'endless-desert':'砂の流れ','salt-flat':'水面の揺れ',
    'moonlit-flowers':'花の揺れ','forest-edge':'霧の流れ',
    'twilight-plain':'霞の流れ','cloud-sea':'雲の流れ',
    'dark-mirror':'水面の揺れ',
  };
  const updatePalette=(key:keyof SkyPalette,color:string)=>{
    update({colors:{...sky.colors,[sky.kind]:{...palette,[key]:color}}});
  };
  const resetPalette=()=>{
    const next={...sky.colors};delete next[sky.kind];
    update({colors:next});
  };
  return <section className="control-section three-controls" aria-labelledby="sky-heading">
    <h3 id="sky-heading">3D空間の背景（18種類）</h3>
    <label htmlFor="three-sky-kind">3D背景の種類</label>
    <select id="three-sky-kind" value={sky.kind} onChange={e=>update({kind:e.target.value as SkyKind})}>
      {SKY_KINDS.map(kind=><option value={kind} key={kind}>{SKY_LABELS[kind]}</option>)}
    </select>
    {sky.kind!=='classic'&&<>
      <ThreeRange id="three-sky-intensity" label="背景エフェクトの強さ" value={sky.intensity} min={0} max={200}
        step={5} unit="%" onChange={intensity=>update({intensity})}/>
      <ThreeRange id="three-sky-density" label={naturalDensity[sky.kind]??(outdoor?(sky.kind==='shallow-water'?'水面模様の細かさ':sky.kind==='whiteout-snow'?'雪粒子の量':'草の密度'):'星・粒子・模様の密度')} value={sky.density} min={0} max={200}
        step={10} unit="%" onChange={density=>update({density})}/>
      <ThreeRange id="three-sky-motion" label={naturalMotion[sky.kind]??(outdoor?(sky.kind==='shallow-water'?'波の動く速さ':sky.kind==='whiteout-snow'?'雪が舞う速さ':'風の速さ'):'背景が動く速さ')} value={sky.motion} min={0} max={300}
        step={10} unit="%" onChange={motion=>update({motion})}/>
      {hasOutdoorVisibility(sky.kind)&&<fieldset className="three-kind-fieldset">
        <legend>屋外の描画距離・霧</legend>
        <ThreeRange id="three-outdoor-view-distance" label="描画距離" value={visibility.distance}
          min={100} max={1000} step={50} unit="%" onChange={distance=>updateVisibility({distance})}/>
        <label htmlFor="three-outdoor-fog-enabled">
          <input id="three-outdoor-fog-enabled" type="checkbox" checked={visibility.fogEnabled}
            onChange={e=>updateVisibility({fogEnabled:e.target.checked})}/>
          距離による霧を表示する
        </label>
        <p className="help">距離を増やすと遠くの地面まで描画します。霧OFFでは遠景がくっきり見え、表示距離の端だけを目立たないように処理します。スマホでは遠方の地形を軽量なメッシュで描画します。</p>
      </fieldset>}
      {hasTerrainRelief(sky.kind)&&<fieldset className="three-kind-fieldset">
        <legend>3D地形の起伏</legend>
        <ThreeRange id="three-terrain-relief" label="地形の起伏" value={terrain.relief}
          min={0} max={200} step={10} unit="%" onChange={relief=>updateTerrain({relief})}/>
        <ThreeRange id="three-terrain-detail" label="地形の細かさ" value={terrain.detail}
          min={0} max={200} step={10} unit="%" onChange={detail=>updateTerrain({detail})}/>
        <label htmlFor="three-terrain-flat-center">
          <input id="three-terrain-flat-center" type="checkbox" checked={terrain.flatCenter}
            onChange={e=>updateTerrain({flatCenter:e.target.checked})}/>
          中央を平坦にする（図形の周辺を保護）
        </label>
        <p className="help">地面を本当に立体的に変形させます。0%は平面、100%は自然な起伏、200%は大きな砂丘・丘。中央を平坦にすると図形の近くは変形せず、遠くから丘になります。</p>
      </fieldset>}
      <fieldset className="three-kind-fieldset"><legend>背景の色をカスタマイズ</legend>
        {([['base','背景の暗い色'],['accent','メインの発光色'],['highlight','ハイライト色']] as const).map(([key,label])=>
          <div key={key} className="three-sky-color-row">
            <label htmlFor={`three-sky-color-${key}`}>{label}</label>
            <input id={`three-sky-color-${key}`} type="color" value={palette[key]}
              aria-label={label} onChange={e=>updatePalette(key,e.target.value)}/>
            <output>{palette[key]}</output>
          </div>)}
        <button type="button" onClick={resetPalette} disabled={!sky.colors?.[sky.kind]}>この背景の標準色に戻す</button>
      </fieldset>
    </>}
    <p className="help">18種類の3D背景に対応。屋外背景10種類は描画距離を調整でき、霧のON/OFFも切り替えられます。砂漠・白い霧の草原・森の縁は立体的な起伏と斜面の陰影を調整できます。屋外リミナル10種類は人工物のない自然空間です。砂漠・鏡の塩湖・夜の花畑・森の縁・薄明の平原・雲海・黒い水面も追加しました。浅瀬の反射は軽量な疑似反射、雪はゆっくり舞い、草は風で揺れます。3D図形・天体・ネオン・床グリッドと併用でき、背景ごとの3色も保存できます。アニメーションは3D再生・一時停止に連動します。従来の単色・グラデーションも使用できます。</p>
  </section>;
}
