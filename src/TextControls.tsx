import type {TextOverlaySettings} from './text-overlay';
type Props={settings:TextOverlaySettings;onChange:(next:TextOverlaySettings)=>void};
type NumberKey='fontSize'|'opacity'|'x'|'y'|'rotation'|'strokeWidth'|'shadowBlur'|'glowStrength'|'glowBlur';
type ColorKey='color'|'strokeColor'|'shadowColor'|'glowColor';
export function TextControls({settings,onChange}:Props){
 const update=<K extends keyof TextOverlaySettings>(key:K,value:TextOverlaySettings[K])=>onChange({...settings,[key]:value});
 const range=(key:NumberKey,label:string,min:number,max:number,step=1,unit='')=><div className="text-control-range">
  <label htmlFor={`text-${key}`}>{label} <output htmlFor={`text-${key}`}>{settings[key]}{unit}</output></label>
  <input id={`text-${key}`} type="range" min={min} max={max} step={step} value={settings[key]}
   onChange={e=>update(key,Number(e.target.value))}/>
 </div>;
 const color=(key:ColorKey,label:string)=><label className="text-color-input">{label}
  <input type="color" value={settings[key]} onChange={e=>update(key,e.target.value)}/>
 </label>;
 return <section className="control-section text-controls" aria-labelledby="text-settings-heading">
  <div className="section-heading"><h3 id="text-settings-heading">文字を配置</h3><span className="tiny-label">TEXT OVERLAY</span></div>
  <label className="text-checkbox"><input type="checkbox" checked={settings.enabled} onChange={e=>update('enabled',e.target.checked)}/> 文字を表示</label>
  <label htmlFor="overlay-text">表示する文字</label>
  <textarea id="overlay-text" rows={3} maxLength={2000} value={settings.text}
   onChange={e=>update('text',e.target.value.split('\n').slice(0,12).join('\n'))}
   placeholder="ここにタイトルを入力（改行OK）"/>
  <p className="help">1つのテキストを配置します。最大2000文字・12行。文字は図形のシードを変更しません。</p>
  <label htmlFor="text-font-family">フォント</label>
  <select id="text-font-family" value={settings.fontFamily} onChange={e=>update('fontFamily',e.target.value as TextOverlaySettings['fontFamily'])}>
   <option value="sans-serif">ゴシック体</option><option value="serif">明朝体</option><option value="monospace">等幅フォント</option>
  </select>
  <label className="text-checkbox"><input type="checkbox" checked={settings.bold} onChange={e=>update('bold',e.target.checked)}/> 太字にする</label>
  {range('fontSize','文字サイズ',12,250,1)}
  <label htmlFor="text-color-mode">文字色のモード</label>
  <select id="text-color-mode" value={settings.colorMode??'solid'}
   onChange={e=>update('colorMode',e.target.value as TextOverlaySettings['colorMode'])}>
   <option value="solid">単色（手動）</option>
   <option value="primary">主役色に連動</option>
   <option value="support">補助色に連動</option>
   <option value="accent">アクセント色に連動</option>
   <option value="gradient">図形カラーのグラデーション</option>
  </select>
  {settings.colorMode==='solid'?color('color','文字色'):<p className="help">
   図形のカラー・テーマ・画像から適用した色と連動します。グラデーションの向きは背景設定と合わせます。
  </p>}
  <div className="text-hollow-controls">
   <label htmlFor="text-fill-mode">文字の塗り</label>
   <select id="text-fill-mode" value={settings.fillMode??'solid'} onChange={e=>{
    const transparent=e.target.value==='transparent';
    onChange({...settings,fillMode:e.target.value as TextOverlaySettings['fillMode'],
     ...(transparent?{strokeEnabled:true,strokeColorMode:'text' as const,glowTarget:'outline' as const}:{})});
   }}>
    <option value="solid">通常（中身あり）</option>
    <option value="transparent">透明（中抜き・輪郭のみ）</option>
   </select>
   <button type="button" className="text-neon-preset" onClick={()=>onChange({
    ...settings,enabled:true,fillMode:'transparent',strokeEnabled:true,strokeColorMode:'text',
    glowEnabled:true,glowTarget:'outline',glowColorMode:'text',strokeWidth:Math.max(3,settings.strokeWidth),
    glowStrength:Math.max(100,settings.glowStrength),glowBlur:Math.max(8,settings.glowBlur),shadowEnabled:false
   })}>✨ 中抜きネオンを一発設定</button>
   <p className="help">中抜きでは文字の内側を透明にします。図形の線が文字の中を透けて見えるデザインにできます。</p>
  </div>
  {range('opacity','不透明度',0,100,1,'%')}
  <h3>位置と重なり順</h3>
  <div className="text-control-columns">
   {range('x','横位置',0,100,1,'%')}
   {range('y','縦位置',0,100,1,'%')}
  </div>
  <label htmlFor="text-align">横揃え</label>
  <select id="text-align" value={settings.align} onChange={e=>update('align',e.target.value as TextOverlaySettings['align'])}>
   <option value="left">左揃え</option><option value="center">中央揃え</option><option value="right">右揃え</option>
  </select>
  {range('rotation','回転',-180,180,1,'°')}
  <label htmlFor="text-layer">文字の重なり順</label>
  <select id="text-layer" value={settings.layer} onChange={e=>update('layer',e.target.value as TextOverlaySettings['layer'])}>
   <option value="front">図形より前面</option><option value="back">図形より背面（背景より前）</option>
  </select>
  <h3>発光と装飾</h3>
  <label className="text-checkbox"><input type="checkbox" checked={settings.glowEnabled}
   onChange={e=>update('glowEnabled',e.target.checked)}/> 文字の発光を有効化</label>
  {settings.glowEnabled&&<>
   <label htmlFor="text-glow-mode">発光色</label>
   <select id="text-glow-mode" value={settings.glowColorMode??'text'}
    onChange={e=>update('glowColorMode',e.target.value as TextOverlaySettings['glowColorMode'])}>
    <option value="text">文字色と同じ（グラデーションにも連動）</option>
    <option value="custom">発光色を指定</option>
   </select>
   <label htmlFor="text-glow-target">発光対象</label>
   <select id="text-glow-target" value={settings.glowTarget??'fill'} onChange={e=>{
    const target=e.target.value as TextOverlaySettings['glowTarget'];
    onChange({...settings,glowTarget:target,strokeEnabled:target==='outline'||target==='both'?true:settings.strokeEnabled});
   }}>
    <option value="fill">文字の中身</option>
    <option value="outline">縁取りだけ</option>
    <option value="both">中身と縁取り両方</option>
   </select>
   {settings.glowColorMode==='custom'&&color('glowColor','発光色（手動）')}
   {range('glowStrength','文字の発光強度',0,200,5,'%')}
   {range('glowBlur','文字の発光ぼかし',0,40,1)}
  </>}

  <label className="text-checkbox"><input type="checkbox" checked={settings.strokeEnabled} onChange={e=>update('strokeEnabled',e.target.checked)}/> 縁取りを有効化</label>
  {settings.strokeEnabled&&<>
   <label htmlFor="text-stroke-color-mode">縁取り色モード</label>
   <select id="text-stroke-color-mode" value={settings.strokeColorMode??'custom'}
    onChange={e=>update('strokeColorMode',e.target.value as TextOverlaySettings['strokeColorMode'])}>
    <option value="custom">単色（手動）</option>
    <option value="text">文字色に連動（グラデーション対応）</option>
   </select>
   {(settings.strokeColorMode??'custom')==='custom'&&color('strokeColor','縁取り色')}
   {range('strokeWidth','縁取りの太さ',0,30,1)}
  </>}
  <label className="text-checkbox"><input type="checkbox" checked={settings.shadowEnabled} onChange={e=>update('shadowEnabled',e.target.checked)}/> 影を有効化</label>
  {settings.shadowEnabled&&<>{color('shadowColor','影の色')}{range('shadowBlur','影のぼかし',0,40,1)}</>}
  <p className="help">中抜き時は発光対象を「縁取りだけ」にすると内側も透明のまま光ります。文字の発光は図形と独立して設定できます。PNG・SVG・動画・設定JSONにも反映されます。</p>
 </section>;
}
