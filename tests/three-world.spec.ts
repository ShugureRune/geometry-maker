import {test,expect,type Page} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';

test.setTimeout(220_000);
async function category(page:Page,name:string){
  const b=page.getByRole('navigation',{name:'設定カテゴリー'})
    .getByRole('button',{name,exact:true});
  if(await b.getAttribute('aria-expanded')!=='true')await b.click();
}
async function start(page:Page){
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.goto('./');
  await page.getByLabel('シード値',{exact:true}).fill('3d-world-builder-2026');
  await page.getByLabel('シード値',{exact:true}).press('Enter');
  await page.getByRole('button',{name:'3Dモード',exact:true}).click();
  await expect(page.getByTestId('three-preview').locator('canvas')).toBeVisible();
  await category(page,'アニメーション');
  await page.getByLabel('3Dアニメーションを有効化').uncheck();
}
async function png(page:Page):Promise<Buffer>{
  await category(page,'書き出し');
  await page.getByLabel('3D 幅 (px)').fill('420');
  await page.getByLabel('3D 高さ (px)').fill('420');
  const next=page.waitForEvent('download');
  return readFile((await (await next).path())!);
}
const digest=(b:Buffer)=>createHash('sha256').update(b).digest('hex');

test('mountain canyon volcano glacier and floating islands render differently and preserve figures',async({page})=>{
  const errors:string[]=[];
  page.on('pageerror',err=>errors.push(err.message));
  page.on('console',message=>{
    if(message.type()==='error'&&/WebGLProgram|Shader Error|VALIDATE_STATUS|GLSL/.test(message.text()))
      errors.push(message.text());
  });
  await start(page);
  const preview=page.getByTestId('three-preview'),count=await preview.getAttribute('data-object-count');
  const images=new Set<string>();
  for(const kind of ['alpine-peaks','grand-canyon','volcanic-field','glacier','floating-islands']){
    await category(page,'背景');
    await page.getByLabel('3D背景の種類').selectOption(kind);
    await expect(preview).toHaveAttribute('data-sky-kind',kind);
    await expect(preview).toHaveAttribute('data-object-count',count!);
    await category(page,'書き出し');
    const next=page.waitForEvent('download');
    await page.getByRole('button',{name:'3D PNGを書き出す',exact:true}).click();
    const bytes=await readFile((await (await next).path())!);
    expect(bytes.subarray(1,4).toString()).toBe('PNG');
    expect(bytes.length).toBeGreaterThan(4000);
    images.add(digest(bytes));
  }
  expect(images.size).toBe(5);
  expect(errors).toEqual([]);
});

test('sun time, storms, natural density and water reflection adjust image and survive 3D JSON',async({page})=>{
  await start(page);
  await category(page,'背景');
  await page.getByLabel('3D背景の種類').selectOption('shallow-water');
  const hour=page.locator('#three-world-hour'),weather=page.locator('#three-world-weather');
  const ref=page.locator('#three-world-water-reflection'),clouds=page.locator('#three-world-clouds');
  await hour.fill('12');
  const noon=digest(await png(page));
  await category(page,'背景');
  await hour.fill('0');
  const midnight=digest(await png(page));
  expect(noon).not.toBe(midnight);
  await category(page,'背景');
  await weather.selectOption('storm');
  const storm=digest(await png(page));
  expect(storm).not.toBe(midnight);
  await category(page,'背景');
  await ref.fill('0');
  const noReflection=digest(await png(page));
  expect(noReflection).not.toBe(storm);
  await category(page,'背景');
  await clouds.fill('0');
  await page.locator('#three-world-nature').fill('130');
  await page.locator('#three-world-water-waves').fill('180');
  await page.getByLabel('3D背景の種類').selectOption('alpine-peaks');
  const saved=digest(await png(page));
  await category(page,'書き出し');
  const download=page.waitForEvent('download');
  await page.getByRole('button',{name:'3D設定JSONを保存'}).click();
  const bytes=await readFile((await (await download).path())!);
  const project=JSON.parse(bytes.toString());
  expect(project.settings.sky.world).toMatchObject({
    timeOfDay:0,weather:'storm',natureDensity:130,cloudAmount:0,waterReflection:0,waterWaves:180,
  });
  await category(page,'背景');
  await page.locator('#three-world-hour').fill('12');
  await category(page,'書き出し');
  await page.getByLabel('3D設定JSONファイル').setInputFiles({
    name:'world.json',mimeType:'application/json',buffer:bytes,
  });
  await expect(page.getByTestId('three-preview')).toHaveAttribute('data-sky-kind','alpine-peaks');
  await category(page,'背景');
  await expect(page.locator('#three-world-hour')).toHaveValue('0');
  expect(digest(await png(page))).toBe(saved);
});

test('explore mode flies with WASD without losing 3D PNG and has touch buttons on mobile',async({page})=>{
  await start(page);
  await category(page,'背景');
  await page.getByLabel('3D背景の種類').selectOption('endless-desert');
  await page.locator('#three-world-explore').check();
  const preview=page.getByTestId('three-preview');
  await expect(preview).toHaveAttribute('data-explore','on');
  await expect(page.getByRole('button',{name:'探索 ↑'})).toBeVisible();
  const before=digest(await png(page));
  await page.keyboard.down('w');
  await page.waitForTimeout(420);
  await page.keyboard.up('w');
  const after=digest(await png(page));
  expect(before).not.toBe(after);
  await category(page,'背景');
  await page.locator('#three-world-explore').uncheck();
  await expect(preview).toHaveAttribute('data-explore','off');
  await expect(page.getByRole('button',{name:'探索 ↑'})).toHaveCount(0);
});

test('mobile low quality handles floating islands, snowy weather and solar lighting then returns to 2D',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await start(page);
  await category(page,'図形');
  await page.getByLabel('3D描画品質').selectOption('low');
  await page.getByLabel('3D天体を表示').check();
  await category(page,'背景');
  await page.getByLabel('3D背景の種類').selectOption('floating-islands');
  await page.locator('#three-world-weather').selectOption('snow');
  await page.locator('#three-world-hour').fill('7');
  await expect(page.getByTestId('three-preview')).toHaveAttribute('data-quality','low');
  await expect(page.getByTestId('three-preview')).toHaveAttribute('data-celestial-count','6');
  await category(page,'書き出し');
  const next=page.waitForEvent('download');
  await page.getByRole('button',{name:'3D PNGを書き出す',exact:true}).click();
  expect((await readFile((await (await next).path())!)).length).toBeGreaterThan(4000);
  await page.getByRole('button',{name:'2Dモード',exact:true}).click();
  await expect(page.getByTestId('preview')).toBeVisible();
});
