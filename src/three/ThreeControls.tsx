import type {ThreeSettings} from './settings';
import {visibilityDefaults,type ThreeVisibilitySettings} from './visibility';
import {THREE_KINDS,THREE_CLASSIC_KINDS,THREE_NEW_KINDS,type ThreeKind} from './model';

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
  return <section className="control-section three-controls">
    <h3>3D構図 · 3d-v1</h3>
    <p className="help">13種類の立体から生成します。図形の種類だけ変えても位置・シード・密度は維持されます。</p>
    <fieldset className="three-kind-fieldset"><legend>生成する3D図形（${(settings.enabledKinds??THREE_KINDS).length}/13種類）</legend>
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
    <label htmlFor="three-quality">3D描画品質</label>
    <select id="three-quality" value={settings.quality} onChange={event => onChange({...settings, quality: event.target.value as ThreeSettings['quality']})}>
      <option value="auto">自動（スマホは軽量）</option><option value="low">軽量</option><option value="high">高品質</option>
    </select>
    <p className="help">軽量設定では解像度・曲面の分割数を抑え、影とブルームを省略します。図形の配置と色は維持します。</p>
  </section>;
}
export function ThreeMaterialControls({settings, onChange}: Props) {
  return <section className="control-section three-controls">
    <h3>3Dマテリアル・ライティング</h3>
    <label htmlFor="three-material">マテリアル</label>
    <select id="three-material" value={settings.material} onChange={event => onChange({...settings, material: event.target.value as ThreeSettings['material']})}>
      <option value="theme">テーマに合わせる</option><option value="matte">マット</option><option value="metal">メタル</option><option value="glass">ガラス</option><option value="wireframe">ワイヤーフレーム</option>
    </select>
    <ThreeRange id="three-roughness" label="表面の粗さ" value={settings.roughness} min={0} max={1} onChange={roughness => onChange({...settings, roughness})}/>
    <ThreeRange id="three-metalness" label="金属感" value={settings.metalness} min={0} max={1} onChange={metalness => onChange({...settings, metalness})}/>
    <ThreeRange id="three-light" label="ライトの強さ" value={settings.lightIntensity} min={.1} max={3} step={.1} unit="倍" onChange={lightIntensity => onChange({...settings, lightIntensity})}/>
    <p className="help">上の発光強度を共用します。高品質では主役を中心にブルームを適用し、軽量ではマテリアルの自己発光で表現します。</p>
  </section>;
}
export function ThreeAnimationControls({settings, onChange}: Props) {
  return <section className="control-section three-controls">
    <h3>3D 回転・浮遊</h3>
    <label className="three-checkbox"><input type="checkbox" checked={settings.animation} onChange={event => onChange({...settings, animation: event.target.checked})}/> 3Dアニメーションを有効化</label>
    <div className="play-buttons"><button type="button" onClick={() => onChange({...settings, animation: !settings.animation})}>{settings.animation ? '3Dを一時停止' : '3Dを再生'}</button></div>
    <ThreeRange id="three-speed" label="3D再生速度" value={settings.speed} min={.25} max={4} step={.25} unit="倍" onChange={speed => onChange({...settings, speed})}/>
    <ThreeRange id="three-float" label="3D浮遊量" value={settings.floatAmount} min={0} max={2} step={.1} onChange={floatAmount => onChange({...settings, floatAmount})}/>
    <ThreeRange id="three-rotation" label="3D回転量" value={settings.rotationAmount} min={0} max={2} step={.1} onChange={rotationAmount => onChange({...settings, rotationAmount})}/>
    <fieldset className="three-kind-fieldset"><legend>3D出現・消失アニメーション</legend>
      <label className="three-checkbox"><input type="checkbox" checked={(settings.visibilityAnimation??visibilityDefaults).enabled}
        onChange={event=>onChange({...settings,visibilityAnimation:{...(settings.visibilityAnimation??visibilityDefaults),enabled:event.target.checked}})}/> 出現・消失アニメーションを有効化</label>
      {(settings.visibilityAnimation??visibilityDefaults).enabled&&<>
        <label htmlFor="three-visibility-mode">登場・消失の演出</label>
        <select id="three-visibility-mode" value={(settings.visibilityAnimation??visibilityDefaults).mode}
          onChange={event=>onChange({...settings,visibilityAnimation:{...(settings.visibilityAnimation??visibilityDefaults),mode:event.target.value as ThreeVisibilitySettings['mode']}})}>
          <option value="fade">フェード</option><option value="scale">拡大・縮小</option><option value="fade-scale">フェード＋拡大・縮小</option>
        </select>
        <ThreeRange id="three-visibility-duration" label="出現・消失の周期" value={(settings.visibilityAnimation??visibilityDefaults).duration}
          min={4} max={30} step={1} unit="秒" onChange={duration=>onChange({...settings,visibilityAnimation:{...(settings.visibilityAnimation??visibilityDefaults),duration}})}/>
        <ThreeRange id="three-visibility-ratio" label="表示している割合" value={(settings.visibilityAnimation??visibilityDefaults).visibleRatio*100}
          min={10} max={90} step={5} unit="%" onChange={visibleRatio=>onChange({...settings,visibilityAnimation:{...(settings.visibilityAnimation??visibilityDefaults),visibleRatio:visibleRatio/100}})}/>
        <label className="three-checkbox"><input type="checkbox" checked={(settings.visibilityAnimation??visibilityDefaults).stagger}
          onChange={event=>onChange({...settings,visibilityAnimation:{...(settings.visibilityAnimation??visibilityDefaults),stagger:event.target.checked}})}/> 図形ごとにタイミングをずらす</label>
        <label className="three-checkbox"><input type="checkbox" checked={(settings.visibilityAnimation??visibilityDefaults).keepPrimaryVisible}
          onChange={event=>onChange({...settings,visibilityAnimation:{...(settings.visibilityAnimation??visibilityDefaults),keepPrimaryVisible:event.target.checked}})}/> 主役図形は常に表示</label>
        <p className="help">回転・浮遊と同じ再生時計でループします。ネオン輪郭と接続線も図形に合わせて消えます。再生停止中は現在の状態で静止します。</p>
      </>}
    </fieldset>
    <p className="help">再生成すると同じ構図の初期姿勢へ戻ります。色・密度・マテリアルの変更では再生時刻をリセットしません。非表示タブでは休止します。</p>
  </section>;
}
