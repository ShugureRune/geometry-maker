import {CanvasTexture,LinearFilter} from 'three';

/** Real characters: 16 readable hexadecimal glyphs packed into one GPU atlas.
 * Canvas text runs only when the sky material mounts, not once per frame or glyph.
 * Unlike a field of fake rectangles, the atlas contains real font rasterization.
 */
export const DIGITAL_GLYPHS='0123456789ABCDEF';
export const DIGITAL_ATLAS_COLUMNS=4;
export const DIGITAL_GLYPH_PIXELS=64;

export function createDigitalGlyphAtlas():CanvasTexture{
  const canvas=document.createElement('canvas');
  canvas.width=canvas.height=DIGITAL_ATLAS_COLUMNS*DIGITAL_GLYPH_PIXELS;
  const ctx=canvas.getContext('2d');
  if(!ctx)throw new Error('デジタル空間の文字描画を初期化できませんでした。');
  ctx.clearRect(0,0,canvas.width,canvas.height);
  ctx.textAlign='center';
  ctx.textBaseline='middle';
  ctx.font='bold 48px ui-monospace, Menlo, Consolas, monospace';
  ctx.fillStyle='#ffffff';
  for(let i=0;i<DIGITAL_GLYPHS.length;i++){
    const col=i%DIGITAL_ATLAS_COLUMNS,row=Math.floor(i/DIGITAL_ATLAS_COLUMNS);
    ctx.fillText(DIGITAL_GLYPHS[i],(col+.5)*DIGITAL_GLYPH_PIXELS,(row+.53)*DIGITAL_GLYPH_PIXELS);
  }
  const texture=new CanvasTexture(canvas);
  texture.minFilter=LinearFilter;
  texture.magFilter=LinearFilter;
  texture.generateMipmaps=false;
  return texture;
}
