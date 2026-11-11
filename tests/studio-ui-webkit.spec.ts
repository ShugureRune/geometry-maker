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
  await dock.getByRole('button',{name:'探す'}).tap();
  await expect(page.getByRole('dialog',{name:'クイックコマンド'})).toBeVisible();
  await page.getByRole('searchbox',{name:'コマンドを検索'}).fill('背景');
  await page.getByText('背景の設定を開く',{exact:true}).tap();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('navigation',{name:'設定カテゴリー'})
    .getByRole('button',{name:'背景',exact:true})).toHaveAttribute('aria-expanded','true');
  const info=page.locator('#panel-background .studio-info-disclosure').first();
  await expect(info.locator('.studio-info-content')).toBeHidden();
  await info.locator('summary').tap();
  await expect(info.locator('.studio-info-content')).toBeVisible();
  await info.locator('summary').tap();
  await expect(info.locator('.studio-info-content')).toBeHidden();
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
