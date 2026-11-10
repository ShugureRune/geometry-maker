import {test,expect,type Page} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';

test.setTimeout(180_000);
async function category(page:Page,name:string){
  const b=page.getByRole('navigation',{name:'設定カテゴリー'}).getByRole('button',{name,exact:true});
  if(await b.getAttribute('aria-expanded')!=='true')await b.click();
}
async function start(page:Page){
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.goto('./');
  await page.getByLabel('シード値',{exact:true}).fill('eight-sky-presets');
  await page.getByLabel('シード値',{exact:true}).press('Enter');
  await page.getByRole('button',{name:'3Dモード',exact:true}).click();
  await expect(page.getByTestId('three-preview').locator('canvas')).toBeVisible();
  await expect(page.getByRole('button',{name:'視点をリセット',exact:true})).toBeEnabled();
}
async function png(page:Page){
  await category(page,'書き出し');
  await page.getByLabel('3D 幅 (px)').fill('512');
  await page.getByLabel('3D 高さ (px)').fill('512');
  const pending=page.waitForEvent('download');
  await page.getByRole('button',{name:'3D PNGを書き出す',exact:true}).click();
  return readFile((await (await pending).path())!);
}
const digest=(bytes:Buffer)=>createHash('sha256').update(bytes).digest('hex');

test('all eight 3D skies render unique seeded PNGs without removing objects or breaking the 2D view',async({page})=>{
  const errors:string[]=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',message=>{
    if(message.type()==='error'&&/WebGLProgram|Shader Error|VALIDATE_STATUS|GLSL/.test(message.text()))
      errors.push(message.text());
  });
  await start(page);
  const preview=page.getByTestId('three-preview');
  const objectCount=await preview.getAttribute('data-object-count');
  await category(page,'背景');
  const select=page.getByLabel('3D背景の種類');
  await expect(select).toHaveValue('classic');
  const classic=digest(await png(page));
  const modes=['starfield','galaxy','aurora','deep-sea','nebula','cyber-tunnel','retrowave','digital'];
  const digests=new Set([classic]);
  for(const kind of modes){
    await category(page,'背景');
    await select.selectOption(kind);
    await expect(preview).toHaveAttribute('data-sky-kind',kind);
    await expect(page.getByLabel('背景エフェクトの強さ')).toHaveValue('100');
    await expect(preview).toHaveAttribute('data-object-count',objectCount!);
    const bytes=await png(page);
    expect(bytes.subarray(1,4).toString()).toBe('PNG');
    expect(bytes.length).toBeGreaterThan(5_000);
    const next=digest(bytes);
    expect(digests.has(next),kind+' did not change the rendered sky').toBe(false);
    digests.add(next);
  }
  expect(digests.size).toBe(9);
  await category(page,'背景');
  await select.selectOption('classic');
  expect(digest(await png(page))).toBe(classic);
  await page.getByRole('button',{name:'2Dモード',exact:true}).click();
  await expect(page.getByTestId('preview')).toBeVisible();
  expect(errors).toEqual([]);
});

test('sky settings round-trip through JSON, keep existing neon/floor, and pause animations',async({page})=>{
  await start(page);
  const preview=page.getByTestId('three-preview');
  await category(page,'アニメーション');
  await page.getByLabel('3Dアニメーションを有効化').uncheck();
  await category(page,'背景');
  await page.getByLabel('3D背景の種類').selectOption('aurora');
  await page.locator('#three-sky-intensity').fill('145');
  await page.locator('#three-sky-density').fill('150');
  await page.locator('#three-sky-motion').fill('200');
  await page.getByLabel('3D床グリッドを有効化').check();
  await expect(preview).toHaveAttribute('data-floor-grid','on');
  const paused=digest(await png(page));
  await page.waitForTimeout(350);
  expect(digest(await png(page))).toBe(paused);
  await category(page,'書き出し');
  const pending=page.waitForEvent('download');
  await page.getByRole('button',{name:'3D設定JSONを保存'}).click();
  const bytes=await readFile((await (await pending).path())!);
  const project=JSON.parse(bytes.toString());
  expect(project.settings.sky).toEqual({kind:'aurora',intensity:145,density:150,motion:200});
  expect(project.settings.floorGrid.enabled).toBe(true);
  await category(page,'背景');
  await page.getByLabel('3D背景の種類').selectOption('deep-sea');
  expect(digest(await png(page))).not.toBe(paused);
  await category(page,'書き出し');
  await page.getByLabel('3D設定JSONファイル').setInputFiles({name:'sky.json',mimeType:'application/json',buffer:bytes});
  await expect(preview).toHaveAttribute('data-sky-kind','aurora');
  await category(page,'背景');
  await expect(page.locator('#three-sky-intensity')).toHaveValue('145');
  await expect(page.locator('#three-sky-density')).toHaveValue('150');
  await expect(page.locator('#three-sky-motion')).toHaveValue('200');
  await expect(preview).toHaveAttribute('data-floor-grid','on');
  expect(digest(await png(page))).toBe(paused);
});

test('background effects render in low-quality mobile-sized 3D mode with a celestial',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await start(page);
  await category(page,'図形');
  await page.getByLabel('3D描画品質').selectOption('low');
  await page.getByLabel('3D天体を表示').check();
  const preview=page.getByTestId('three-preview');
  await expect(preview).toHaveAttribute('data-quality','low');
  await expect(preview).toHaveAttribute('data-celestial-count','6');
  await category(page,'背景');
  await page.getByLabel('3D背景の種類').selectOption('cyber-tunnel');
  await expect(preview).toHaveAttribute('data-sky-kind','cyber-tunnel');
  const tunnel=digest(await png(page));
  await category(page,'背景');
  await page.getByLabel('3D背景の種類').selectOption('digital');
  expect(digest(await png(page))).not.toBe(tunnel);
});
