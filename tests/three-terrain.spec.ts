import {test,expect,type Page} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';

test.setTimeout(200_000);
async function category(page:Page,name:string){
  const button=page.getByRole('navigation',{name:'設定カテゴリー'})
    .getByRole('button',{name,exact:true});
  if(await button.getAttribute('aria-expanded')!=='true')await button.click();
}
async function start(page:Page){
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.goto('./');
  await page.getByLabel('シード値',{exact:true}).fill('3d-relief-hills');
  await page.getByLabel('シード値',{exact:true}).press('Enter');
  await page.getByRole('button',{name:'3Dモード',exact:true}).click();
  await expect(page.getByTestId('three-preview').locator('canvas')).toBeVisible();
  await expect(page.getByRole('button',{name:'視点をリセット',exact:true})).toBeEnabled();
  await category(page,'アニメーション');
  await page.getByLabel('3Dアニメーションを有効化').uncheck();
}
async function png(page:Page){
  await category(page,'書き出し');
  await page.getByLabel('3D 幅 (px)').fill('512');
  await page.getByLabel('3D 高さ (px)').fill('512');
  const next=page.waitForEvent('download');
  await page.getByRole('button',{name:'3D PNGを書き出す',exact:true}).click();
  return readFile((await (await next).path())!);
}
const digest=(bytes:Buffer)=>createHash('sha256').update(bytes).digest('hex');

test('desert, grassland and forest produce raised terrain with relief and detail settings',async({page})=>{
  const errors:string[]=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',message=>{
    if(message.type()==='error'&&/WebGLProgram|Shader Error|VALIDATE_STATUS|GLSL/.test(message.text()))
      errors.push(message.text());
  });
  await start(page);
  const preview=page.getByTestId('three-preview');
  const objectCount=await preview.getAttribute('data-object-count');
  for(const kind of ['endless-desert','foggy-grassland','forest-edge']){
    await category(page,'背景');
    await page.getByLabel('3D背景の種類').selectOption(kind);
    await expect(preview).toHaveAttribute('data-sky-kind',kind);
    await expect(page.locator('#three-terrain-relief')).toHaveValue('100');
    await page.locator('#three-terrain-relief').fill('0');
    const flat=digest(await png(page));
    await category(page,'背景');
    await page.locator('#three-terrain-relief').fill('200');
    const hills=digest(await png(page));
    expect(hills,kind+' ground does not change with actual mesh relief').not.toBe(flat);
    await expect(preview).toHaveAttribute('data-object-count',objectCount!);
    await category(page,'背景');
    await page.locator('#three-terrain-detail').fill('200');
    const rough=digest(await png(page));
    expect(rough,kind+' detail slider does not affect the rendered mesh').not.toBe(hills);
    await category(page,'背景');
    await page.locator('#three-terrain-relief').fill('100');
    await page.locator('#three-terrain-detail').fill('100');
  }
  await category(page,'背景');
  await page.getByLabel('3D背景の種類').selectOption('shallow-water');
  await expect(page.locator('#three-terrain-relief')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('terrain settings and flat-center checkbox survive JSON while the floor grid and sky color remain intact',async({page})=>{
  await start(page);
  await category(page,'背景');
  await page.getByLabel('3D背景の種類').selectOption('endless-desert');
  await page.locator('#three-terrain-relief').fill('180');
  await page.locator('#three-terrain-detail').fill('150');
  await page.locator('#three-terrain-flat-center').uncheck();
  await page.locator('#three-sky-color-accent').fill('#ddaa77');
  await page.getByLabel('3D床グリッドを有効化').check();
  const preview=page.getByTestId('three-preview');
  await expect(preview).toHaveAttribute('data-floor-grid','on');
  const before=digest(await png(page));
  await category(page,'書き出し');
  const download=page.waitForEvent('download');
  await page.getByRole('button',{name:'3Dの設定を保存'}).click();
  const bytes=await readFile((await (await download).path())!);
  const saved=JSON.parse(bytes.toString());
  expect(saved.settings.sky.terrain).toEqual({relief:180,detail:150,flatCenter:false});
  expect(saved.settings.sky.colors['endless-desert'].accent).toBe('#ddaa77');
  expect(saved.settings.floorGrid.enabled).toBe(true);
  await category(page,'背景');
  await page.locator('#three-terrain-relief').fill('0');
  expect(digest(await png(page))).not.toBe(before);
  await category(page,'書き出し');
  await page.getByLabel('保存した3D設定ファイル').setInputFiles({
    name:'terrain.json',mimeType:'application/json',buffer:bytes,
  });
  await category(page,'背景');
  await expect(page.locator('#three-terrain-relief')).toHaveValue('180');
  await expect(page.locator('#three-terrain-detail')).toHaveValue('150');
  await expect(page.locator('#three-terrain-flat-center')).not.toBeChecked();
  await expect(preview).toHaveAttribute('data-floor-grid','on');
  expect(digest(await png(page))).toBe(before);
});

test('mobile light quality keeps raised terrain and sky objects; background types remain intact',async({page})=>{
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
  await page.locator('#three-terrain-relief').fill('200');
  const raised=digest(await png(page));
  await category(page,'背景');
  await page.locator('#three-terrain-relief').fill('0');
  expect(digest(await png(page))).not.toBe(raised);
  await expect(preview).toHaveAttribute('data-celestial-count','6');
  await page.getByRole('button',{name:'2Dモード',exact:true}).click();
  await expect(page.getByTestId('preview')).toBeVisible();
});
