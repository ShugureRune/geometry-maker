import { MAX_PNG_PIXELS, resolutionError } from './settings';

/** Standalone SVG: no app CSS, CDN, fonts or external images. The inner viewBox
 * stays unchanged; mismatched output ratios use centered contain with background margins. */
export function serializeArtwork(source: SVGSVGElement, width: number, height: number, marginColor: string, transparentMargins=false): string {
  const error = resolutionError(width, height);
  if (error) throw new Error(error);
  const clone = source.cloneNode(true) as SVGSVGElement;
  clone.removeAttribute('class');
  clone.removeAttribute('style');
  clone.setAttribute('width', String(width)); clone.setAttribute('height', String(height));
  clone.setAttribute('preserveAspectRatio', 'xMidYMid meet');
  const box = source.viewBox.baseVal;
  if (Math.abs(width / height - box.width / box.height) < 1e-9) {
    return '<?xml version="1.0" encoding="UTF-8"?>\n' + new XMLSerializer().serializeToString(clone);
  }
  const ns = 'http://www.w3.org/2000/svg';
  const outer = document.createElementNS(ns, 'svg');
  outer.setAttribute('xmlns', ns); outer.setAttribute('width', String(width)); outer.setAttribute('height', String(height));
  outer.setAttribute('viewBox', `0 0 ${width} ${height}`);
  const background = document.createElementNS(ns, 'rect');
  background.setAttribute('width', String(width)); background.setAttribute('height', String(height)); background.setAttribute('fill', marginColor);
  if(transparentMargins)outer.append(clone);else outer.append(background, clone);
  return '<?xml version="1.0" encoding="UTF-8"?>\n' + new XMLSerializer().serializeToString(outer);
}
export async function pngBlob(svg: string, width: number, height: number): Promise<Blob> {
  const error = resolutionError(width, height);
  if (error) throw new Error(error);
  if (width * height > MAX_PNG_PIXELS) throw new Error('PNGは合計16,777,216画素までです。解像度を下げるかSVGで保存してください。');
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }));
  const canvas = document.createElement('canvas');
  try {
    const image = new Image(); image.src = url;
    await image.decode();
    canvas.width = width; canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('描画用メモリを確保できません。解像度を下げてください。');
    context.drawImage(image, 0, 0, width, height);
    return await new Promise<Blob>((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('PNGの作成に失敗しました。解像度を下げてください。')), 'image/png'));
  } finally { URL.revokeObjectURL(url); canvas.width = 0; canvas.height = 0; }
}
export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob), link = document.createElement('a');
  link.href = url; link.download = filename; document.body.append(link);
  try { link.click(); } finally {
    link.remove();
    // Keep the blob alive while Safari's download UI takes ownership.
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }
}
