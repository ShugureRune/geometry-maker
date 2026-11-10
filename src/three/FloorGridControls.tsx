import {useEffect,useState} from 'react';
import {ThreeRange} from './ThreeControls';
import {floorGridDefaults,type FloorGridSettings} from './floor-grid';

export function FloorGridControls({value,onChange}:{value:FloorGridSettings;onChange:(value:FloorGridSettings)=>void}){
  const grid=value??floorGridDefaults;
  const [hex,setHex]=useState(grid.color);
  useEffect(()=>setHex(grid.color),[grid.color]);
  const valid=/^#[0-9a-f]{6}$/i.test(hex);
  const update=(patch:Partial<FloorGridSettings>)=>onChange({...grid,...patch});
  return <section className="control-section three-controls three-style-controls" aria-labelledby="floor-grid-heading">
    <h3 id="floor-grid-heading">3D遠近グリッド（床）</h3>
    <label className="three-checkbox"><input type="checkbox" checked={grid.enabled}
      onChange={event=>update({enabled:event.target.checked})}/> 3D床グリッドを有効化</label>
    {grid.enabled&&<>
      <div className="three-custom-color">
        <label htmlFor="floor-grid-picker">床グリッドの色
          <input id="floor-grid-picker" type="color" value={grid.color}
            onChange={event=>{setHex(event.target.value);update({color:event.target.value});}}/>
        </label>
        <label htmlFor="floor-grid-hex">色コード
          <input id="floor-grid-hex" value={hex} maxLength={7} spellCheck={false} aria-invalid={!valid}
            onChange={event=>{setHex(event.target.value);if(/^#[0-9a-f]{6}$/i.test(event.target.value))update({color:event.target.value});}}
            onBlur={()=>{if(!valid)setHex(grid.color);}}/>
        </label>
      </div>
      {!valid&&<p className="export-error">色は #RRGGBB で入力してください。</p>}
      <ThreeRange id="floor-grid-opacity" label="床グリッドの透明度" value={grid.opacity}
        min={0} max={1} step={.05} onChange={opacity=>update({opacity})}/>
      <ThreeRange id="floor-grid-spacing" label="床グリッドの間隔" value={grid.spacing}
        min={.5} max={8} step={.25} unit="単位" onChange={spacing=>update({spacing})}/>
      <ThreeRange id="floor-grid-thickness" label="床グリッドの線の太さ" value={grid.thickness}
        min={.5} max={5} step={.25} unit="px" onChange={thickness=>update({thickness})}/>
      <ThreeRange id="floor-grid-glow" label="床グリッドの発光強度" value={grid.glow}
        min={0} max={200} step={5} unit="%" onChange={glow=>update({glow})}/>
      <ThreeRange id="floor-grid-extent" label="床グリッドの広さ" value={grid.extent}
        min={24} max={120} step={4} unit="単位" onChange={extent=>update({extent})}/>
      <ThreeRange id="floor-grid-scroll" label="床グリッドの流れる速度" value={grid.scrollSpeed}
        min={0} max={8} step={.25} unit="単位/秒" onChange={scrollSpeed=>update({scrollSpeed})}/>
    </>}
    <p className="help">3Dの図形の下に、カメラの視点に合わせて遠近感が変わる床だけを表示します。図形やシードは変更されません。流れる速度は3Dの再生・一時停止と連動し、PNG・3D設定JSONにも反映されます。</p>
  </section>;
}
