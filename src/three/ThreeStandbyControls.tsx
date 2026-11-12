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
    <div className="studio-setting-label studio-setting-heading">
      <h3 id="three-standby-heading">自動切り替え</h3>
      <HelpInfo>
      入れ替えでは今の図形が消えてから次の図形が登場します。
      なめらか変化では似た図形同士が移動・変形・色変化し、余った図形は縮小して消え、
      増えた図形は縮小状態から登場します。接続線がある場合は、古い線を先に収納し、図形が移動・変形してから新しい線を張り直します。既存の3D登場・回転設定は保持します。
    </HelpInfo>
    </div>
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
      <div className="studio-setting-label studio-setting-heading">
        <h3>カメラの自動回転</h3>
        <HelpInfo>待機中にカメラが現在の視点から図形の周りをゆっくり回ります。ONにしても急に視点は移動しません。手動で回転・ズームすると一時停止し、その位置から再開します。3Dの一時停止中・自由に歩くモード・動画の書き出し中は回転しません。「斜め周回」では衛星の公転面のように水平から10°傾いた軌道を選べます。傾きは5〜30°で変更でき、切り替えても現在の視点から滑らかにつながります。</HelpInfo>
      </div>
      <label className="three-checkbox">
        <input type="checkbox" aria-label="待機中にカメラを自動回転"
          checked={standby.cameraAutoRotate}
          onChange={e=>update({cameraAutoRotate:e.target.checked})}/>
        カメラをゆっくり回す
      </label>
      {standby.cameraAutoRotate&&<>
        <label htmlFor="three-standby-orbit-mode">周回の仕方</label>
        <select id="three-standby-orbit-mode" value={standby.cameraOrbitMode}
          onChange={event=>update({cameraOrbitMode:event.target.value as ThreeStandbySettings['cameraOrbitMode']})}>
          <option value="horizontal">水平周回（従来）</option>
          <option value="inclined">斜め周回（衛星のように上下する）</option>
        </select>
        {standby.cameraOrbitMode==='inclined'&&
          <ThreeRange id="three-standby-camera-tilt" label="公転面の傾き"
            value={standby.cameraOrbitTilt} min={5} max={30} step={5} unit="°"
            onChange={cameraOrbitTilt=>update({cameraOrbitTilt})}/>}
        <ThreeRange id="three-standby-camera-speed" label="カメラが回る速さ"
          value={standby.cameraRotateSpeed} min={.25} max={3} step={.25} unit="倍"
          onChange={cameraRotateSpeed=>update({cameraRotateSpeed})}/>
      </>}

      <button type="button" className="three-standby-next" disabled={transitioning||exporting}
        onClick={onNext} aria-label="今すぐ次の3Dシードへ">今すぐ切り替え</button>
      <p role="status" data-testid="three-standby-status" className="help">
        {transitioning?'切り替えアニメーション中…':
          exporting?'書き出し中は自動切り替えを停止しています。':
          !settings.animation?'3Dアニメーション一時停止中。シードも切り替わりません。':
          '自動再生中。現在の3D構図が完成してから切り替わります。'}
      </p>
    </>}

  </section>;
}
