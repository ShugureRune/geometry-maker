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
  await page.locator('#three-standby-mode').selectOption('morph');
  await page.locator('#three-standby-transition').fill('2');
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
  await page.locator('#three-standby-mode').selectOption('exit-enter');
  await page.locator('#three-standby-transition').fill('1');
  await page.getByRole('button',{name:'今すぐ次の3Dシードへ'}).click();
  await expect(preview).toHaveAttribute('data-standby-mode','exit-enter');
  await expect(preview).toHaveAttribute('data-standby-active','false',{timeout:8000});
  await expect(preview).toHaveAttribute('data-standby-entrance-complete','true');
  await category(page,'アニメーション');
  await page.getByLabel('3D図形を順番に登場させる').check();
  await page.getByRole('button',{name:'3D登場演出を最初から再生'}).click();
  await expect(preview).toHaveAttribute('data-standby-entrance-complete','false');
});
test('neural connections retract, detach during motion, then reconnect after all figures arrive',async({page})=>{
  await start(page);
  await category(page,'装飾');
  await page.getByRole('button',{name:'ネオンネットワーク',exact:true}).click();
  const preview=page.getByTestId('three-preview');
  await expect.poll(async()=>Number(await preview.getAttribute('data-network-count'))).toBeGreaterThan(0);
  await category(page,'アニメーション');
  await page.locator('#three-standby-mode').selectOption('morph');
  await page.locator('#three-standby-transition').fill('6');
  await page.getByRole('button',{name:'今すぐ次の3Dシードへ'}).click();
  await expect(preview).toHaveAttribute('data-standby-active','true');
  await expect(preview).toHaveAttribute('data-standby-wire-phase','retract');
  // Crucially, neither outgoing nor incoming cables exist while figures move.
  await expect(preview).toHaveAttribute('data-standby-wire-phase','move',{timeout:7000});
  await expect(preview).toHaveAttribute('data-standby-active','true');
  await expect(preview).toHaveAttribute('data-standby-wire-phase','reconnect',{timeout:7500});
  await expect(preview).toHaveAttribute('data-standby-active','false',{timeout:7000});
  await expect(preview).toHaveAttribute('data-standby-wire-phase','off');
  await expect.poll(async()=>Number(await preview.getAttribute('data-network-count'))).toBeGreaterThan(0);
});

async function reconnectSparkCount(page:Page){
  return page.evaluate(async()=>{
    const url=performance.getEntriesByType('resource').find(e=>e.name.includes('@react-three_fiber.js'))!.name;
    const {_roots}=await import(/* @vite-ignore */url);
    const canvas=document.querySelector('[data-testid="three-preview"] canvas');
    const root=_roots.get(canvas) as any;
    return root?.store.getState().scene.getObjectByName('standby-reconnect-sparks')?.count??0;
  });
}

test('standby reconnect emission is visible with glow ON and disappears with OFF (ordinary 3D)',async({page})=>{
  await start(page);
  await category(page,'装飾');
  await page.getByRole('button',{name:'ネオンネットワーク',exact:true}).click();
  const preview=page.getByTestId('three-preview');
  await expect.poll(async()=>Number(await preview.getAttribute('data-network-count'))).toBeGreaterThan(0);
  await category(page,'アニメーション');
  await page.locator('#three-standby-mode').selectOption('morph');
  await page.locator('#three-standby-transition').fill('8');
  const glow=page.getByRole('checkbox',{name:'ワイヤー再接続時に発光'});
  await expect(glow).toBeChecked();
  await page.getByRole('button',{name:'今すぐ次の3Dシードへ'}).click();
  await expect(preview).toHaveAttribute('data-standby-wire-phase','reconnect',{timeout:15_000});
  await expect.poll(()=>reconnectSparkCount(page),{timeout:5_000,intervals:[40,100,150]}).toBeGreaterThan(0);
  await page.getByRole('button',{name:'3Dを一時停止',exact:true}).click();
  await expect.poll(()=>reconnectSparkCount(page)).toBeGreaterThan(0);
  const canvas=preview.locator('canvas');
  const on=await canvas.screenshot();
  const strength=page.locator('#three-standby-reconnect-intensity');
  await expect(strength).toHaveValue('25');
  await strength.fill('0');
  await expect.poll(()=>reconnectSparkCount(page)).toBe(0);
  const zero=await canvas.screenshot();
  expect(on.equals(zero)).toBe(false);
  await strength.fill('25');
  await expect.poll(()=>reconnectSparkCount(page)).toBeGreaterThan(0);
  await glow.uncheck();
  await expect.poll(()=>reconnectSparkCount(page)).toBe(0);
  const off=await canvas.screenshot();
  expect(on.equals(off)).toBe(false);
});

test('all normal 3D wires ignite together AFTER standby completion, at adjustable intensity',async({page})=>{
  await start(page);
  await category(page,'装飾');
  await page.getByRole('button',{name:'ネオンネットワーク',exact:true}).click();
  const preview=page.getByTestId('three-preview'),canvas=preview.locator('canvas');
  await expect.poll(async()=>Number(await preview.getAttribute('data-network-count'))).toBeGreaterThan(0);
  await category(page,'アニメーション');
  await page.locator('#three-standby-mode').selectOption('morph');
  await page.locator('#three-standby-transition').fill('4');
  await page.getByRole('checkbox',{name:'操作している間は止める'}).uncheck();
  await page.getByRole('button',{name:'今すぐ次の3Dシードへ'}).click();
  // Freeze on the first frame after the old layer disappears, when the
  // synchronized flash has just begun. An ordinary Playwright click often
  // misses a sub-second pulse.
  await page.waitForFunction(()=>{
    const preview=document.querySelector('[data-testid="three-preview"]') as HTMLElement|null;
    if(preview?.dataset.standbyActive!=='false'||
      Number(preview.dataset.standbyGlobalFlash??0)<.16)return false;
    const button=Array.from(document.querySelectorAll('button')).find(el=>el.textContent?.trim()==='3Dを一時停止');
    if(!button)return false;
    button.click();
    return true;
  },undefined,{polling:16,timeout:20_000});
  await expect(page.getByRole('button',{name:'3Dを再生',exact:true})).toBeVisible();
  const flash=async()=>Number(await preview.getAttribute('data-standby-global-flash'));
  await expect.poll(flash,{timeout:2000}).toBeGreaterThan(.02);
  const bright=await canvas.screenshot();
  const intensity=page.locator('#three-standby-reconnect-intensity');
  await intensity.fill('0');
  await expect.poll(flash).toBe(0);
  const dark=await canvas.screenshot();
  expect(bright.equals(dark)).toBe(false);
  await intensity.fill('25');
  await expect.poll(flash).toBeGreaterThan(.02);
  await page.getByRole('checkbox',{name:'ワイヤー再接続時に発光'}).uncheck();
  await expect.poll(flash).toBe(0);
});

test('3D standby settings roundtrip JSON, and legacy projects default safely off',async({page})=>{
  await start(page);
  await page.locator('#three-standby-mode').selectOption('exit-enter');
  await page.locator('#three-standby-interval').fill('30');
  await page.locator('#three-standby-transition').fill('3');
  await page.getByRole('checkbox',{name:'視点をそのまま使う'}).uncheck();
  await page.locator('#three-standby-reconnect-intensity').fill('15');
  await page.getByRole('checkbox',{name:'ワイヤー再接続時に発光'}).uncheck();
  const saved=await saveJson(page);
  const original=JSON.parse(saved.toString('utf8'));
  expect(original.settings.standby).toMatchObject({
    enabled:true,intervalSeconds:30,transitionSeconds:3,mode:'exit-enter',preserveCamera:false,reconnectGlow:false,reconnectIntensity:15
  });
  await category(page,'アニメーション');
  await page.getByLabel('3D待機画面モードを有効化').uncheck();
  await category(page,'書き出し');
  await page.getByLabel('保存した3D設定ファイル',{exact:true}).setInputFiles({
    name:'standby.json',mimeType:'application/json',buffer:saved
  });
  await category(page,'アニメーション');
  await expect(page.getByLabel('3D待機画面モードを有効化')).toBeChecked();
  await expect(page.locator('#three-standby-mode')).toHaveValue('exit-enter');
  await expect(page.locator('#three-standby-interval')).toHaveValue('30');
  await expect(page.getByRole('checkbox',{name:'ワイヤー再接続時に発光'})).not.toBeChecked();
  await page.getByRole('checkbox',{name:'ワイヤー再接続時に発光'}).check();
  await expect(page.locator('#three-standby-reconnect-intensity')).toHaveValue('15');
  const old={...original,settings:{...original.settings}};
  delete old.settings.standby;
  await category(page,'書き出し');
  await page.getByLabel('保存した3D設定ファイル',{exact:true}).setInputFiles({
    name:'legacy.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(old))
  });
  await category(page,'アニメーション');
  await expect(page.getByLabel('3D待機画面モードを有効化')).not.toBeChecked();
  await page.getByLabel('3D待機画面モードを有効化').check();
  await expect(page.getByRole('checkbox',{name:'ワイヤー再接続時に発光'})).toBeChecked();
});
test('auto standby rotates seeds after configured idle interval and respects pause',async({page})=>{
  await start(page);
  await page.locator('#three-standby-transition').fill('1');
  await page.locator('#three-standby-interval').fill('5');
  await page.getByRole('checkbox',{name:'操作している間は止める'}).uncheck();
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
  await page.locator('#three-standby-mode').selectOption('morph');
  await page.locator('#three-standby-transition').fill('2');
  await page.getByRole('checkbox',{name:'操作している間は止める'}).uncheck();
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
  await page.locator('#three-standby-mode').selectOption('morph');
  await page.locator('#three-standby-transition').fill('3');
  await page.getByRole('checkbox',{name:'操作している間は止める'}).uncheck();
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
