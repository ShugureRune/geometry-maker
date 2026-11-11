import {test,expect,type Page} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';

test.setTimeout(240_000);
const KINDS=[
  'endless-desert','salt-flat','moonlit-flowers','forest-edge',
  'twilight-plain','cloud-sea','dark-mirror',
] as const;
async function category(page:Page,name:string){
  const button=page.getByRole('navigation',{name:'設定カテゴリー'})
    .getByRole('button',{name,exact:true});
  if(await button.getAttribute('aria-expanded')!=='true')await button.click();
}
async function start(page:Page){
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.goto('./');
  await page.getByLabel('シード値',{exact:true}).fill('seven-natural-liminal-3d');
  await page.getByLabel('シード値',{exact:true}).press('Enter');
  await page.getByRole('button',{name:'3Dモード',exact:true}).click();
  await expect(page.getByTestId('three-preview').locator('canvas')).toBeVisible();
  await expect(page.getByRole('button',{name:'視点をリセット',exact:true})).toBeEnabled();
}
async function png(page:Page):Promise<Buffer>{
  await category(page,'書き出し');
  await page.getByLabel('3D 幅 (px)').fill('400');
  await page.getByLabel('3D 高さ (px)').fill('400');
  const next=page.waitForEvent('download');
  await page.getByRole('button',{name:'3D PNGを書き出す',exact:true}).click();
  return readFile((await (await next).path())!);
}
const digest=(bytes:Buffer)=>createHash('sha256').update(bytes).digest('hex');

test('all seven new outdoor liminal backgrounds produce distinct PNGs and keep the same 3D geometry',async({page})=>{
  const errors:string[]=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{
    if(m.type()==='error'&&/WebGLProgram|Shader Error|VALIDATE_STATUS|GLSL/.test(m.text()))
      errors.push(m.text());
  });
  await start(page);
  const preview=page.getByTestId('three-preview');
  const count=await preview.getAttribute('data-object-count');
  const original=digest(await png(page));
  const digests=new Set([original]);
  for(const kind of KINDS){
    await category(page,'背景');
    await page.getByLabel('3D背景の種類').selectOption(kind);
    await expect(preview).toHaveAttribute('data-sky-kind',kind);
    await expect(preview).toHaveAttribute('data-object-count',count!);
    const bytes=await png(page);
    expect(bytes.subarray(1,4).toString()).toBe('PNG');
    expect(bytes.length).toBeGreaterThan(3500);
    const hash=digest(bytes);
    expect(digests.has(hash),kind+' renders identically to another preset').toBe(false);
    digests.add(hash);
  }
  await category(page,'背景');
  await page.getByLabel('3D背景の種類').selectOption('classic');
  expect(digest(await png(page))).toBe(original);
  expect(errors).toEqual([]);
});

test('flower, forest and cloud scene density alters the rendered scene while paused',async({page})=>{
  await start(page);
  await category(page,'アニメーション');
  await page.getByLabel('3Dアニメーションを有効化').uncheck();
  for(const kind of ['moonlit-flowers','forest-edge','cloud-sea']){
    await category(page,'背景');
    await page.getByLabel('3D背景の種類').selectOption(kind);
    await page.locator('#three-sky-density').fill('0');
    const sparse=digest(await png(page));
    await category(page,'背景');
    await page.locator('#three-sky-density').fill('200');
    const dense=digest(await png(page));
    expect(dense,kind+' density had no effect').not.toBe(sparse);
    await category(page,'背景');
    await page.locator('#three-sky-density').fill('100');
  }
  // No time-based changes while the shared 3D animation clock is paused.
  await category(page,'背景');
  await page.getByLabel('3D背景の種類').selectOption('dark-mirror');
  const still=digest(await png(page));
  await page.waitForTimeout(350);
  expect(digest(await png(page))).toBe(still);
});

test('new sky colors survive JSON roundtrip and keep floor grid while returning to 2D',async({page})=>{
  await start(page);
  await category(page,'アニメーション');
  await page.getByLabel('3Dアニメーションを有効化').uncheck();
  await category(page,'背景');
  await page.getByLabel('3D背景の種類').selectOption('salt-flat');
  await page.locator('#three-sky-color-accent').fill('#c4a2eb');
  await page.getByLabel('3D床グリッドを有効化').check();
  const image=digest(await png(page));
  await category(page,'書き出し');
  const download=page.waitForEvent('download');
  await page.getByRole('button',{name:'3D設定JSONを保存'}).click();
  const bytes=await readFile((await (await download).path())!);
  const project=JSON.parse(bytes.toString());
  expect(project.settings.sky.kind).toBe('salt-flat');
  expect(project.settings.sky.colors['salt-flat'].accent).toBe('#c4a2eb');
  expect(project.settings.floorGrid.enabled).toBe(true);
  await category(page,'背景');
  await page.getByLabel('3D背景の種類').selectOption('forest-edge');
  await category(page,'書き出し');
  await page.getByLabel('3D設定JSONファイル').setInputFiles({
    name:'all-natural-skies.json',mimeType:'application/json',buffer:bytes,
  });
  await expect(page.getByTestId('three-preview')).toHaveAttribute('data-sky-kind','salt-flat');
  await category(page,'背景');
  await expect(page.locator('#three-sky-color-accent')).toHaveValue('#c4a2eb');
  await expect(page.getByTestId('three-preview')).toHaveAttribute('data-floor-grid','on');
  expect(digest(await png(page))).toBe(image);
  await page.getByRole('button',{name:'2Dモード',exact:true}).click();
  await expect(page.getByTestId('preview')).toBeVisible();
});

test('mobile low quality supports forest, flower and cloud presets with 3D celestials',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await start(page);
  await category(page,'図形');
  await page.getByLabel('3D描画品質').selectOption('low');
  await page.getByLabel('3D天体を表示').check();
  const preview=page.getByTestId('three-preview');
  await expect(preview).toHaveAttribute('data-quality','low');
  await expect(preview).toHaveAttribute('data-celestial-count','6');
  const digests=new Set<string>();
  for(const kind of ['moonlit-flowers','forest-edge','cloud-sea']){
    await category(page,'背景');
    await page.getByLabel('3D背景の種類').selectOption(kind);
    await expect(preview).toHaveAttribute('data-sky-kind',kind);
    digests.add(digest(await png(page)));
  }
  expect(digests.size).toBe(3);
  await expect(preview).toHaveAttribute('data-celestial-count','6');
});
