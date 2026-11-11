import {useEffect,useState} from 'react';
import {ThreeRange} from './ThreeControls';
import {FLOOR_GRID_DIAMETER_MULTIPLIER,floorGridDefaults,type FloorGridSettings} from './floor-grid';

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
      <label htmlFor="floor-grid-style">床のデザイン</label>
      <select id="floor-grid-style" value={grid.style}
        onChange={event=>update({style:event.target.value as FloorGridSettings['style']})}>
        <option value="grid">遠近グリッド</option>
        <option value="circuit">平面電子回路（PCB）</option>
      </select>
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
      <ThreeRange id="floor-grid-opacity" label="床グリッドの不透明度" value={grid.opacity}
        min={0} max={1} step={.05} onChange={opacity=>update({opacity})}/>
      <ThreeRange id="floor-grid-spacing" label="床グリッドの間隔" value={grid.spacing}
        min={.5} max={8} step={.25} unit="単位" onChange={spacing=>update({spacing})}/>
      <ThreeRange id="floor-grid-thickness" label="床グリッドの線の太さ（手前基準）" value={grid.thickness}
        min={.5} max={5} step={.25} onChange={thickness=>update({thickness})}/>
      <ThreeRange id="floor-grid-glow" label="床グリッドの発光強度" value={grid.glow}
        min={0} max={200} step={5} unit="%" onChange={glow=>update({glow})}/>
      <ThreeRange id="floor-grid-extent" label="床グリッドの直径" value={grid.extent*FLOOR_GRID_DIAMETER_MULTIPLIER}
        min={240} max={1200} step={20} unit="単位" onChange={diameter=>update({extent:diameter/FLOOR_GRID_DIAMETER_MULTIPLIER})}/>
      {grid.style==='circuit'&&<>
        <ThreeRange id="floor-circuit-density" label="回路配線の密度" value={grid.circuitDensity}
          min={0} max={100} step={5} unit="%" onChange={circuitDensity=>update({circuitDensity})}/>
        <ThreeRange id="floor-circuit-speed" label="回路を走る光の速度" value={grid.circuitSpeed}
          min={0} max={6} step={.25} unit="倍" onChange={circuitSpeed=>update({circuitSpeed})}/>
      </>}
      <ThreeRange id="floor-grid-scroll" label="床パターン全体のスクロール速度" value={grid.scrollSpeed}
        min={0} max={8} step={.25} unit="単位/秒" onChange={scrollSpeed=>update({scrollSpeed})}/>
    </>}
    <p className="help">3D図形の下に、本物の遠近感がある床を表示します。通常のグリッドと、直角に分岐する配線・発光端子・光が流れる電子回路を切り替えられます。図形やシードは変更されず、3D再生・一時停止、PNG、設定JSONに対応します。</p>
  </section>;
}
