import {HelpInfo} from '../HelpInfo';
import {useEffect, useState} from 'react';
import {ThreeRange} from './ThreeControls';
import type {ThreeSettings} from './settings';
import {COLOR_MODES, networkDefaults, neonDefaults, stylePreset, type NetworkSettings, type StyleColorMode, type StylePreset} from './style-settings';

function ColorControls({prefix, mode, color, contrast, onMode, onColor, onContrast}: {
  prefix:string; mode:StyleColorMode; color:string; contrast:boolean;
  onMode:(mode:StyleColorMode)=>void; onColor:(color:string)=>void; onContrast:(value:boolean)=>void;
}) {
  const [hex,setHex]=useState(color); useEffect(()=>setHex(color),[color]);
  const invalid=!/^#[0-9a-f]{6}$/i.test(hex);
  return <>
    <label htmlFor={`${prefix}-color-mode`}>{prefix==='network'?'接続線':'輪郭線'}の色モード</label>
    <select id={`${prefix}-color-mode`} value={mode} onChange={event=>onMode(event.target.value as StyleColorMode)}>
      {COLOR_MODES.map((value,index)=><option key={value} value={value}>{['自動（図形色に連動）','主役色','補助色','アクセント色','カスタム色'][index]}</option>)}
    </select>
    {mode==='custom'&&<div className="three-custom-color">
      <label htmlFor={`${prefix}-picker`}>カスタム色<input id={`${prefix}-picker`} type="color" value={color} onChange={event=>onColor(event.target.value)}/></label>
      <label htmlFor={`${prefix}-hex`}>HEX<input id={`${prefix}-hex`} value={hex} maxLength={7} spellCheck={false} aria-invalid={invalid}
        onChange={event=>{setHex(event.target.value);if(/^#[0-9a-f]{6}$/i.test(event.target.value))onColor(event.target.value);}}
        onBlur={()=>{if(invalid)setHex(color);}}/></label>
      {invalid&&<p className="export-error">#RRGGBBで指定してください。</p>}
    </div>}
    <label className="three-checkbox"><input type="checkbox" checked={contrast} onChange={event=>onContrast(event.target.checked)}/> 背景に合わせて見やすくする</label>
  </>;
}
export function ThreeStyleControls({settings,onChange}:{settings:ThreeSettings;onChange:(settings:ThreeSettings)=>void}) {
  const network=settings.network??networkDefaults, neon=settings.neon??neonDefaults;
  const net=(patch:Partial<typeof network>)=>onChange({...settings,network:{...network,...patch}});
  const outline=(patch:Partial<typeof neon>)=>onChange({...settings,neon:{...neon,...patch}});
  return <section className="control-section three-controls three-style-controls" aria-labelledby="three-style-heading">
    <div className="studio-setting-label studio-setting-heading">
      <h3 id="three-style-heading">光る線とつながり</h3>
      <HelpInfo>高解像度PNGでは線の太さも拡大します。軽量描画ではブルームを省略し、細線の見やすさを優先します。パルスと電気信号は3Dの再生・一時停止と連動します。神経回路では登場演出の完了時に図形と線が一斉に発光し、その後で電気信号が流れます。</HelpInfo>
    </div>
    <div className="three-style-presets" role="group" aria-label="3Dスタイルプリセット">
      {(['standard','network','cyber'] as StylePreset[]).map((preset,i)=>{
        const value=stylePreset(preset);
        return <button type="button" key={preset} aria-pressed={JSON.stringify({network,neon})===JSON.stringify(value)} onClick={()=>onChange({...settings,...value})}>{['スタンダード','ネオンネットワーク','サイバーグリッド'][i]}</button>;
      })}
    </div>
    <HelpInfo>プリセットは3Dスタイルだけを変更します。シード・配置・通常マテリアル・カメラは維持します。神経回路に切り替えると電気信号が自動で有効になります。</HelpInfo>
    <fieldset><legend>図形を線でつなぐ</legend>
      <label className="three-checkbox"><input type="checkbox" aria-label="図形の接続を有効化" checked={network.enabled} onChange={event=>net({enabled:event.target.checked})}/> 接続線を表示</label>
      {network.enabled&&<>
        <div className="studio-setting-label">
          <label htmlFor="network-mode">つなぎ方</label>
          <HelpInfo>「近い順」は今までどおり、距離だけで接続します。「神経回路」は距離が近く、大きな図形を含む組み合わせほど高得点にして優先します。大きな図形が分岐点になり、同じ図形に線が集中しすぎないよう最大接続数を守ります。輪っかにならず木の枝のようにつながります。離れすぎた図形は接続しません。</HelpInfo>
        </div>
        <select id="network-mode" value={network.mode}
          onChange={event=>{const mode=event.target.value as NetworkSettings['mode'];net({mode,animation:mode==='neural'?'signal':network.animation==='signal'?'none':network.animation});}}>
          <option value="nearest">近い順（従来）</option>
          <option value="neural">神経回路（近さ＋大きさ）</option>
        </select>
        <ThreeRange id="network-count" label="最大接続数" min={1} max={6} step={1} value={network.maxConnections} unit="本" onChange={maxConnections=>net({maxConnections})}/>
        <ThreeRange id="network-distance" label="接続距離" min={.5} max={15} step={.25} value={network.distance} unit="単位" onChange={distance=>net({distance})}/>
        <ThreeRange id="network-width" label="接続線の太さ" min={.25} max={6} step={.25} value={network.width} unit="倍" onChange={width=>net({width})}/>
        <ThreeRange id="network-opacity" label="接続線の濃さ" min={0} max={1} step={.05} value={network.opacity} onChange={opacity=>net({opacity})}/>
        <ThreeRange id="network-glow" label="接続線の光り方" min={0} max={200} step={5} value={network.glow} unit="%" onChange={glow=>net({glow})}/>
        <ColorControls prefix="network" mode={network.colorMode} color={network.customColor} contrast={network.contrast}
          onMode={colorMode=>net({colorMode})} onColor={customColor=>net({customColor})} onContrast={contrast=>net({contrast})}/>
        <label htmlFor="network-animation">接続アニメーション</label>
        <select id="network-animation" value={network.animation} onChange={event=>net({animation:event.target.value as NetworkSettings['animation']})}>
          <option value="none">なし</option><option value="pulse">パルス発光</option><option value="signal">電気信号が流れる</option>
        </select>
      </>}
    </fieldset>
    <fieldset><legend>光る輪郭線</legend>
      <label className="three-checkbox"><input type="checkbox" checked={neon.enabled} onChange={event=>outline({enabled:event.target.checked})}/> 光る輪郭を表示</label>
      {neon.enabled&&<>
        <label htmlFor="neon-display">輪郭の見せ方</label>
        <select id="neon-display" value={neon.display} onChange={event=>outline({display:event.target.value as typeof neon.display})}>
          <option value="lines">線のみ</option><option value="transparent">線＋半透明面</option><option value="surface">面＋輪郭強調</option>
        </select>
        <ThreeRange id="neon-width" label="輪郭線の太さ" min={.25} max={6} step={.25} value={neon.width} unit="倍" onChange={width=>outline({width})}/>
        <ColorControls prefix="neon" mode={neon.colorMode} color={neon.customColor} contrast={neon.contrast}
          onMode={colorMode=>outline({colorMode})} onColor={customColor=>outline({customColor})} onContrast={contrast=>outline({contrast})}/>
        <ThreeRange id="neon-glow" label="輪郭の光り方" min={0} max={200} step={5} value={neon.glow} unit="%" onChange={glow=>outline({glow})}/>
        {neon.display==='transparent'&&<ThreeRange id="neon-face-opacity" label="面の濃さ" min={0} max={1} step={.05} value={neon.faceOpacity} onChange={faceOpacity=>outline({faceOpacity})}/>}
      </>}
    </fieldset>

  </section>;
}
