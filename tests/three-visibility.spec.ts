import {test,expect,type Page} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';

test.setTimeout(180_000);
async function category(page:Page,name:string){
  const b=page.getByRole('navigation',{name:'設定カテゴリー'})
    .getByRole('button',{name,exact:true});
  if(await b.getAttribute('aria-expanded')!=='true')await b.click();
}
async function start(page:Page){
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.goto('./');
  await page.getByLabel('シード値',{exact:true}).fill('far-visibility-landscape');
  await page.getByLabel('シード値',{exact:true}).press('Enter');
  await page.getByRole('button',{name:'3Dモード',exact:true}).click();
  await expect(page.getByTestId('three-preview').locator('canvas')).toBeVisible();
  await category(page,'アニメーション');
  await page.getByLabel('3Dアニメーションを有効化').uncheck();
}
async function png(page:Page){
  await category(page,'書き出し');
  await page.getByLabel('3D 幅 (px)').fill('450');
  await page.getByLabel('3D 高さ (px)').fill('450');
  const event=page.waitForEvent('download');
  await page.getByRole('button',{name:'3D PNGを書き出す',exact:true}).click();
  const file=await (await event).path();
  return readFile(file!);
}
const digest=(v:Buffer)=>createHash('sha256').update(v).digest('hex');

test('forest/desert/meadow/whiteout really support longer range and toggleable fog with no GLSL errors',async({page})=>{
  const errors:string[]=[];
  page.on('pageerror',error=>errors.push(error.message));
  page.on('console',message=>{
    if(message.type()==='error'&&/WebGLProgram|Shader Error|VALIDATE_STATUS|GLSL/.test(message.text()))
      errors.push(message.text());
  });
  await start(page);
  const preview=page.getByTestId('three-preview');
  const originalCount=await preview.getAttribute('data-object-count');
  for(const kind of ['endless-desert','foggy-grassland','forest-edge','whiteout-snow']){
    await category(page,'背景');
    await page.getByLabel('3D背景の種類').selectOption(kind);
    await expect(preview).toHaveAttribute('data-sky-kind',kind);
    const range=page.locator('#three-outdoor-view-distance');
    const fog=page.locator('#three-outdoor-fog-enabled');
    await expect(range).toHaveValue('400');
    await expect(fog).toBeChecked();
    await range.fill('100');
    const shortFog=digest(await png(page));
    await category(page,'背景');
    await range.fill('1000');
    const longFog=digest(await png(page));
    expect(longFog,kind+' distance slider did not update pixels').not.toBe(shortFog);
    await category(page,'背景');
    await fog.uncheck();
    const clear=digest(await png(page));
    expect(clear,kind+' fog toggle did not update pixels').not.toBe(longFog);
    await expect(preview).toHaveAttribute('data-object-count',originalCount!);
    await category(page,'背景');
    await fog.check();
    await range.fill('400');
  }
  await page.getByLabel('3D背景の種類').selectOption('starfield');
  await expect(page.locator('#three-outdoor-fog-enabled')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('outdoor visibility saves and restores with 3D terrain and floor grid; no legacy project breakage',async({page})=>{
  await start(page);
  await category(page,'背景');
  await page.getByLabel('3D背景の種類').selectOption('endless-desert');
  await page.locator('#three-outdoor-view-distance').fill('850');
  await page.locator('#three-outdoor-fog-enabled').uncheck();
  await page.locator('#three-terrain-relief').fill('180');
  await page.getByLabel('3D床グリッドを有効化').check();
  const image=digest(await png(page));
  await category(page,'書き出し');
  const event=page.waitForEvent('download');
  await page.getByRole('button',{name:'3Dの設定を保存'}).click();
  const bytes=await readFile((await (await event).path())!);
  const project=JSON.parse(bytes.toString());
  expect(project.settings.sky.visibility).toEqual({distance:850,fogEnabled:false});
  expect(project.settings.sky.terrain.relief).toBe(180);
  expect(project.settings.floorGrid.enabled).toBe(true);
  await category(page,'背景');
  await page.locator('#three-outdoor-fog-enabled').check();
  await page.locator('#three-outdoor-view-distance').fill('100');
  expect(digest(await png(page))).not.toBe(image);
  await category(page,'書き出し');
  await page.getByLabel('保存した3D設定ファイル').setInputFiles({
    name:'visibility.json',mimeType:'application/json',buffer:bytes,
  });
  await category(page,'背景');
  await expect(page.locator('#three-outdoor-view-distance')).toHaveValue('850');
  await expect(page.locator('#three-outdoor-fog-enabled')).not.toBeChecked();
  await expect(page.locator('#three-terrain-relief')).toHaveValue('180');
  await expect(page.getByTestId('three-preview')).toHaveAttribute('data-floor-grid','on');
  expect(digest(await png(page))).toBe(image);
});

test('mobile low mode can render far forest terrain, then return to 2D',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await start(page);
  await category(page,'図形');
  await page.getByLabel('3D描画品質').selectOption('low');
  await page.getByLabel('3D天体を表示').check();
  const preview=page.getByTestId('three-preview');
  await expect(preview).toHaveAttribute('data-quality','low');
  await expect(preview).toHaveAttribute('data-celestial-count','6');
  await category(page,'背景');
  await page.getByLabel('3D背景の種類').selectOption('forest-edge');
  await page.locator('#three-outdoor-fog-enabled').uncheck();
  await page.locator('#three-outdoor-view-distance').fill('1000');
  const distant=digest(await png(page));
  await category(page,'背景');
  await page.locator('#three-outdoor-view-distance').fill('100');
  expect(digest(await png(page))).not.toBe(distant);
  await expect(preview).toHaveAttribute('data-celestial-count','6');
  await page.getByRole('button',{name:'2Dモード',exact:true}).click();
  await expect(page.getByTestId('preview')).toBeVisible();
});
