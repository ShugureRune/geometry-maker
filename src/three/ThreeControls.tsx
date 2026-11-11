import {HelpInfo} from '../HelpInfo';
import type {ThreeSettings} from './settings';
import {visibilityDefaults,type ThreeVisibilitySettings} from './visibility';
import {entranceDefaults,threeEntranceStyle,type ThreeEntranceSettings} from './entrance';
import {THREE_KINDS,THREE_CLASSIC_KINDS,THREE_NEW_KINDS,THREE_SPACING_DEFAULT,type ThreeKind} from './model';
import {CELESTIAL_KINDS, CELESTIAL_LABELS, celestialDefaults} from './celestial';

export const THREE_KIND_LABELS: Record<ThreeKind,string> = {
  sphere:'球体',cube:'立方体',torus:'トーラス',
  icosahedron:'正二十面体',dodecahedron:'正十二面体',
  octahedron:'正八面体',tetrahedron:'正四面体',
  cylinder:'円柱',cone:'円すい',capsule:'カプセル',
  prism:'三角柱',pyramid:'四角すい','torus-knot':'トーラスノット',
};

type Props = {settings: ThreeSettings; onChange: (settings: ThreeSettings) => void};
export function ThreeRange({id, label, value, min, max, step = .05, unit = '', onChange}: {
  id: string; label: string; value: number; min: number; max: number; step?: number; unit?: string; onChange: (n: number) => void;
}) {
  return <div className="three-range">
    <label htmlFor={id}>{label}</label><output htmlFor={id}>{value.toFixed(step < 1 ? 2 : 0)}{unit}</output>
    <input id={id} type="range" min={min} max={max} step={step} value={value} aria-valuetext={`${value}${unit}`} onChange={event => onChange(Number(event.target.value))}/>
  </div>;
}
export function ThreeShapeControls({settings, onChange}: Props) {
  const celestial = settings.celestial ?? celestialDefaults;
  return <section className="control-section three-controls">
    <h3>3D図形</h3>
    <HelpInfo>13種類の立体から生成します。図形の種類だけ変えても位置・シード・密度は維持されます。</HelpInfo>
    <ThreeRange id="three-spacing" label="図形の間隔" value={settings.spacingPercent??THREE_SPACING_DEFAULT}
      min={50} max={200} step={5} unit="%" onChange={spacingPercent=>onChange({...settings,spacingPercent})}/>
    <HelpInfo>100%が標準（以前の約1.5倍の距離）。約65〜70%で以前に近い間隔です。図形の大きさ自体は変えず、配置を広げます。カメラは向きを保って距離に合わせて調整します。</HelpInfo>
    <fieldset className="three-kind-fieldset"><legend>図形の種類（${(settings.enabledKinds??THREE_KINDS).length}/13）</legend>
      <div className="three-kind-presets">
        <button type="button" onClick={()=>onChange({...settings,enabledKinds:[...THREE_KINDS]})}>全種類</button>
        <button type="button" onClick={()=>onChange({...settings,enabledKinds:[...THREE_CLASSIC_KINDS]})}>従来の7種類</button>
        <button type="button" onClick={()=>onChange({...settings,enabledKinds:[...THREE_NEW_KINDS]})}>新しい6種類</button>
      </div>
      <div className="three-kind-grid" role="group" aria-label="生成する3D図形">
        {THREE_KINDS.map(kind=><label key={kind} className="three-kind-check">
          <input type="checkbox" checked={(settings.enabledKinds??THREE_KINDS).includes(kind)} aria-label={`${THREE_KIND_LABELS[kind]}を生成`}
            onChange={event=>{
              const enabled=settings.enabledKinds??THREE_KINDS;
              onChange({...settings,enabledKinds:event.target.checked?
                THREE_KINDS.filter(k=>k===kind||enabled.includes(k)):enabled.filter(k=>k!==kind)});
            }}/>
          <span>{THREE_KIND_LABELS[kind]}</span>
        </label>)}
      </div>
      {(settings.enabledKinds??THREE_KINDS).length===0&&<p className="help" role="status">すべてOFFです。1種類以上選ぶと図形が表示されます。</p>}
    </fieldset>
    <fieldset className="three-kind-fieldset">
      <legend>星や惑星（6種類）</legend>
      <label className="three-checkbox"><input type="checkbox" aria-label="3D天体を表示" checked={celestial.enabled}
        onChange={event => onChange({...settings, celestial: {...celestial, enabled: event.target.checked}})}/>
        3D空間に天体を追加
      </label>
      <div className="three-kind-presets">
        <button type="button" onClick={() => onChange({...settings, enabledKinds: [],
          celestial: {...celestial, enabled: true, kinds: [...CELESTIAL_KINDS]}})}>天体のみ表示</button>
        <button type="button" onClick={() => onChange({...settings, enabledKinds: [...THREE_KINDS],
          celestial: {...celestial, enabled: true, kinds: [...CELESTIAL_KINDS]}})}>図形＋天体</button>
      </div>
      <div className="three-kind-grid" role="group" aria-label="生成する天体">
        {CELESTIAL_KINDS.map(kind => <label key={kind} className="three-kind-check">
          <input type="checkbox" checked={celestial.kinds.includes(kind)} aria-label={CELESTIAL_LABELS[kind] + 'を生成'}
            onChange={event => onChange({...settings, celestial: {...celestial, enabled: true,
              kinds: event.target.checked ? CELESTIAL_KINDS.filter(k => k === kind || celestial.kinds.includes(k)) :
                celestial.kinds.filter(k => k !== kind)}})}/>
          <span>{CELESTIAL_LABELS[kind]}</span>
        </label>)}
      </div>
      <HelpInfo>5種類の主要天体はほぼ同じ直径、衛星は惑星の約1/4です。ブラックホールには軽量な疑似重力レンズ、中性子星には高速回転する2方向のビームを付けます。天体は既存の13種類と独立して表示されます。</HelpInfo>
    </fieldset>
    <label htmlFor="three-quality">3D描画品質</label>
    <select id="three-quality" value={settings.quality} onChange={event => onChange({...settings, quality: event.target.value as ThreeSettings['quality']})}>
      <option value="auto">自動（スマホは軽量）</option><option value="low">軽量</option><option value="high">高品質</option>
    </select>
    <HelpInfo>軽量設定では解像度・曲面の分割数を抑え、影とブルームを省略します。図形の配置と色は維持します。</HelpInfo>
  </section>;
}
export function ThreeMaterialControls({settings, onChange}: Props) {
  return <section className="control-section three-controls">
    <h3>質感と光</h3>
    <label htmlFor="three-material">マテリアル</label>
    <select id="three-material" value={settings.material} onChange={event => onChange({...settings, material: event.target.value as ThreeSettings['material']})}>
      <option value="theme">テーマに合わせる</option><option value="matte">マット</option><option value="metal">メタル</option><option value="glass">ガラス</option><option value="wireframe">ワイヤーフレーム</option>
    </select>
    <ThreeRange id="three-roughness" label="表面の粗さ" value={settings.roughness} min={0} max={1} onChange={roughness => onChange({...settings, roughness})}/>
    <ThreeRange id="three-metalness" label="金属感" value={settings.metalness} min={0} max={1} onChange={metalness => onChange({...settings, metalness})}/>
    <ThreeRange id="three-light" label="ライトの強さ" value={settings.lightIntensity} min={.1} max={3} step={.1} unit="倍" onChange={lightIntensity => onChange({...settings, lightIntensity})}/>
    <HelpInfo>上の発光強度を共用します。高品質では主役を中心にブルームを適用し、軽量ではマテリアルの自己発光で表現します。</HelpInfo>
  </section>;
}
export function ThreeAnimationControls({settings, onChange, seed, onReplay}: Props&{seed:string;onReplay:()=>void}) {
  const entrance=settings.entrance??entranceDefaults;
  return <section className="control-section three-controls">
    <h3>図形の動き</h3>
    <label className="three-checkbox"><input type="checkbox" aria-label="3Dアニメーションを有効化" checked={settings.animation} onChange={event => onChange({...settings, animation: event.target.checked})}/> 図形を動かす</label>
    <div className="play-buttons"><button type="button" onClick={() => onChange({...settings, animation: !settings.animation})}>{settings.animation ? '3Dを一時停止' : '3Dを再生'}</button></div>
    <ThreeRange id="three-speed" label="動く速さ" value={settings.speed} min={.25} max={4} step={.25} unit="倍" onChange={speed => onChange({...settings, speed})}/>
    <ThreeRange id="three-float" label="浮かぶ大きさ" value={settings.floatAmount} min={0} max={2} step={.1} onChange={floatAmount => onChange({...settings, floatAmount})}/>
    <ThreeRange id="three-rotation" label="回転の大きさ" value={settings.rotationAmount} min={0} max={2} step={.1} onChange={rotationAmount => onChange({...settings, rotationAmount})}/>
    <fieldset className="three-kind-fieldset" data-testid="three-entrance-controls"><legend>最初の登場</legend>
      <label className="three-checkbox"><input type="checkbox" aria-label="3D図形を順番に登場させる" checked={entrance.enabled}
        onChange={event=>onChange({...settings,entrance:{...entrance,enabled:event.target.checked}})}/>
        図形を順番に登場させる</label>
      {entrance.enabled&&<>
        <label htmlFor="three-entrance-mode">登場の仕方</label>
        <select id="three-entrance-mode" value={entrance.mode}
          onChange={e=>onChange({...settings,entrance:{...entrance,mode:e.target.value as ThreeEntranceSettings['mode']}})}>
          <option value="seeded">シードで自動選択</option>
          <option value="fade-scale">フェード＋拡大</option>
          <option value="rise">下から浮上</option>
          <option value="spiral">旋回して集合</option>
          <option value="scatter">散らばった図形が集合</option>
        </select>
        <p className="help" data-testid="three-entrance-style">今回のシードの演出：{({
          'fade-scale':'フェード＋拡大',rise:'下から浮上',spiral:'旋回して集合',scatter:'散らばった図形が集合'
        } as const)[threeEntranceStyle(seed,entrance.mode)]}</p>
        <ThreeRange id="three-entrance-duration" label="登場にかかる時間" value={entrance.duration}
          min={2} max={15} step={1} unit="秒" onChange={duration=>onChange({...settings,entrance:{...entrance,duration}})}/>
        <label className="three-checkbox"><input type="checkbox" aria-label="主役から順番に登場" checked={entrance.stagger}
          onChange={e=>onChange({...settings,entrance:{...entrance,stagger:e.target.checked}})}/>
          主役 → 補助 → 装飾の順に登場</label>
        <button type="button" onClick={onReplay}>3D登場演出を最初から再生</button>
      </>}
      <HelpInfo>2Dと同様に最初の1回だけ登場し、完成後は消えません。ランダムシードを押すと再生し直します。3Dアニメーション停止時は現在の場面で静止します。既存の周期的な出現・消失とは別機能です。</HelpInfo>
    </fieldset>
    <fieldset className="three-kind-fieldset"><legend>くり返し登場・消える</legend>
      <label className="three-checkbox"><input type="checkbox" aria-label="出現・消失アニメーションを有効化" checked={(settings.visibilityAnimation??visibilityDefaults).enabled}
        onChange={event=>onChange({...settings,visibilityAnimation:{...(settings.visibilityAnimation??visibilityDefaults),enabled:event.target.checked}})}/> くり返し登場させる</label>
      {(settings.visibilityAnimation??visibilityDefaults).enabled&&<>
        <label htmlFor="three-visibility-mode">動きの種類</label>
        <select id="three-visibility-mode" value={(settings.visibilityAnimation??visibilityDefaults).mode}
          onChange={event=>onChange({...settings,visibilityAnimation:{...(settings.visibilityAnimation??visibilityDefaults),mode:event.target.value as ThreeVisibilitySettings['mode']}})}>
          <option value="fade">フェード</option><option value="scale">拡大・縮小</option><option value="fade-scale">フェード＋拡大・縮小</option>
        </select>
        <ThreeRange id="three-visibility-duration" label="くり返す間隔" value={(settings.visibilityAnimation??visibilityDefaults).duration}
          min={4} max={30} step={1} unit="秒" onChange={duration=>onChange({...settings,visibilityAnimation:{...(settings.visibilityAnimation??visibilityDefaults),duration}})}/>
        <ThreeRange id="three-visibility-ratio" label="表示する時間の割合" value={(settings.visibilityAnimation??visibilityDefaults).visibleRatio*100}
          min={10} max={90} step={5} unit="%" onChange={visibleRatio=>onChange({...settings,visibilityAnimation:{...(settings.visibilityAnimation??visibilityDefaults),visibleRatio:visibleRatio/100}})}/>
        <label className="three-checkbox"><input type="checkbox" checked={(settings.visibilityAnimation??visibilityDefaults).stagger}
          onChange={event=>onChange({...settings,visibilityAnimation:{...(settings.visibilityAnimation??visibilityDefaults),stagger:event.target.checked}})}/> 図形ごとにタイミングをずらす</label>
        <label className="three-checkbox"><input type="checkbox" checked={(settings.visibilityAnimation??visibilityDefaults).keepPrimaryVisible}
          onChange={event=>onChange({...settings,visibilityAnimation:{...(settings.visibilityAnimation??visibilityDefaults),keepPrimaryVisible:event.target.checked}})}/> 主役図形は常に表示</label>
        <HelpInfo>回転・浮遊と同じ再生時計でループします。ネオン輪郭と接続線も図形に合わせて消えます。再生停止中は現在の状態で静止します。</HelpInfo>
      </>}
    </fieldset>
    <HelpInfo>再生成すると同じ構図の初期姿勢へ戻ります。色・密度・マテリアルの変更では再生時刻をリセットしません。非表示タブでは休止します。</HelpInfo>
  </section>;
}
