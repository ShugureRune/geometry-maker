import {test,expect} from '@playwright/test';

test.use({browserName:'webkit',viewport:{width:390,height:844},
  deviceScaleFactor:2,isMobile:true,hasTouch:true});
test.setTimeout(75_000);

test('iPhone-size WebKit Studio v2 dock, command search and focus navigation',async({page})=>{
  const errors:string[]=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto('./');
  const dock=page.getByRole('navigation',{name:'モバイルクイック操作'});
  await expect(dock).toBeVisible();
  await expect(page.getByLabel('クイック比率')).toBeVisible();
  const seedHint=page.locator('#panel-shapes .studio-setting-label').filter({
    has:page.getByText('模様の合言葉',{exact:true}),
  }).locator('.studio-info-disclosure > summary');
  await expect(seedHint).toBeVisible();
  const box=await seedHint.boundingBox(),label=await page.locator('label[for="seed"]').boundingBox();
  expect(box).not.toBeNull();expect(label).not.toBeNull();
  expect(box!.width).toBeLessThanOrEqual(34);
  expect(box!.x).toBeGreaterThan(label!.x+label!.width-2);
  const popup=page.getByTestId('studio-info-popover');
  await seedHint.tap();
  await expect(popup).toContainText('同じ模様');
  const bubble=await popup.boundingBox();
  expect(bubble).not.toBeNull();
  expect(bubble!.width).toBeGreaterThan(280);
  expect(bubble!.width).toBeLessThanOrEqual(370);
  expect(bubble!.x).toBeGreaterThanOrEqual(8);
  expect(bubble!.x+bubble!.width).toBeLessThanOrEqual(390);
  await page.touchscreen.tap(8,8);
  await expect(popup).toHaveCount(0);
  await seedHint.tap();
  await expect(popup).toBeVisible();
  await seedHint.tap();
  await expect(popup).toHaveCount(0);
  await dock.getByRole('button',{name:'探す'}).tap();
  await expect(page.getByRole('dialog',{name:'クイックコマンド'})).toBeVisible();
  await page.getByRole('searchbox',{name:'コマンドを検索'}).fill('背景');
  await page.getByText('背景の設定を開く',{exact:true}).tap();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('navigation',{name:'設定カテゴリー'})
    .getByRole('button',{name:'背景',exact:true})).toHaveAttribute('aria-expanded','true');
  const info=page.locator('#panel-background .studio-info-disclosure').first();
  await expect(popup).toHaveCount(0);
  await info.locator('summary').tap();
  await expect(popup).toBeVisible();
  await page.locator('#panel-background h2.category-title').tap();
  await expect(popup).toHaveCount(0);
  await info.locator('summary').tap();
  await expect(popup).toBeVisible();
  await info.locator('summary').tap();
  await expect(popup).toHaveCount(0);
  const checkbox=page.getByLabel('グリッド背景を有効化');
  await checkbox.check();
  await expect(checkbox).toBeChecked();
  await checkbox.uncheck();
  await expect(checkbox).not.toBeChecked();
  await dock.getByRole('button',{name:'集中'}).tap();
  await expect(page.locator('.studio-app')).toHaveClass(/studio-focus/);
  await dock.getByRole('button',{name:'戻る'}).tap();
  await expect(page.locator('.studio-app')).not.toHaveClass(/studio-focus/);
  const noOverflow=await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1);
  expect(noOverflow).toBe(true);
  expect(errors).toEqual([]);
});
