import {HelpInfo} from '../HelpInfo';
import {voidWebDefaults,VOID_ALGORITHM_VERSION,VOID_WEB_VERSION,VOID_WEB_MAX,VOID_WEB_LIMIT,VOID_MOBILE_LIMIT,type VoidSettings} from './void-settings';
import {ThreeRange} from './ThreeControls';
export function VoidModeControls({value,onChange,disabled}:{value?:VoidSettings;onChange:(value:VoidSettings)=>void;disabled:boolean}){
  const mode=value??voidWebDefaults,web=mode.version===VOID_WEB_VERSION;
  return <section className="control-section three-controls" aria-labelledby="void-prototype-heading">
    <h3 id="void-prototype-heading">VOID MODE · コズミックウェブ</h3>
    <label className="three-checkbox"><input type="checkbox" aria-label="VOID MODEを有効化" checked={mode.enabled} disabled={disabled} onChange={event=>onChange({...mode,enabled:event.target.checked})}/> VOID MODE</label>
    <HelpInfo>空洞の間を曲がるフィラメントのグラフを先に作り、既存13種類の図形を配置します。大規模版は多数の結節・環状経路・細い支流を3D空間に生成します。通常3Dの生成器や最近傍での張り直しは使用しません。</HelpInfo>
    {mode.enabled&&<>
      <label htmlFor="void-version">VOIDの構造</label>
      <select id="void-version" disabled={disabled} value={mode.version} onChange={event=>{
        const next={...mode,version:event.target.value as VoidSettings['version']};
        if(next.version===VOID_WEB_VERSION){next.objectLimit=next.objectLimit??VOID_WEB_LIMIT;next.depthFade=next.depthFade??80;}
        else{delete next.objectLimit;delete next.depthFade;}
        onChange(next);
      }}><option value={VOID_WEB_VERSION}>大規模コズミックウェブ</option><option value={VOID_ALGORITHM_VERSION}>小規模プロトタイプ（旧版を再現）</option></select>
      {web&&<fieldset disabled={disabled}>
        <ThreeRange id="void-object-limit" label="VOID描画上限" min={600} max={VOID_WEB_MAX} step={100} value={mode.objectLimit??VOID_WEB_LIMIT} unit="図形" onChange={objectLimit=>onChange({...mode,objectLimit})}/>
        <ThreeRange id="void-depth-fade" label="奥行きの減衰" min={0} max={100} step={5} value={mode.depthFade??80} unit="%" onChange={depthFade=>onChange({...mode,depthFade})}/>
        <p className="help">軽量品質は最大{VOID_MOBILE_LIMIT}図形。自動画質ではスマホとソフトウェア描画を軽量化します。広い視点では簡略描画し、近づくと精度を上げます。密度と上限は候補の表示だけを変え、配置や成長時刻を保持します。高解像度動画と最大規模はPC推奨です。</p>
      </fieldset>}
    </>}
    {mode.enabled&&<p className="help">配線はフィラメントの経路に固定します。光る線と信号は「装飾」で調整できます。VOIDの線設定は通常3Dとは別に保存します。通常の図形間隔と天体への置換は適用せず、浮遊は空洞を守るため控えめにします。</p>}
  </section>;
}
