import {test,expect,type Page} from '@playwright/test';
import {readFile} from 'node:fs/promises';

test.setTimeout(135_000);

async function category(page:Page,label:string){
  const tab=page.getByRole('navigation',{name:'設定カテゴリー'})
    .getByRole('button',{name:label,exact:true});
  if(await tab.getAttribute('aria-expanded')!=='true')await tab.click();
}
async function start(page:Page){
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.goto('./');
  await page.getByRole('button',{name:'3Dモード',exact:true}).click();
  await category(page,'図形');
  await page.getByLabel('3D描画品質').selectOption('low');
  await page.getByLabel('クイック密度').fill('100');
  await expect(page.getByTestId('three-preview').locator('canvas')).toBeVisible();
  await category(page,'装飾');
  await page.getByRole('button',{name:'ネオンネットワーク',exact:true}).click();
  await page.locator('#network-distance').fill('15');
}

test('size-aware neural topology produces branching connections and persists across reload and 3D JSON',async({page})=>{
  const errors:string[]=[];
  page.on('pageerror',error=>errors.push(error.message));
  await start(page);
  const preview=page.getByTestId('three-preview');
  await expect(preview).toHaveAttribute('data-network-mode','nearest');
  const mode=page.locator('#network-mode');
  await expect(mode).toHaveValue('nearest');
  const nearest=Number(await preview.getAttribute('data-network-count'));
  expect(nearest).toBeGreaterThan(2);

  await mode.selectOption('neural');
  await expect(preview).toHaveAttribute('data-network-mode','neural');
  const neural=Number(await preview.getAttribute('data-network-count'));
  const total=Number(await preview.getAttribute('data-object-count'));
  expect(neural).toBeGreaterThan(0);
  expect(neural).toBeLessThanOrEqual(total-1); // branching forest, no cycles
  expect(neural).toBeGreaterThanOrEqual(total-2); // one or two primary roots
  // One parent per visible support/accent node; unlike classic nearest mode,
  // no maximum-degree/reach cutoff can leave dangling disconnected islands.
  expect(neural).toBeGreaterThan(2);
  await expect(page.locator('#network-count')).toHaveCount(0);
  await expect(page.locator('#network-distance')).toHaveCount(0);

  await category(page,'書き出し');
  const pending=page.waitForEvent('download');
  await page.getByRole('button',{name:'3Dの設定を保存',exact:true}).click();
  const json=await readFile((await (await pending).path())!);
  const project=JSON.parse(json.toString('utf8'));
  expect(project.settings.network.mode).toBe('neural');
  expect(project.settings.network.enabled).toBe(true);
  expect(project.settings.network.distance).toBe(15);

  await expect.poll(()=>page.evaluate(()=>{
    try{return JSON.parse(localStorage.getItem('geometry-maker-studio-autosave-v1')??'null')
      ?.threeD?.settings?.network?.mode;}
    catch{return null;}
  })).toBe('neural');
  await page.reload();
  await category(page,'装飾');
  await expect(page.locator('#network-mode')).toHaveValue('neural');
  await expect(preview).toHaveAttribute('data-network-mode','neural');
  await expect(preview).toHaveAttribute('data-network-count',String(neural));

  await mode.selectOption('nearest');
  await expect(preview).toHaveAttribute('data-network-mode','nearest');
  await category(page,'書き出し');
  await page.getByLabel('保存した3D設定ファイル',{exact:true}).setInputFiles({
    name:'neural-network.json',mimeType:'application/json',buffer:json,
  });
  await category(page,'装飾');
  await expect(mode).toHaveValue('neural');
  await expect(preview).toHaveAttribute('data-network-mode','neural');
  expect(errors).toEqual([]);
});

test('neural branches remain valid through seed switching and repeating visibility',async({page})=>{
  const errors:string[]=[];
  page.on('pageerror',error=>errors.push(error.message));
  await start(page);
  await page.locator('#network-mode').selectOption('neural');
  await category(page,'アニメーション');
  await page.getByLabel('出現・消失アニメーションを有効化').check();
  await page.getByLabel('3D待機画面モードを有効化').check();
  await page.locator('#three-standby-transition').fill('1');
  const preview=page.getByTestId('three-preview');
  for(const transition of ['morph','exit-enter'] as const){
    await page.locator('#three-standby-mode').selectOption(transition);
    const seed=await page.getByTestId('current-seed').textContent();
    await page.getByRole('button',{name:'今すぐ次の3Dシードへ'}).click();
    await expect(preview).toHaveAttribute('data-standby-active','true');
    await expect(preview).toHaveAttribute('data-network-mode','neural');
    expect(await page.getByTestId('current-seed').textContent()).not.toBe(seed);
    const count=Number(await preview.getAttribute('data-network-count'));
    const total=Number(await preview.getAttribute('data-object-count'));
    expect(count).toBeLessThanOrEqual(Math.max(0,total-1));
    await expect(preview).toHaveAttribute('data-standby-active','false',{timeout:10_000});
    await expect(preview.locator('canvas')).toBeVisible();
  }
  expect(errors).toEqual([]);
});
