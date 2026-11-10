import {CanvasTexture,LinearFilter} from 'three';

/** Real character glyphs, drawn using browser Canvas 2D (not block approximations).
 * Deterministic 8x8 texture atlas; sampled in the digital sky shader. */
export const SKY_DIGITAL_GLYPHS='0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ@#$%&*+-=?<>[]{}^_:/'.padEnd(64,'0').slice(0,64);
export const SKY_GLYPH_COLUMNS=8;
export function makeSkyGlyphAtlas():CanvasTexture{
  const tile=48,columns=SKY_GLYPH_COLUMNS;
  const canvas=document.createElement('canvas');
  canvas.width=tile*columns;canvas.height=tile*columns;
  const ctx=canvas.getContext('2d');
  if(!ctx)throw new Error('文字背景のテクスチャを作成できませんでした。');
  ctx.clearRect(0,0,canvas.width,canvas.height);
  ctx.font='bold 30px monospace';
  ctx.fillStyle='#ffffff';
  ctx.textAlign='center';
  ctx.textBaseline='middle';
  for(let i=0;i<SKY_DIGITAL_GLYPHS.length;i++){
    const x=(i%columns)*tile+tile/2,y=Math.floor(i/columns)*tile+tile/2;
    ctx.fillText(SKY_DIGITAL_GLYPHS[i],x,y+1,tile-6);
  }
  const texture=new CanvasTexture(canvas);
  texture.magFilter=LinearFilter;texture.minFilter=LinearFilter;
  texture.generateMipmaps=false;
  return texture;
}
