import type {ThreeSettings} from './settings';

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
    <p className="help">球体・立方体・トーラス・正四面体・正八面体・正十二面体・正二十面体をシードから生成します。2Dの生成アルゴリズムとは独立しています。</p>
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
    <p className="help">再生成すると同じ構図の初期姿勢へ戻ります。色・密度・マテリアルの変更では再生時刻をリセットしません。非表示タブでは休止します。</p>
  </section>;
}
