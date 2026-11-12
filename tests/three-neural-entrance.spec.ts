import {test,expect,type Page} from '@playwright/test';
import {readFile} from 'node:fs/promises';

test.setTimeout(95_000);

async function category(page:Page,label:string){
  const tab=page.getByRole('navigation',{name:'設定カテゴリー'})
    .getByRole('button',{name:label,exact:true});
  if(await tab.getAttribute('aria-expanded')!=='true')await tab.click();
}

test('big → medium → small → neural wires is selectable and keeps saved project settings',async({page})=>{
  const errors:string[]=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.goto('./');
  await page.getByRole('button',{name:'3Dモード',exact:true}).click();
  await category(page,'図形');
  await page.getByLabel('3D描画品質').selectOption('low');
  const preview=page.getByTestId('three-preview');
  await expect(preview.locator('canvas')).toBeVisible();
  await category(page,'装飾');
  await page.getByRole('button',{name:'ネオンネットワーク',exact:true}).click();
  await page.locator('#network-mode').selectOption('neural');
  await expect(page.locator('#network-animation')).toHaveValue('signal');
  await expect(preview).toHaveAttribute('data-neural-signals','on');
  await page.locator('#network-distance').fill('15');
  await expect.poll(async()=>Number(await preview.getAttribute('data-network-count')))
    .toBeGreaterThan(0);
  await category(page,'アニメーション');
  await page.getByLabel('3D図形を順番に登場させる').check();
  await page.locator('#three-entrance-mode').selectOption('neural-grow');
  await expect(page.getByTestId('three-entrance-style'))
    .toContainText('大きい図形 → 中くらい → 小さい図形 → ワイヤー');
  await page.locator('#three-entrance-duration').fill('4');
  await expect(page.getByLabel('主役から順番に登場')).toHaveCount(0);
  await page.getByRole('button',{name:'3D登場演出を最初から再生'}).click();
  await expect(preview).toHaveAttribute('data-entrance-mode','neural-grow');
  await expect(preview).toHaveAttribute('data-network-mode','neural');

  await category(page,'書き出し');
  const download=page.waitForEvent('download');
  await page.getByRole('button',{name:'3Dの設定を保存'}).click();
  const json=await readFile((await (await download).path())!);
  const saved=JSON.parse(json.toString('utf8'));
  expect(saved.settings.entrance).toMatchObject({
    enabled:true,mode:'neural-grow',duration:4,
  });
  expect(saved.settings.network.mode).toBe('neural');
  expect(saved.settings.network.animation).toBe('signal');
  await expect.poll(()=>page.evaluate(()=>{
    try{return JSON.parse(localStorage.getItem('geometry-maker-studio-autosave-v1')??'null')
      ?.threeD?.settings?.entrance?.mode;}catch{return null;}
  })).toBe('neural-grow');
  await page.reload();
  await category(page,'アニメーション');
  await expect(page.locator('#three-entrance-mode')).toHaveValue('neural-grow');
  await expect(page.locator('#three-entrance-duration')).toHaveValue('4');
  await category(page,'装飾');
  await expect(page.locator('#network-mode')).toHaveValue('neural');

  await page.locator('#network-mode').selectOption('nearest');
  await category(page,'アニメーション');
  await page.locator('#three-entrance-mode').selectOption('spiral');
  await category(page,'書き出し');
  await page.getByLabel('保存した3D設定ファイル',{exact:true}).setInputFiles({
    name:'size-ordered-entrance.json',mimeType:'application/json',buffer:json,
  });
  await category(page,'アニメーション');
  await expect(page.locator('#three-entrance-mode')).toHaveValue('neural-grow');
  await category(page,'装飾');
  await expect(page.locator('#network-mode')).toHaveValue('neural');
  expect(errors).toEqual([]);
});

test('new entrance animation remains stable with seed auto-switch and repeating visibility',async({page})=>{
  const errors:string[]=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto('./');
  await page.getByRole('button',{name:'3Dモード',exact:true}).click();
  await category(page,'図形');
  await page.getByLabel('3D描画品質').selectOption('low');
  await category(page,'装飾');
  await page.getByRole('button',{name:'ネオンネットワーク',exact:true}).click();
  await page.locator('#network-mode').selectOption('neural');
  await category(page,'アニメーション');
  await page.getByLabel('3D図形を順番に登場させる').check();
  await page.locator('#three-entrance-mode').selectOption('neural-grow');
  await page.getByLabel('出現・消失アニメーションを有効化').check();
  await page.getByLabel('3D待機画面モードを有効化').check();
  await page.locator('#three-standby-transition').fill('3');
  const preview=page.getByTestId('three-preview');
  for(const transition of ['exit-enter','morph'] as const){
    await page.locator('#three-standby-mode').selectOption(transition);
    const previous=await page.getByTestId('current-seed').textContent();
    await page.getByRole('button',{name:'今すぐ次の3Dシードへ'}).click();
    await expect(preview).toHaveAttribute('data-standby-active','true');
    await expect(preview).toHaveAttribute('data-network-mode','neural');
    expect(await page.getByTestId('current-seed').textContent()).not.toBe(previous);
    await expect(preview).toHaveAttribute('data-standby-active','false',{timeout:12000});
    await expect(preview.locator('canvas')).toBeVisible();
  }
  expect(errors).toEqual([]);
});
