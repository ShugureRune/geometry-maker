import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import type { Page } from '@playwright/test';
async function download(page: Page, button: string) {
 const pending = page.waitForEvent('download');
 await page.getByRole('button',{name:button,exact:true}).click();
 const item=await pending; expect(await item.failure()).toBeNull();
 return {name:item.suggestedFilename(), data:await readFile((await item.path())!)};
}
test('downloads real PNG/SVG and restores all settings atomically',async({page})=>{
 await page.goto('./');
 await page.getByLabel('シード値',{exact:true}).fill('export-心音-001');
 await page.getByLabel('図形密度').fill('75');
 await page.getByLabel('発光強度').fill('75');
 await page.getByLabel('書き出し解像度',{exact:true}).selectOption('2048x2048');
 await expect(page.getByLabel('キャンバスの比率')).toHaveValue('1:1');
 await page.getByLabel('幅 (px)',{exact:true}).fill('512');
 await page.getByLabel('高さ (px)',{exact:true}).fill('512');
 const settings=await download(page,'設定JSONを保存');
 const json=JSON.parse(settings.data.toString());
 expect(json).toMatchObject({density:75,schemaVersion:1,algorithmVersion:'2d-v5',seed:'export-心音-001',aspectRatio:'1:1',exportWidth:512,exportHeight:512});
 const svg=await download(page,'SVGを書き出す');
 expect(svg.name).toContain('2d-v5_seed-export-心音-001');
 expect(svg.data.toString()).toContain('viewBox="0 0 1200 1200"');
 expect(svg.data.toString()).not.toContain('class="artwork"');
 const png=await download(page,'PNGを書き出す');
 expect(png.name).toContain('512x512.png');
 expect(png.data.subarray(0,8).toString('hex')).toBe('89504e470d0a1a0a');
 expect(png.data.readUInt32BE(16)).toBe(512);expect(png.data.readUInt32BE(20)).toBe(512);
 // Compare the actual downloaded PNG with the actual downloaded SVG rasterized
 // independently by the browser, not with a mock or an implementation string.
 const equal=await page.evaluate(async ({svg,png})=>{
  const raster=async (url:string)=>{const image=new Image();image.src=url;await image.decode();const c=document.createElement('canvas');c.width=512;c.height=512;c.getContext('2d')!.drawImage(image,0,0,512,512);return c.toDataURL();};
  const original=document.querySelector('[data-testid="preview"]')!.cloneNode(true) as SVGSVGElement;
  original.setAttribute('width','512');original.setAttribute('height','512');original.removeAttribute('class');
  const previewURL=URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(original)],{type:'image/svg+xml'}));
  try {const pixels=await raster('data:image/png;base64,'+png);return pixels===await raster('data:image/svg+xml;base64,'+svg)&&pixels===await raster(previewURL);}
  finally {URL.revokeObjectURL(previewURL);}
 },{svg:svg.data.toString('base64'),png:png.data.toString('base64')});
 expect(equal).toBe(true);
 await page.getByLabel('シード値',{exact:true}).fill('changed');
 await page.getByLabel('図形密度').fill('0');
 await page.getByRole('button',{name:'単色',exact:true}).click();
 await page.getByLabel('幅 (px)',{exact:true}).fill('700');
 await page.getByLabel('設定JSONファイル').setInputFiles({name:'settings.json',mimeType:'application/json',buffer:settings.data});
 await expect(page.getByTestId('current-seed')).toHaveText('export-心音-001');
 await expect(page.getByLabel('幅 (px)',{exact:true})).toHaveValue('512');
 await expect(page.getByLabel('図形密度')).toHaveValue('75');
 const restored=await download(page,'設定JSONを保存');expect(JSON.parse(restored.data.toString())).toEqual(json);
 const repeat=await download(page,'PNGを書き出す');expect(repeat.data.equals(png.data)).toBe(true);
 for(const buffer of [Buffer.from('{bad'),Buffer.from(JSON.stringify({...json,algorithmVersion:'2d-v3'})),Buffer.from('{}')]){
  await page.getByLabel('設定JSONファイル').setInputFiles({name:'bad.json',mimeType:'application/json',buffer});
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.getByTestId('current-seed')).toHaveText('export-心音-001');
 }
});
test('custom resolution validation, opaque margins and high resolution limits',async({page})=>{
 await page.goto('./');
 await page.getByLabel('幅 (px)',{exact:true}).fill('255');
 await expect(page.getByRole('button',{name:'PNGを書き出す',exact:true})).toBeDisabled();
 await expect(page.locator('#resolution-feedback')).toContainText('256');
 await page.getByLabel('幅 (px)',{exact:true}).fill('8192');
 await page.getByLabel('高さ (px)',{exact:true}).fill('8192');
 await expect(page.getByRole('button',{name:'PNGを書き出す',exact:true})).toBeDisabled();
 await expect(page.getByRole('button',{name:'SVGを書き出す',exact:true})).toBeEnabled();
 await page.getByLabel('幅 (px)',{exact:true}).fill('256');
 await page.getByLabel('高さ (px)',{exact:true}).fill('512');
 await expect(page.getByText('構図と書き出しの比率が異なるため、',{exact:false})).toBeVisible();
 const png=await download(page,'PNGを書き出す');
 expect(png.data.readUInt32BE(16)).toBe(256);expect(png.data.readUInt32BE(20)).toBe(512);
 expect(await page.evaluate(async data => {
  const image=new Image();image.src='data:image/png;base64,'+data;await image.decode();
  const c=document.createElement('canvas');c.width=256;c.height=512;const context=c.getContext('2d')!;context.drawImage(image,0,0);
  return context.getImageData(0,0,1,1).data[3];
 },png.data.toString('base64'))).toBe(255);
 await page.getByLabel('書き出し解像度',{exact:true}).selectOption('1920x1080');
 const high=await download(page,'PNGを書き出す');expect(high.data.readUInt32BE(16)).toBe(1920);
 await page.getByLabel('幅 (px)',{exact:true}).fill('3840');await page.getByLabel('高さ (px)',{exact:true}).fill('2160');
 const uhd=await download(page,'PNGを書き出す');expect(uhd.data.readUInt32BE(16)).toBe(3840);expect(uhd.data.readUInt32BE(20)).toBe(2160);
});
