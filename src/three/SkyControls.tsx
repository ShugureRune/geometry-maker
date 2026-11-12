import {HelpInfo} from '../HelpInfo';
import {ThreeRange} from './ThreeControls';
import {WEATHER_TYPES,worldDefaults,type WeatherType,type WorldSettings} from './world-settings';
import {hasTerrainRelief,terrainDefaults,type TerrainSettings} from './terrain';
import {hasOutdoorVisibility,outdoorVisibilityDefaults,SKY_KINDS,SKY_LABELS,SKY_PALETTES,skyDefaults,type SkySettings,type SkyKind,type SkyPalette,type OutdoorVisibilitySettings} from './sky-settings';
import {voidFigureCount} from './void-field';

export function SkyControls({value,onChange}:{value?:SkySettings;onChange:(sky:SkySettings)=>void}){
  const sky=value??skyDefaults;
  const update=(patch:Partial<SkySettings>)=>onChange({...sky,...patch});
  const terrain=sky.terrain??terrainDefaults;
  const updateTerrain=(patch:Partial<TerrainSettings>)=>update({terrain:{...terrain,...patch}});
  const world=sky.world??worldDefaults;
  const updateWorld=(patch:Partial<WorldSettings>)=>update({world:{...world,...patch}});
  const water=['shallow-water','salt-flat','dark-mirror'].includes(sky.kind);
  const visibility=sky.visibility??outdoorVisibilityDefaults;
  const updateVisibility=(patch:Partial<OutdoorVisibilitySettings>)=>update({visibility:{...visibility,...patch}});
  const preset=SKY_PALETTES[sky.kind],palette=sky.colors?.[sky.kind]??preset;
  const outdoor=sky.kind==='shallow-water'||sky.kind==='whiteout-snow'||sky.kind==='foggy-grassland';
  const naturalDensity:Partial<Record<SkyKind,string>>={
    'cosmic-void':'網目状の3D図形の密度',
    'endless-desert':'砂紋の細かさ','salt-flat':'塩の模様・水たまり',
    'moonlit-flowers':'花の密度','forest-edge':'木の密度',
    'twilight-plain':'地表の模様','cloud-sea':'雲の密度',
    'dark-mirror':'波紋の細かさ',
  };
  const naturalMotion:Partial<Record<SkyKind,string>>={
    'cosmic-void':'網目のゆっくりした動き',
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
    <div className="studio-setting-label studio-setting-heading">
      <h3 id="sky-heading">空と景色</h3>
      <HelpInfo>24種類の3D背景に対応。時間帯・太陽光・天候・自然物・探索モードに対応。屋外背景10種類は描画距離を調整でき、霧のON/OFFも切り替えられます。砂漠・白い霧の草原・森の縁は立体的な起伏と斜面の陰影を調整できます。屋外リミナル10種類は人工物のない自然空間です。砂漠・鏡の塩湖・夜の花畑・森の縁・薄明の平原・雲海・黒い水面も追加しました。浅瀬の反射は軽量な疑似反射、雪はゆっくり舞い、草は風で揺れます。3D図形・天体・ネオン・床グリッドと併用でき、背景ごとの3色も保存できます。アニメーションは3D再生・一時停止に連動します。従来の単色・グラデーションも使用できます。</HelpInfo>
    </div>
    <label htmlFor="three-sky-kind">3D背景の種類</label>
    <select id="three-sky-kind" value={sky.kind} onChange={e=>update({kind:e.target.value as SkyKind})}>
      {SKY_KINDS.map(kind=><option value={kind} key={kind}>{SKY_LABELS[kind]}</option>)}
    </select>
    {sky.kind!=='classic'&&<>
      <ThreeRange id="three-sky-intensity" label="景色の明るさ" value={sky.intensity} min={0} max={200}
        step={5} unit="%" onChange={intensity=>update({intensity})}/>
      <ThreeRange id="three-sky-density" label={naturalDensity[sky.kind]??(outdoor?(sky.kind==='shallow-water'?'水面模様の細かさ':sky.kind==='whiteout-snow'?'雪粒子の量':'草の密度'):'星・粒子・模様の密度')} value={sky.density} min={0} max={200}
        step={10} unit="%" onChange={density=>update({density})}/>
      {sky.kind==='cosmic-void'&&<p className="help" role="status" data-testid="void-warning">
        ⚠ 危険区域：VOID MODE — 巨大コアストーン・主役・補助・装飾の4段階で既存3D図形を配置し、短いフィラメントの網目と大きな空洞（ボイド）を作ります。
        背景用の別図形は追加されません。高品質では約{voidFigureCount(sky.density,false).toLocaleString('ja-JP')}個、軽量描画では約{voidFigureCount(sky.density,true).toLocaleString('ja-JP')}個の3D図形に置き換わります。密度が高いほど処理が重くなる場合があります。
      </p>}
      <ThreeRange id="three-sky-motion" label={naturalMotion[sky.kind]??(outdoor?(sky.kind==='shallow-water'?'波の動く速さ':sky.kind==='whiteout-snow'?'雪が舞う速さ':'風の速さ'):'背景が動く速さ')} value={sky.motion} min={0} max={300}
        step={10} unit="%" onChange={motion=>update({motion})}/>
      {hasOutdoorVisibility(sky.kind)&&<fieldset className="three-kind-fieldset">
        <legend>時間と日差し</legend>
        <ThreeRange id="three-world-hour" label="時間帯（0=深夜・6=朝・12=昼・18=夕方）"
          value={world.timeOfDay} min={0} max={24} step={1} unit="時"
          onChange={timeOfDay=>updateWorld({timeOfDay})}/>
        <ThreeRange id="three-world-sun" label="日差しの強さ"
          value={world.sunStrength} min={0} max={200} step={10} unit="%"
          onChange={sunStrength=>updateWorld({sunStrength})}/>
      </fieldset>}
      {hasOutdoorVisibility(sky.kind)&&<fieldset className="three-kind-fieldset">
        <legend>自然と天気</legend>
        <ThreeRange id="three-world-nature" label="草・花・岩などの密度"
          value={world.natureDensity} min={0} max={200} step={10} unit="%"
          onChange={natureDensity=>updateWorld({natureDensity})}/>
        <ThreeRange id="three-world-clouds" label="立体雲の量"
          value={world.cloudAmount} min={0} max={200} step={10} unit="%"
          onChange={cloudAmount=>updateWorld({cloudAmount})}/>
        <label htmlFor="three-world-weather">天候</label>
        <select id="three-world-weather" value={world.weather}
          onChange={e=>updateWorld({weather:e.target.value as WeatherType})}>
          {WEATHER_TYPES.map(kind=><option key={kind} value={kind}>{({
            clear:'晴れ',rain:'雨',snow:'雪',storm:'嵐',
          } as Record<WeatherType,string>)[kind]}</option>)}
        </select>
        {world.weather!=='clear'&&<ThreeRange id="three-world-weather-strength" label="天候の強さ"
          value={world.weatherStrength} min={0} max={200} step={10} unit="%"
          onChange={weatherStrength=>updateWorld({weatherStrength})}/>}
      </fieldset>}
      {water&&<fieldset className="three-kind-fieldset">
        <legend>水の見た目</legend>
        <ThreeRange id="three-world-water-reflection" label="空の反射の強さ"
          value={world.waterReflection} min={0} max={200} step={10} unit="%"
          onChange={waterReflection=>updateWorld({waterReflection})}/>
        <ThreeRange id="three-world-water-waves" label="水面の波・揺らぎ"
          value={world.waterWaves} min={0} max={200} step={10} unit="%"
          onChange={waterWaves=>updateWorld({waterWaves})}/>
        <HelpInfo>リアルタイムの空色・光の方向を使った軽量な水面反射です。実際の図形・山を鏡写しにするフルシーン反射とは異なります。</HelpInfo>
      </fieldset>}
      {hasOutdoorVisibility(sky.kind)&&<fieldset className="three-kind-fieldset">
        <legend>自由に歩く</legend>
        <label className="three-checkbox" htmlFor="three-world-explore">
          <input id="three-world-explore" type="checkbox" checked={world.explore}
            onChange={e=>updateWorld({explore:e.target.checked})}/> 自由探索モードを有効化
        </label>
        <ThreeRange id="three-world-explore-speed" label="歩く速さ"
          value={world.exploreSpeed} min={1} max={20} step={1} unit="倍"
          onChange={exploreSpeed=>updateWorld({exploreSpeed})}/>
        <HelpInfo>PCでは画面クリックでマウス視点操作、WASDで移動、Space/Shiftで上下移動。Escでマウス操作を解除。スマホでは画面上の矢印で移動・回転できます。</HelpInfo>
      </fieldset>}
      {hasOutdoorVisibility(sky.kind)&&<fieldset className="three-kind-fieldset">
        <legend>遠くの見え方</legend>
        <ThreeRange id="three-outdoor-view-distance" label="描画距離" value={visibility.distance}
          min={100} max={1000} step={50} unit="%" onChange={distance=>updateVisibility({distance})}/>
        <label htmlFor="three-outdoor-fog-enabled">
          <input id="three-outdoor-fog-enabled" type="checkbox" checked={visibility.fogEnabled}
            onChange={e=>updateVisibility({fogEnabled:e.target.checked})}/>
          距離による霧を表示する
        </label>
        <HelpInfo>距離を増やすと遠くの地面まで描画します。霧OFFでは遠景がくっきり見え、表示距離の端だけを目立たないように処理します。スマホでは遠方の地形を軽量なメッシュで描画します。</HelpInfo>
      </fieldset>}
      {hasTerrainRelief(sky.kind)&&<fieldset className="three-kind-fieldset">
        <legend>地面の形</legend>
        <ThreeRange id="three-terrain-relief" label="地形の起伏" value={terrain.relief}
          min={0} max={200} step={10} unit="%" onChange={relief=>updateTerrain({relief})}/>
        <ThreeRange id="three-terrain-detail" label="地形の細かさ" value={terrain.detail}
          min={0} max={200} step={10} unit="%" onChange={detail=>updateTerrain({detail})}/>
        <label htmlFor="three-terrain-flat-center">
          <input id="three-terrain-flat-center" type="checkbox" checked={terrain.flatCenter}
            onChange={e=>updateTerrain({flatCenter:e.target.checked})}/>
          中央を平坦にする（図形の周辺を保護）
        </label>
        <HelpInfo>地面を本当に立体的に変形させます。0%は平面、100%は自然な起伏、200%は大きな砂丘・丘。中央を平坦にすると図形の近くは変形せず、遠くから丘になります。</HelpInfo>
      </fieldset>}
      <fieldset className="three-kind-fieldset"><legend>景色の色</legend>
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

  </section>;
}
