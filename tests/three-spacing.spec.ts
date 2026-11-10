import {test,expect,type Page} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';

test.setTimeout(90_000);
async function category(page:Page,name:string) {
  const button=page.getByRole('navigation',{name:'設定カテゴリー'}).getByRole('button',{name,exact:true});
  if(await button.getAttribute('aria-expanded')!=='true')await button.click();
}
async function start(page:Page){
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.goto('./');
  await page.getByLabel('シード値',{exact:true}).fill('spacing-3d');
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
const digest=(buffer:Buffer)=>createHash('sha256').update(buffer).digest('hex');

test('3D spacing has a default of 100%, can move figures, and keeps seeded kind/count stable',async({page})=>{
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
  await start(page);
  const preview=page.getByTestId('three-preview');
  const count=await preview.getAttribute('data-object-count');
  await category(page,'図形');
  const spacing=page.getByLabel('図形同士の距離',{exact:true});
  await expect(spacing).toHaveValue('100');
  const standard=digest(await png(page));
  await category(page,'図形');
  await spacing.fill('150');
  await expect(spacing).toHaveValue('150');
  await expect(preview).toHaveAttribute('data-object-count',count!);
  expect(digest(await png(page))).not.toBe(standard);
  await category(page,'図形');
  await spacing.fill('70');
  await expect(spacing).toHaveValue('70');
  await expect(preview).toHaveAttribute('data-object-count',count!);
  expect(digest(await png(page))).not.toBe(standard);
  await category(page,'図形');
  await spacing.fill('100');
  await expect(spacing).toHaveValue('100');
  await expect(preview).toHaveAttribute('data-object-count',count!);
  await page.getByRole('button',{name:'2Dモード',exact:true}).click();
  await expect(page.getByTestId('preview')).toBeVisible();
  expect(errors).toEqual([]);
});

test('spacing percent persists via JSON and preserves existing neon connection count',async({page})=>{
  await start(page);
  await category(page,'装飾');
  await page.getByRole('button',{name:'ネオンネットワーク',exact:true}).click();
  const preview=page.getByTestId('three-preview');
  const count=await preview.getAttribute('data-network-count');
  await category(page,'図形');
  await page.getByLabel('図形同士の距離',{exact:true}).fill('175');
  await expect(preview).toHaveAttribute('data-network-count',count!);
  await category(page,'書き出し');
  const pending=page.waitForEvent('download');
  await page.getByRole('button',{name:'3D設定JSONを保存'}).click();
  const bytes=await readFile((await (await pending).path())!);
  const project=JSON.parse(bytes.toString());
  expect(project.settings.spacingPercent).toBe(175);
  await category(page,'図形');
  await page.getByLabel('図形同士の距離',{exact:true}).fill('50');
  await category(page,'書き出し');
  await page.getByLabel('3D設定JSONファイル').setInputFiles({
    name:'spacing.json',mimeType:'application/json',buffer:bytes,
  });
  await category(page,'図形');
  await expect(page.getByLabel('図形同士の距離',{exact:true})).toHaveValue('175');
  await expect(preview).toHaveAttribute('data-network-count',count!);
  const restored=await png(page);
  expect(restored.length).toBeGreaterThan(10_000);
});
