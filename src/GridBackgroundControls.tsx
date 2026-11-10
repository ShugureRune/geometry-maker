import {gridAnimationDefaults,type GridAnimationSettings,type GridBackgroundSettings} from './grid-background';

export function GridBackgroundControls({value,onChange}:{value:GridBackgroundSettings;onChange:(value:GridBackgroundSettings)=>void}) {
  const update=(patch:Partial<GridBackgroundSettings>)=>onChange({...value,...patch});
  const motion=value.animation??gridAnimationDefaults;
  const updateMotion=(patch:Partial<GridAnimationSettings>)=>update({animation:{...motion,...patch}});
  const range=(id:string,label:string,min:number,max:number,step:number,key:'spacing'|'thickness'|'opacity'|'glow'|'rotation',suffix='')=>
    <><label className="range-label" htmlFor={id}>{label} <output htmlFor={id}>{value[key]}{suffix}</output></label>
    <input id={id} type="range" min={min} max={max} step={step} value={value[key]} onChange={event=>update({[key]:Number(event.target.value)})}/></>;
  return <section className="control-section grid-background-controls" aria-labelledby="grid-background-heading">
    <h3 id="grid-background-heading">2Dグリッド背景</h3>
    <label className="glow-toggle"><input type="checkbox" checked={value.enabled}
      onChange={event=>update({enabled:event.target.checked})}/> グリッド背景を有効化</label>
    {value.enabled&&<>
      <label htmlFor="grid-background-type">種類</label>
      <select id="grid-background-type" value={value.type} onChange={event=>update({type:event.target.value as GridBackgroundSettings['type']})}>
        <option value="line">方眼グリッド</option><option value="dot">ドットグリッド</option>
      </select>
      {range('grid-spacing','間隔',16,200,4,'spacing','px')}
      {range('grid-thickness',value.type==='dot'?'ドット半径':'線の太さ',.5,8,.5,'thickness','px')}
      {range('grid-opacity','不透明度',0,100,1,'opacity','%')}
      {range('grid-glow','発光',0,100,5,'glow','%')}
      {range('grid-rotation','回転角度',-180,180,1,'rotation','°')}
      <label htmlFor="grid-color-mode">グリッドの色</label>
      <select id="grid-color-mode" value={value.colorMode} onChange={event=>update({colorMode:event.target.value as GridBackgroundSettings['colorMode']})}>
        <option value="auto">背景に合わせる</option><option value="custom">カスタム</option>
      </select>
      {value.colorMode==='custom'&&<label htmlFor="grid-color">カスタム色
        <input id="grid-color" type="color" value={value.color} onChange={event=>update({color:event.target.value})}/>
      </label>}
      <fieldset className="grid-animation-settings"><legend>グリッドアニメーション</legend>
        <label className="glow-toggle"><input type="checkbox" checked={motion.enabled} onChange={event=>updateMotion({enabled:event.target.checked})}/> グリッドアニメーションを有効化</label>
        {motion.enabled&&<>
          <label htmlFor="grid-animation-mode">動き方</label>
          <select id="grid-animation-mode" value={motion.mode} onChange={event=>updateMotion({mode:event.target.value as GridAnimationSettings['mode']})}>
            <option value="scroll">スクロール</option><option value="rotate">回転</option><option value="pulse">明滅</option>
          </select>
          <label className="range-label" htmlFor="grid-animation-duration">1周期の長さ <output htmlFor="grid-animation-duration">{motion.duration}秒</output></label>
          <input id="grid-animation-duration" type="range" min="2" max="30" step="1" value={motion.duration} onChange={event=>updateMotion({duration:Number(event.target.value)})}/>
          {motion.mode==='scroll'&&<>
            <label className="range-label" htmlFor="grid-animation-speed">グリッドのスクロール速度 <output htmlFor="grid-animation-speed">{(motion.speed??1).toFixed(1)}倍</output></label>
            <input id="grid-animation-speed" type="range" min="0.1" max="10" step="0.1" value={motion.speed??1} onChange={event=>updateMotion({speed:Number(event.target.value)})}/>
            <p className="help">スクロール方向は図形に合わせます。無限スクロールの角度は「アニメーション」タブで調整できます。速度は図形と独立です。</p>
          </>}
          {motion.mode==='rotate'&&<label className="glow-toggle"><input type="checkbox" checked={motion.reverse} onChange={event=>updateMotion({reverse:event.target.checked})}/> 反時計回り</label>}
          <p className="help">図形の成長とは独立してループします。動画・待機画面にも反映されます。</p>
        </>}
      </fieldset>
    </>}
    <p className="help">背景色の上・図形の下に描画します。SVG・PNG・動画の書き出しにも反映されます。</p>
  </section>;
}
