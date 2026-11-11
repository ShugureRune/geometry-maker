import {HelpInfo} from '../HelpInfo';
import type {ThreeSettings} from './settings';
import {standbyDefaults,type ThreeStandbySettings} from './standby';
import {ThreeRange} from './ThreeControls';

type Props={
  settings:ThreeSettings;
  onChange:(settings:ThreeSettings)=>void;
  onNext:()=>void;
  transitioning:boolean;
  exporting:boolean;
};
export function ThreeStandbyControls({settings,onChange,onNext,transitioning,exporting}:Props){
  const standby=settings.standby??standbyDefaults;
  const update=(part:Partial<ThreeStandbySettings>)=>
    onChange({...settings,standby:{...standby,...part}});
  return <section className="control-section three-controls three-standby-controls"
    aria-labelledby="three-standby-heading" data-testid="three-standby-controls">
    <h3 id="three-standby-heading">自動切り替え</h3>
    <label className="three-checkbox">
      <input type="checkbox" aria-label="3D待機画面モードを有効化" checked={standby.enabled}
        onChange={e=>onChange({...settings,animation:e.target.checked?true:settings.animation,
          standby:{...standby,enabled:e.target.checked}})}/>
      時間ごとに新しい図形へ
    </label>
    {standby.enabled&&<>
      <ThreeRange id="three-standby-interval" label="切り替え間隔" value={standby.intervalSeconds}
        min={5} max={120} step={5} unit="秒" onChange={intervalSeconds=>update({intervalSeconds})}/>
      <label htmlFor="three-standby-mode">切り替え方</label>
      <select id="three-standby-mode" value={standby.mode}
        onChange={e=>update({mode:e.target.value as ThreeStandbySettings['mode']})}>
        <option value="exit-enter">入れ替え（消えてから新しく登場）</option>
        <option value="morph">なめらか変化（形・色・位置）</option>
      </select>
      <ThreeRange id="three-standby-transition" label="変化にかかる時間"
        value={standby.transitionSeconds} min={1} max={8} step={1} unit="秒"
        onChange={transitionSeconds=>update({transitionSeconds})}/>
      <label className="three-checkbox">
        <input type="checkbox" checked={standby.preserveCamera}
          onChange={e=>update({preserveCamera:e.target.checked})}/>
        視点をそのまま使う
      </label>
      <label className="three-checkbox">
        <input type="checkbox" checked={standby.pauseOnInteraction}
          onChange={e=>update({pauseOnInteraction:e.target.checked})}/>
        操作している間は止める
      </label>
      <button type="button" className="three-standby-next" disabled={transitioning||exporting}
        onClick={onNext} aria-label="今すぐ次の3Dシードへ">今すぐ切り替え</button>
      <p role="status" data-testid="three-standby-status" className="help">
        {transitioning?'切り替えアニメーション中…':
          exporting?'書き出し中は自動切り替えを停止しています。':
          !settings.animation?'3Dアニメーション一時停止中。シードも切り替わりません。':
          '自動再生中。現在の3D構図が完成してから切り替わります。'}
      </p>
    </>}
    <HelpInfo>
      退場→登場では現在の図形が登場演出を逆再生してから次の図形が出現。
      モーフでは似た図形同士が移動・変形・色変化し、余った図形は縮小消滅、
      増えた図形は縮小状態から登場します。既存の3D登場・回転設定は保持します。
    </HelpInfo>
  </section>;
}
