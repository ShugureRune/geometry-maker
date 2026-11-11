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
  await page.getByLabel('シード値',{exact:true}).fill('liminal-outdoor-3d');
  await page.getByLabel('シード値',{exact:true}).press('Enter');
  await page.getByRole('button',{name:'3Dモード',exact:true}).click();
  await expect(page.getByTestId('three-preview').locator('canvas')).toBeVisible();
  await expect(page.getByRole('button',{name:'視点をリセット',exact:true})).toBeEnabled();
}
async function png(page:Page){
  await category(page,'書き出し');
  await page.getByLabel('3D 幅 (px)').fill('512');
  await page.getByLabel('3D 高さ (px)').fill('512');
  const next=page.waitForEvent('download');
  await page.getByRole('button',{name:'3D PNGを書き出す',exact:true}).click();
  return readFile((await (await next).path())!);
}
const hash=(bytes:Buffer)=>createHash('sha256').update(bytes).digest('hex');

test('all three outdoor liminal environments produce different PNGs without changing figures',async({page})=>{
  const errors:string[]=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{
    if(m.type()==='error'&&/WebGLProgram|Shader Error|VALIDATE_STATUS|GLSL/.test(m.text()))
      errors.push(m.text());
  });
  await start(page);
  const preview=page.getByTestId('three-preview');
  const count=await preview.getAttribute('data-object-count');
  await category(page,'背景');
  const select=page.getByLabel('3D背景の種類');
  const base=hash(await png(page));
  const images=new Set([base]);
  for(const kind of ['shallow-water','whiteout-snow','foggy-grassland']){
    await category(page,'背景');
    await select.selectOption(kind);
    await expect(preview).toHaveAttribute('data-sky-kind',kind);
    await expect(preview).toHaveAttribute('data-object-count',count!);
    const bytes=await png(page);
    expect(bytes.subarray(1,4).toString()).toBe('PNG');
    expect(bytes.length).toBeGreaterThan(5000);
    images.add(hash(bytes));
  }
  expect(images.size).toBe(4);
  await category(page,'背景');
  await select.selectOption('classic');
  expect(hash(await png(page))).toBe(base);
  expect(errors).toEqual([]);
});

test('grass, snow and water density sliders modify each environment',async({page})=>{
  await start(page);
  await category(page,'アニメーション');
  await page.getByLabel('3Dアニメーションを有効化').uncheck();
  await category(page,'背景');
  const select=page.getByLabel('3D背景の種類');
  for(const kind of ['shallow-water','whiteout-snow','foggy-grassland']){
    await select.selectOption(kind);
    const density=page.locator('#three-sky-density');
    await expect(density).toHaveValue('100');
    await density.fill('0');
    const empty=hash(await png(page));
    await category(page,'背景');
    await density.fill('200');
    const full=hash(await png(page));
    expect(full,kind+' density was inert').not.toBe(empty);
    await category(page,'背景');
    await density.fill('100');
  }
});

test('a paused outdoor sky and its colors persist in JSON with neon and the 3D floor grid',async({page})=>{
  await start(page);
  await category(page,'アニメーション');
  await page.getByLabel('3Dアニメーションを有効化').uncheck();
  await category(page,'背景');
  await page.getByLabel('3D背景の種類').selectOption('shallow-water');
  await page.locator('#three-sky-color-accent').fill('#d2bbfa');
  await page.getByLabel('3D床グリッドを有効化').check();
  const preview=page.getByTestId('three-preview');
  await expect(preview).toHaveAttribute('data-floor-grid','on');
  const still=hash(await png(page));
  await page.waitForTimeout(300);
  expect(hash(await png(page))).toBe(still);
  await category(page,'書き出し');
  const download=page.waitForEvent('download');
  await page.getByRole('button',{name:'3Dの設定を保存'}).click();
  const settings=await readFile((await (await download).path())!);
  const project=JSON.parse(settings.toString());
  expect(project.settings.sky.kind).toBe('shallow-water');
  expect(project.settings.sky.colors['shallow-water'].accent).toBe('#d2bbfa');
  expect(project.settings.floorGrid.enabled).toBe(true);
  await category(page,'背景');
  await page.getByLabel('3D背景の種類').selectOption('whiteout-snow');
  await category(page,'書き出し');
  await page.getByLabel('保存した3D設定ファイル').setInputFiles({
    name:'liminal.json',mimeType:'application/json',buffer:settings,
  });
  await expect(preview).toHaveAttribute('data-sky-kind','shallow-water');
  await category(page,'背景');
  await expect(page.locator('#three-sky-color-accent')).toHaveValue('#d2bbfa');
  await expect(preview).toHaveAttribute('data-floor-grid','on');
  expect(hash(await png(page))).toBe(still);
});

test('mobile lightweight grassland and snow remain compatible with celestial objects',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await start(page);
  await category(page,'図形');
  await page.getByLabel('3D描画品質').selectOption('low');
  await page.getByLabel('3D天体を表示').check();
  const preview=page.getByTestId('three-preview');
  await expect(preview).toHaveAttribute('data-quality','low');
  await expect(preview).toHaveAttribute('data-celestial-count','6');
  await category(page,'背景');
  const select=page.getByLabel('3D背景の種類');
  await select.selectOption('foggy-grassland');
  const grass=hash(await png(page));
  await category(page,'背景');
  await select.selectOption('whiteout-snow');
  const snow=hash(await png(page));
  expect(grass).not.toBe(snow);
  await expect(preview).toHaveAttribute('data-celestial-count','6');
  await page.getByRole('button',{name:'2Dモード',exact:true}).click();
  await expect(page.getByTestId('preview')).toBeVisible();
});
