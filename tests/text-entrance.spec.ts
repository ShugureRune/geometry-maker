import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';

test('text entrance settings animate preview independently and save completed SVG with JSON',async({page})=>{
 await page.goto('./');
 const seed=await page.getByTestId('current-seed').textContent();
 const nav=page.getByRole('navigation',{name:'設定カテゴリー'});
 await nav.getByRole('button',{name:'文字',exact:true}).click();
 await page.getByLabel('表示する文字').fill('登場！\nGeometry 𒉼');
 await page.getByLabel('登場エフェクト').selectOption('slide-up');
 await page.getByLabel('登場までの待ち時間').fill('0.3');
 await page.getByLabel('登場にかける時間').fill('1.2');
 await page.getByLabel('動きの滑らかさ').selectOption('linear');
 const overlay=page.getByTestId('preview').getByTestId('text-overlay');
 await expect(overlay).toHaveAttribute('data-text-entrance','slide-up');
 await page.getByRole('button',{name:/登場アニメをプレビュー|最初から再生/}).click();
 await expect.poll(async()=>Number(await overlay.getAttribute('data-text-progress')),{timeout:3000}).toBeGreaterThan(.7);
 await expect.poll(async()=>Number(await overlay.getAttribute('data-text-progress')),{timeout:4000}).toBe(1);
 await nav.getByRole('button',{name:'書き出し',exact:true}).click();
 const jsonPending=page.waitForEvent('download');
 await page.getByRole('button',{name:'作品の設定を保存'}).click();
 const json=JSON.parse((await readFile((await (await jsonPending).path())!)).toString());
 expect(json.textOverlay).toMatchObject({enabled:true,entrance:'slide-up',entranceDelay:.3,entranceDuration:1.2,
  entranceEasing:'linear',text:'登場！\nGeometry 𒉼'});
 const svgPending=page.waitForEvent('download');
 await page.getByRole('button',{name:'SVGを書き出す'}).click();
 const svg=await readFile((await (await svgPending).path())!,'utf8');
 expect(svg).toContain('data-text-progress="1"');
 expect(svg).toContain('登場！');
 expect(svg).toContain('Geometry 𒉼');
 expect(svg).not.toContain('preview-text-selection');
 await expect(page.getByTestId('current-seed')).toHaveText(seed??'');
 await nav.getByRole('button',{name:'文字',exact:true}).click();
 await page.getByLabel('登場エフェクト').selectOption('typewriter');
 await page.getByLabel('登場までの待ち時間').fill('1');
 await page.getByLabel('登場にかける時間').fill('2');
 await page.getByRole('button',{name:/登場アニメをプレビュー|最初から再生/}).click();
 const typed=overlay.locator('text').last();
 await expect(overlay).toHaveAttribute('data-text-entrance','typewriter');
 await expect.poll(async()=>Number(await overlay.getAttribute('data-text-progress')),{timeout:5000}).toBeGreaterThan(.3);
 await expect.poll(async()=>await typed.textContent(),{timeout:6000}).toContain('𒉼');
});

test('exported video duration includes slow text entrance even when figure growth is short',async({page})=>{
 test.setTimeout(120000);
 await page.goto('./');
 const nav=page.getByRole('navigation',{name:'設定カテゴリー'});
 await nav.getByRole('button',{name:'文字',exact:true}).click();
 await page.getByLabel('表示する文字').fill('動画タイトル');
 await page.getByLabel('登場エフェクト').selectOption('zoom');
 await page.getByLabel('登場までの待ち時間').fill('1');
 await page.getByLabel('登場にかける時間').fill('1');
 await nav.getByRole('button',{name:'アニメーション',exact:true}).click();
 await page.getByLabel('成長時間（秒）').fill('1');
 await page.getByLabel('再生速度',{exact:true}).selectOption('4');
 await nav.getByRole('button',{name:'書き出し',exact:true}).click();
 await page.locator('summary').filter({hasText:'動画書き出し'}).click();
 await expect(page.getByText(/長さ：約2\.0\d秒/)).toBeVisible();
 await page.getByLabel('動画の幅 (px)').fill('256');
 await page.getByLabel('動画の高さ (px)').fill('256');
 const exportButton=page.getByRole('button',{name:'動画を書き出す',exact:true});
 await expect.poll(async()=>await exportButton.isEnabled()||await page.getByText('選択した形式・解像度のエンコードに未対応です。別の形式・解像度をお試しください。').isVisible(),{timeout:15000}).toBe(true);
 if(!(await exportButton.isEnabled())){test.skip(true,'WebM encoder unavailable in this Chromium environment');return;}
 const pending=page.waitForEvent('download');
 await exportButton.click();
 const video=await readFile((await (await pending).path())!);
 const duration=await page.evaluate(async(bytes:number[])=>{
  const blob=new Blob([new Uint8Array(bytes)],{type:'video/webm'});
  const url=URL.createObjectURL(blob);
  const element=document.createElement('video');element.preload='metadata';element.src=url;
  try{
   await new Promise<void>((resolve,reject)=>{element.onloadedmetadata=()=>resolve();element.onerror=()=>reject(new Error('video metadata'));});
   return element.duration;
  }finally{URL.revokeObjectURL(url);}
 },Array.from(video));
 expect(duration).toBeGreaterThanOrEqual(1.95);
});
