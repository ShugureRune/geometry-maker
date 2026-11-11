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
  await page.getByRole('button',{name:'3Dモード',exact:true}).click();
  await expect(page.getByTestId('three-preview').locator('canvas')).toBeVisible();
  await category(page,'図形');
  await page.getByLabel('3D描画品質').selectOption('low');
}
async function project(page:Page){
  await category(page,'書き出し');
  const download=page.waitForEvent('download');
  await page.getByRole('button',{name:'3D設定JSONを保存'}).click();
  const file=await download;
  return JSON.parse((await readFile((await file.path())!)).toString('utf8')) as {
    settings:{animation:boolean;entrance:{enabled:boolean;mode:string;duration:number;stagger:boolean}};
    elapsedSeconds:number;seed:string;
  };
}
async function pngDigest(page:Page){
  await category(page,'書き出し');
  await page.getByLabel('3D 幅 (px)').fill('450');
  await page.getByLabel('3D 高さ (px)').fill('450');
  const download=page.waitForEvent('download');
  await page.getByRole('button',{name:'3D PNGを書き出す'}).click();
  return createHash('sha256').update(await readFile((await (await download).path())!)).digest('hex');
}

test('3D seeded entrance reveals, finishes, and replay starts a new one-shot animation',async({page})=>{
  await start(page);
  const preview=page.getByTestId('three-preview');
  await expect(preview).toHaveAttribute('data-entrance-enabled','true');
  await category(page,'アニメーション');
  await expect(page.getByLabel('3D図形を順番に登場させる')).toBeChecked();
  await expect(page.getByLabel('3D登場演出の種類')).toHaveValue('seeded');
  await expect(page.getByTestId('three-entrance-style')).toContainText('今回のシードの演出：');
  await page.getByLabel('3D登場演出の種類').selectOption('spiral');
  await page.getByLabel('登場アニメーションの時間').fill('2');
  await page.getByLabel('3Dアニメーションを有効化').check();
  await page.getByRole('button',{name:'3D登場演出を最初から再生'}).click();
  const initial=await project(page);
  expect(initial.settings.entrance).toEqual({enabled:true,mode:'spiral',duration:2,stagger:true});
  await page.waitForTimeout(2300);
  const later=await project(page);
  expect(later.elapsedSeconds).toBeGreaterThan(initial.elapsedSeconds);
  expect(later.elapsedSeconds).toBeGreaterThan(2);
  await category(page,'アニメーション');
  await page.getByRole('button',{name:'3Dを一時停止'}).click();
  const stopped=await pngDigest(page);
  await page.waitForTimeout(180);
  expect(await pngDigest(page)).toBe(stopped);
  await category(page,'アニメーション');
  await page.getByRole('button',{name:'3D登場演出を最初から再生'}).click();
  // Replay also resumes playback even when the animation had been paused.
  const reset=await project(page);
  expect(reset.settings.animation).toBe(true);
  expect(reset.elapsedSeconds).toBeLessThan(1.4);
  await category(page,'アニメーション');
  await expect(page.getByRole('button',{name:'3Dを一時停止'})).toBeVisible();
  await expect(preview).toHaveAttribute('data-entrance-mode','spiral');
});

test('3D random seed preserves entrance UI and settings JSON roundtrip / legacy fallback',async({page})=>{
  await start(page);
  await category(page,'アニメーション');
  await page.getByLabel('登場アニメーションの時間').fill('9');
  await page.getByLabel('主役から順番に登場').uncheck();
  const saved=await project(page);
  expect(saved.settings.entrance).toMatchObject({enabled:true,mode:'seeded',duration:9,stagger:false});
  await category(page,'図形');
  const before=await page.getByTestId('current-seed').textContent();
  await page.getByRole('button',{name:'ランダムシードを生成'}).click();
  expect(await page.getByTestId('current-seed').textContent()).not.toBe(before);
  await category(page,'アニメーション');
  await expect(page.getByLabel('登場アニメーションの時間')).toHaveValue('9');
  const current=await project(page);
  await page.getByLabel('3D設定JSONファイル').setInputFiles({
    name:'seed-settings.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(saved))
  });
  await category(page,'アニメーション');
  await expect(page.getByLabel('主役から順番に登場')).not.toBeChecked();
  await expect(page.getByLabel('登場アニメーションの時間')).toHaveValue('9');
  await expect(page.getByTestId('three-preview')).toHaveAttribute('data-entrance-enabled','true');
  await category(page,'書き出し');
  const old={...current,settings:{...current.settings}};
  delete (old.settings as Partial<typeof old.settings>).entrance;
  await page.getByLabel('3D設定JSONファイル').setInputFiles({
    name:'old-3d.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(old))
  });
  await category(page,'アニメーション');
  await expect(page.getByLabel('3D図形を順番に登場させる')).not.toBeChecked();
  await expect(page.getByTestId('three-preview')).toHaveAttribute('data-entrance-enabled','false');
});
