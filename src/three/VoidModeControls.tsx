import {HelpInfo} from '../HelpInfo';
import {voidDefaults,type VoidSettings} from './void-settings';
export function VoidModeControls({value,onChange,disabled}:{value?:VoidSettings;onChange:(value:VoidSettings)=>void;disabled:boolean}){
  const mode=value??voidDefaults;
  return <section className="control-section three-controls" aria-labelledby="void-prototype-heading">
    <h3 id="void-prototype-heading">VOID MODE · 小規模プロトタイプ</h3>
    <label className="three-checkbox"><input type="checkbox" aria-label="VOID MODEを有効化" checked={mode.enabled} disabled={disabled} onChange={event=>onChange({...mode,enabled:event.target.checked})}/> VOID MODE</label>
    <HelpInfo>空洞を避けて曲がる1〜2本の主要フィラメントを先に生成し、2〜3個の結び目、中継図形、短い枝を配置します。通常3Dの生成器や最近傍接続は使用しません。第1段階は最大35図形に限定し、大規模化は行いません。</HelpInfo>
    {mode.enabled&&<p className="help">配線はフィラメントの経路に固定します。光る線と信号は「装飾」で調整できます。VOIDの線設定は通常3Dとは別に保存します。通常の図形間隔と天体への置換は適用せず、浮遊は空洞を守るため控えめにします。</p>}
  </section>;
}
