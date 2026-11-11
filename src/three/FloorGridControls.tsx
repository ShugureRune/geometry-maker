import {HelpInfo} from '../HelpInfo';
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
        <label htmlFor="floor-grid-picker">床の配線色
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
      <ThreeRange id="floor-grid-opacity" label="床の不透明度" value={grid.opacity}
        min={0} max={1} step={.05} onChange={opacity=>update({opacity})}/>
      <ThreeRange id="floor-grid-spacing" label="床パターンの間隔" value={grid.spacing}
        min={.5} max={8} step={.25} unit="単位" onChange={spacing=>update({spacing})}/>
      <ThreeRange id="floor-grid-thickness" label="床の線の太さ（手前基準）" value={grid.thickness}
        min={.5} max={5} step={.25} onChange={thickness=>update({thickness})}/>
      <ThreeRange id="floor-grid-glow" label="床の発光強度" value={grid.glow}
        min={0} max={200} step={5} unit="%" onChange={glow=>update({glow})}/>
      <ThreeRange id="floor-grid-extent" label="床パターンの直径" value={grid.extent*FLOOR_GRID_DIAMETER_MULTIPLIER}
        min={240} max={1200} step={20} unit="単位" onChange={diameter=>update({extent:diameter/FLOOR_GRID_DIAMETER_MULTIPLIER})}/>
      {grid.style==='circuit'&&<>
        <HelpInfo>遠景はシェーダーで細密配線、近景は本物の立体コア・IC・金属ピン・経路を伝わる信号で描きます。</HelpInfo>
        <fieldset className="three-kind-fieldset">
          <legend>近景3Dマザーボード</legend>
          <label className="three-checkbox"><input type="checkbox"
            aria-label="中央演算コア・立体ICチップを表示" checked={grid.circuitWorldEnabled}
            onChange={event=>update({circuitWorldEnabled:event.target.checked})}/>
            中央演算コア・立体ICチップを表示
          </label>
          {grid.circuitWorldEnabled&&<>
            <ThreeRange id="floor-circuit-chip-count" label="立体ICチップの数"
              value={grid.circuitChipCount} min={0} max={24} step={1} unit="個"
              onChange={circuitChipCount=>update({circuitChipCount})}/>
            <ThreeRange id="floor-circuit-core-scale" label="中央演算コアの大きさ"
              value={grid.circuitCoreScale} min={.5} max={2} step={.1} unit="倍"
              onChange={circuitCoreScale=>update({circuitCoreScale})}/>
          </>}
          <HelpInfo>コア→太い幹線→分岐→ICの順に信号が走り、到達したICが発光します。軽量画質では立体チップ数を自動で抑えます。</HelpInfo>
        </fieldset>
        <div className="three-kind-presets" role="group" aria-label="回路の配色プリセット">
          <button type="button" onClick={()=>update({
            circuitWorldEnabled:true,circuitCoreScale:1.6,circuitChipCount:24,
            circuitDetail:95,circuitDensity:90,circuitBoardOpacity:.42,
            thickness:1.25,glow:155,circuitSpeed:2,
            color:'#43cfff',circuitAccentColor:'#f5c778'
          })}>巨大演算都市（高密度）</button>
          <button type="button" onClick={()=>update({color:'#43cfff',circuitAccentColor:'#f0b56b',circuitBoardOpacity:.30})}>青いサイバー基板</button>
          <button type="button" onClick={()=>update({color:'#27db96',circuitAccentColor:'#f4c876',circuitBoardOpacity:.48})}>緑の電子基板</button>
          <button type="button" onClick={()=>update({color:'#bd82ff',circuitAccentColor:'#eea9df',circuitBoardOpacity:.25})}>紫の未来回路</button>
        </div>
        <ThreeRange id="floor-circuit-density" label="回路配線の密度" value={grid.circuitDensity}
          min={0} max={100} step={5} unit="%" onChange={circuitDensity=>update({circuitDensity})}/>
        <ThreeRange id="floor-circuit-detail" label="IC・電子部品の量" value={grid.circuitDetail}
          min={0} max={100} step={5} unit="%" onChange={circuitDetail=>update({circuitDetail})}/>
        <ThreeRange id="floor-circuit-board-opacity" label="暗い基板面の濃さ" value={grid.circuitBoardOpacity}
          min={0} max={.85} step={.05} onChange={circuitBoardOpacity=>update({circuitBoardOpacity})}/>
        <label className="three-checkbox" htmlFor="floor-circuit-accent">金属端子・チップの色
          <input id="floor-circuit-accent" type="color" value={grid.circuitAccentColor}
            onChange={event=>update({circuitAccentColor:event.target.value})}/>
        </label>
        <ThreeRange id="floor-circuit-speed" label="回路を走る光の速度" value={grid.circuitSpeed}
          min={0} max={6} step={.25} unit="倍" onChange={circuitSpeed=>update({circuitSpeed})}/>
      </>}
      <ThreeRange id="floor-grid-scroll" label="床パターン全体のスクロール速度" value={grid.scrollSpeed}
        min={0} max={8} step={.25} unit="単位/秒" onChange={scrollSpeed=>update({scrollSpeed})}/>
    </>}
    <HelpInfo>3D図形の下に遠近感のある床を表示します。平面回路を選ぶと中央コア、立体IC、幹線と枝線、信号伝播を重ねられます。3D再生・一時停止、PNG、設定JSONに対応し、図形のシードや配置は変えません。</HelpInfo>
  </section>;
}
