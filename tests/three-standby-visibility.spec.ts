import {test,expect,type Page} from '@playwright/test';
test.setTimeout(150_000);

async function category(page:Page,label:string){
  const tab=page.getByRole('navigation',{name:'設定カテゴリー'})
    .getByRole('button',{name:label,exact:true});
  if(await tab.getAttribute('aria-expanded')!=='true')await tab.click();
}

test('standby morph and repeated entrances coexist with connected neon wires',async({page})=>{
  const errors:string[]=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',msg=>{
    if(msg.type()==='error'&&/WebGL|Shader|Buffer|RangeError/.test(msg.text()))
      errors.push(msg.text());
  });
  await page.goto('./');
  await page.getByRole('button',{name:'3Dモード',exact:true}).click();
  await category(page,'図形');
  await page.getByLabel('3D描画品質').selectOption('low');
  const preview=page.getByTestId('three-preview');
  await expect(preview.locator('canvas')).toBeVisible();
  await category(page,'装飾');
  await page.getByRole('button',{name:'ネオンネットワーク',exact:true}).click();
  await expect(page.getByLabel('図形の接続を有効化')).toBeChecked();
  await page.locator('#network-distance').fill('15');
  await expect.poll(async()=>Number(await preview.getAttribute('data-network-count')))
    .toBeGreaterThan(0);
  await category(page,'アニメーション');
  await page.getByLabel('出現・消失アニメーションを有効化').check();
  await page.locator('#three-visibility-duration').fill('4');
  await page.locator('#three-visibility-ratio').fill('35');
  await page.getByLabel('主役図形は常に表示').uncheck();
  await page.getByLabel('3D待機画面モードを有効化').check();
  await page.locator('#three-standby-transition').fill('1');
  const pause=page.getByRole('button',{name:'3Dを一時停止',exact:true});
  await expect(pause).toBeEnabled();

  for(const mode of ['fade','scale','fade-scale'] as const){
    await page.locator('#three-visibility-mode').selectOption(mode);
    for(const transition of ['morph','exit-enter'] as const){
      await page.locator('#three-standby-mode').selectOption(transition);
      // Prime the old visibility phase so old and new meshes do not share a clock.
      await page.waitForTimeout(350);
      const old=await page.getByTestId('current-seed').textContent();
      await page.getByRole('button',{name:'今すぐ次の3Dシードへ'}).click();
      await expect(preview).toHaveAttribute('data-standby-active','true');
      await expect(preview).toHaveAttribute('data-standby-mode',transition);
      expect(await page.getByTestId('current-seed').textContent()).not.toBe(old);
      await expect(preview).toHaveAttribute('data-standby-active','false',{timeout:10_000});
      await expect.poll(async()=>Number(await preview.getAttribute('data-network-count')))
        .toBeGreaterThan(0);
      await expect(preview.locator('canvas')).toBeVisible();
    }
  }
  await pause.click();
  expect(errors).toEqual([]);
});
