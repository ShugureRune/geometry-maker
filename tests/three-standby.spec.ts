import {test,expect,type Page} from '@playwright/test';
import {readFile} from 'node:fs/promises';

test.setTimeout(120_000);
async function category(page:Page,label:string){
  const button=page.getByRole('navigation',{name:'設定カテゴリー'}).getByRole('button',{name:label,exact:true});
  if(await button.getAttribute('aria-expanded')!=='true')await button.click();
}
async function start(page:Page){
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.goto('./');
  await page.getByRole('button',{name:'3Dモード',exact:true}).click();
  await category(page,'図形');
  await page.getByLabel('3D描画品質').selectOption('low');
  await expect(page.getByTestId('three-preview').locator('canvas')).toBeVisible();
  await category(page,'アニメーション');
  await page.getByLabel('3D待機画面モードを有効化').check();
  await expect(page.getByTestId('three-standby-controls')).toBeVisible();
}
async function saveJson(page:Page){
  await category(page,'書き出し');
  const d=page.waitForEvent('download');
  await page.getByRole('button',{name:'3Dの設定を保存'}).click();
  return readFile((await (await d).path())!);
}
test('3D standby morph swaps seeds and completes while keeping the preview mounted',async({page})=>{
  await start(page);
  await page.getByLabel('シード切り替え演出').selectOption('morph');
  await page.getByLabel('切り替え演出の長さ').fill('2');
  const before=await page.getByTestId('current-seed').textContent();
  const preview=page.getByTestId('three-preview');
  await page.getByRole('button',{name:'今すぐ次の3Dシードへ'}).click();
  await expect(preview).toHaveAttribute('data-standby-active','true');
  await expect(preview).toHaveAttribute('data-standby-mode','morph');
  expect(Number(await preview.getAttribute('data-standby-pairs'))).toBeGreaterThan(0);
  expect(await page.getByTestId('current-seed').textContent()).not.toBe(before);
  await expect(preview).toHaveAttribute('data-standby-active','false',{timeout:8000});
  await expect(preview).toHaveAttribute('data-standby-entrance-complete','true');
  const completed=JSON.parse((await saveJson(page)).toString('utf8'));
  expect(completed.standbyComplete).toBe(true);
  await category(page,'アニメーション');
  await page.getByLabel('シード切り替え演出').selectOption('exit-enter');
  await page.getByLabel('切り替え演出の長さ').fill('1');
  await page.getByRole('button',{name:'今すぐ次の3Dシードへ'}).click();
  await expect(preview).toHaveAttribute('data-standby-mode','exit-enter');
  await expect(preview).toHaveAttribute('data-standby-active','false',{timeout:8000});
  await expect(preview).toHaveAttribute('data-standby-entrance-complete','true');
  await category(page,'アニメーション');
  await page.getByLabel('3D図形を順番に登場させる').check();
  await page.getByRole('button',{name:'3D登場演出を最初から再生'}).click();
  await expect(preview).toHaveAttribute('data-standby-entrance-complete','false');
});
test('3D standby settings roundtrip JSON, and legacy projects default safely off',async({page})=>{
  await start(page);
  await page.getByLabel('シード切り替え演出').selectOption('exit-enter');
  await page.getByLabel('シード切り替え間隔').fill('30');
  await page.getByLabel('切り替え演出の長さ').fill('3');
  await page.getByRole('checkbox',{name:'切り替え後もカメラの視点を維持する'}).uncheck();
  const saved=await saveJson(page);
  const original=JSON.parse(saved.toString('utf8'));
  expect(original.settings.standby).toMatchObject({
    enabled:true,intervalSeconds:30,transitionSeconds:3,mode:'exit-enter',preserveCamera:false
  });
  await category(page,'アニメーション');
  await page.getByLabel('3D待機画面モードを有効化').uncheck();
  await category(page,'書き出し');
  await page.getByLabel('保存した3D設定ファイル',{exact:true}).setInputFiles({
    name:'standby.json',mimeType:'application/json',buffer:saved
  });
  await category(page,'アニメーション');
  await expect(page.getByLabel('3D待機画面モードを有効化')).toBeChecked();
  await expect(page.getByLabel('シード切り替え演出')).toHaveValue('exit-enter');
  await expect(page.getByLabel('シード切り替え間隔')).toHaveValue('30');
  const old={...original,settings:{...original.settings}};
  delete old.settings.standby;
  await category(page,'書き出し');
  await page.getByLabel('保存した3D設定ファイル',{exact:true}).setInputFiles({
    name:'legacy.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(old))
  });
  await category(page,'アニメーション');
  await expect(page.getByLabel('3D待機画面モードを有効化')).not.toBeChecked();
});
test('auto standby rotates seeds after configured idle interval and respects pause',async({page})=>{
  await start(page);
  await page.getByLabel('切り替え演出の長さ').fill('1');
  await page.getByLabel('シード切り替え間隔').fill('5');
  await page.getByRole('checkbox',{name:'操作中は自動切り替えを一時停止する'}).uncheck();
  const first=await page.getByTestId('current-seed').textContent();
  await expect.poll(()=>page.getByTestId('current-seed').textContent(),{timeout:12000}).not.toBe(first);
  await expect(page.getByTestId('three-preview')).toHaveAttribute('data-standby-active','false',{timeout:6000});
  await page.getByRole('button',{name:'3Dを一時停止'}).click();
  const frozen=await page.getByTestId('current-seed').textContent();
  await page.waitForTimeout(5700);
  expect(await page.getByTestId('current-seed').textContent()).toBe(frozen);
});

test('zoomed-in camera remains in place during a complete 3D morph',async({page})=>{
  await start(page);
  await page.getByLabel('シード切り替え演出').selectOption('morph');
  await page.getByLabel('切り替え演出の長さ').fill('2');
  await page.getByRole('checkbox',{name:'操作中は自動切り替えを一時停止する'}).uncheck();
  const preview=page.getByTestId('three-preview');
  const canvas=preview.locator('canvas');
  await canvas.hover();
  await page.mouse.wheel(0,-1500);
  await page.waitForTimeout(600);
  const before=JSON.parse((await saveJson(page)).toString('utf8'));
  expect(before.view?.position).toHaveLength(3);
  expect(before.view?.target).toHaveLength(3);
  await category(page,'アニメーション');
  await page.getByRole('button',{name:'今すぐ次の3Dシードへ'}).click();
  await expect(preview).toHaveAttribute('data-standby-active','true');
  await expect(preview).toHaveAttribute('data-standby-active','false',{timeout:8000});
  const after=JSON.parse((await saveJson(page)).toString('utf8'));
  const moved=Math.hypot(...before.view.position.map((n:number,i:number)=>n-after.view.position[i]));
  expect(moved).toBeLessThan(.05);
  expect(after.standbyComplete).toBe(true);
});

test('repeated standby changes cannot skip morph or background in one frame',async({page})=>{
  await start(page);
  const preview=page.getByTestId('three-preview');
  await page.getByLabel('シード切り替え演出').selectOption('morph');
  await page.getByLabel('切り替え演出の長さ').fill('3');
  await page.getByRole('checkbox',{name:'操作中は自動切り替えを一時停止する'}).uncheck();
  // Prime the old 3D frame clock. Its elapsed time is deliberately much
  // larger than the first frame of the next transition.
  await page.waitForTimeout(1600);
  for(let cycle=0;cycle<3;cycle++){
    const before=await page.getByTestId('current-seed').textContent();
    await page.getByRole('button',{name:'今すぐ次の3Dシードへ'}).click();
    await expect(preview).toHaveAttribute('data-standby-active','true');
    expect(await page.getByTestId('current-seed').textContent()).not.toBe(before);
    const initial=Number(await preview.getAttribute('data-standby-elapsed'));
    expect(Number.isFinite(initial)).toBe(true);
    expect(initial).toBeLessThan(1);
    const firstBlend=Number(await preview.getAttribute('data-standby-background-blend'));
    expect(Number.isFinite(firstBlend)).toBe(true);
    expect(firstBlend).toBeLessThan(.4);
    // A background and all objects must still be transitioning after an
    // initial 350 ms, rather than snapping to the next seed.
    await page.waitForTimeout(350);
    await expect(preview).toHaveAttribute('data-standby-active','true');
    const later=Number(await preview.getAttribute('data-standby-elapsed'));
    expect(later).toBeGreaterThanOrEqual(initial);
    expect(later).toBeLessThan(2.2);
    const laterBlend=Number(await preview.getAttribute('data-standby-background-blend'));
    expect(laterBlend).toBeGreaterThanOrEqual(firstBlend);
    expect(laterBlend).toBeLessThan(.9);
    await expect(preview).toHaveAttribute('data-standby-active','false',{timeout:12000});
    await expect(preview).toHaveAttribute('data-standby-entrance-complete','true');
  }
});
