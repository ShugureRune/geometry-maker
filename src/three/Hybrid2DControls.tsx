import {HelpInfo} from '../HelpInfo';
import {ThreeRange} from './ThreeControls';
import {hybrid2DDefaults,type Hybrid2DSettings} from './hybrid-2d';
import type {ThreeSettings} from './settings';

export function Hybrid2DControls({settings,onChange,sourceLabel}:{
  settings:ThreeSettings;onChange:(settings:ThreeSettings)=>void;sourceLabel:string;
}){
  const current=settings.hybrid2D??hybrid2DDefaults;
  const update=(patch:Partial<Hybrid2DSettings>)=>
    onChange({...settings,hybrid2D:{...current,...patch}});
  return <section className="control-section three-controls" data-testid="three-hybrid-2d-controls">
    <div className="studio-setting-label studio-setting-heading">
      <h3>2D × 3D ハイブリッド</h3>
      <HelpInfo>現在の2D作品を透明な平面として3D空間に置きます。3Dオブジェクトの手前・奥に入り、視点を回すと平面の厚みがないことも分かります。</HelpInfo>
    </div>
    <label className="three-checkbox">
      <input type="checkbox" aria-label="3D空間に2D図形を合成"
        checked={current.enabled} onChange={e=>update({enabled:e.target.checked})}/>
      2D図形を3D空間に合成する
    </label>
    {current.enabled&&<>
      <p className="help">合成元：{sourceLabel}。2Dモードで図形の種類や魔法陣を変更すると、3Dにも反映されます。文字と2D背景は合成しません。</p>
      <ThreeRange id="hybrid-2d-x" label="左右（X）" value={current.x}
        min={-8} max={8} step={.25} onChange={x=>update({x})}/>
      <ThreeRange id="hybrid-2d-y" label="上下（Y）" value={current.y}
        min={-8} max={8} step={.25} onChange={y=>update({y})}/>
      <ThreeRange id="hybrid-2d-z" label="奥行き（Z）" value={current.z}
        min={-8} max={8} step={.25} onChange={z=>update({z})}/>
      <ThreeRange id="hybrid-2d-size" label="平面の高さ" value={current.size}
        min={1} max={16} step={.25} onChange={size=>update({size})}/>
      <ThreeRange id="hybrid-2d-opacity" label="平面の不透明度" value={current.opacity}
        min={0} max={1} step={.05} onChange={opacity=>update({opacity})}/>
      <label className="three-checkbox">
        <input type="checkbox" aria-label="2D図形をカメラに向ける"
          checked={current.billboard} onChange={e=>update({billboard:e.target.checked})}/>
        常にカメラの方を向く
      </label>
      {!current.billboard&&<>
        <ThreeRange id="hybrid-2d-rotation-x" label="X軸回転" value={current.rotationX}
          min={-180} max={180} step={5} unit="°" onChange={rotationX=>update({rotationX})}/>
        <ThreeRange id="hybrid-2d-rotation-y" label="Y軸回転" value={current.rotationY}
          min={-180} max={180} step={5} unit="°" onChange={rotationY=>update({rotationY})}/>
      </>}
      <ThreeRange id="hybrid-2d-rotation-z" label="平面内の回転" value={current.rotationZ}
        min={-180} max={180} step={5} unit="°" onChange={rotationZ=>update({rotationZ})}/>
      <ThreeRange id="hybrid-2d-spin" label="自転速度" value={current.spinSpeed}
        min={-90} max={90} step={5} unit="°/秒" onChange={spinSpeed=>update({spinSpeed})}/>
      <button type="button" onClick={()=>update({...hybrid2DDefaults,enabled:true})}>2D合成の配置をリセット</button>
      <HelpInfo>奥行き判定は3D空間と共通です。自転は3Dの再生・一時停止と動画書き出し時刻に同期します。描画負荷を抑えるため、合成テクスチャの解像度には上限があります。</HelpInfo>
    </>}
  </section>;
}
