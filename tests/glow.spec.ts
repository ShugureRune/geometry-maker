import {readFile} from 'node:fs/promises';
import {test,expect} from '@playwright/test';
test('glow and themes preserve geometry, locks and playback while changing rendered glow',async({page})=>{
 await page.goto('./');await page.getByLabel('アニメーションを有効化').uncheck();await page.getByLabel('シード値',{exact:true}).fill('undefined-heartbeat');await page.getByLabel('発光強度').fill('0');
 const geometry=()=>page.locator('[data-shape-id]').evaluateAll(nodes=>nodes.map(n=>[n.getAttribute('data-shape-id'),n.getAttribute('transform')]));
 const original=await geometry();await page.getByRole('button',{name:'主役色を固定',exact:true}).click();const color=await page.getByLabel('主役色',{exact:true}).inputValue();
 await page.getByRole('button',{name:'ネオンナイト',exact:true}).click();await expect(page.getByLabel('主役色',{exact:true})).toHaveValue(color);
 await page.getByRole('button',{name:'主役色を固定',exact:true}).click();await page.getByRole('button',{name:'ネオンナイト',exact:true}).click();
 for(const mode of ['暗','明']){
  if(mode==='明'){await page.getByRole('button',{name:'単色',exact:true}).click();await page.getByLabel('背景色',{exact:true}).fill('#faf8ff');}
  for(const intensity of [0,25,50,75,100]){await page.getByLabel('発光強度').fill(String(intensity));expect(await geometry()).toEqual(original);await expect(page.locator('filter')).toHaveCount(intensity===0?0:original.length);await page.getByTestId('preview').screenshot({path:`docs/glow/${mode==='暗'?'dark':'light'}-${intensity}.png`});}
  const files:Buffer[]=[];
  for(const name of ['PNGを書き出す','SVGを書き出す']){const pending=page.waitForEvent('download');await page.getByRole('button',{name,exact:true}).click();const d=await pending;files.push(await readFile((await d.path())!));}
  expect(files[1].toString()).toContain('feGaussianBlur');
  expect(await page.evaluate(async files=>{const draw=async(url:string)=>{const image=new Image();image.src=url;await image.decode();const c=document.createElement('canvas');c.width=1920;c.height=1080;c.getContext('2d')!.drawImage(image,0,0);return c.toDataURL();};return await draw('data:image/png;base64,'+files[0])===await draw('data:image/svg+xml;base64,'+files[1]);},files.map(f=>f.toString('base64')))).toBe(true);
 }
 await page.getByLabel('アニメーションを有効化').check();await page.getByLabel('タイムライン',{exact:true}).fill('500');await page.getByLabel('発光強度').fill('25');await expect(page.getByLabel('タイムライン',{exact:true})).toHaveValue('500');await page.getByTestId('preview').screenshot({path:'docs/glow/animation-light.png'});
 await page.getByRole('button',{name:'ネオンナイト',exact:true}).click();await page.getByTestId('preview').screenshot({path:'docs/glow/animation-dark.png'});
 await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
