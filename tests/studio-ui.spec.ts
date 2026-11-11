import {test,expect} from '@playwright/test';

test('Studio v2 desktop quick tuning, command search, inspector, focus, and theme',async({page})=>{
  const errors:string[]=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto('./');
  await expect(page.locator('.studio-app')).toBeVisible();
  await expect(page.locator('.studio-controls')).toBeVisible();
  await expect(page.getByRole('navigation',{name:'モバイルクイック操作'})).toBeHidden();
  await page.getByLabel('クイック比率').selectOption('9:16');
  await expect(page.getByLabel('キャンバスの比率')).toHaveValue('9:16');
  await page.getByLabel('クイック密度').fill('75');
  await expect(page.getByLabel('図形密度')).toHaveValue('75');

  await page.getByRole('button',{name:'コマンド検索'}).click();
  await expect(page.getByRole('dialog',{name:'クイックコマンド'})).toBeVisible();
  await page.getByRole('searchbox',{name:'コマンドを検索'}).fill('背景');
  await page.getByText('背景の設定を開く',{exact:true}).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('navigation',{name:'設定カテゴリー'})
    .getByRole('button',{name:'背景',exact:true})).toHaveAttribute('aria-expanded','true');

  await page.getByRole('button',{name:'設定パネルの表示切り替え'}).click();
  await expect(page.locator('.studio-app')).toHaveClass(/studio-sidebar-collapsed/);
  await expect(page.locator('.studio-controls')).toBeHidden();
  await page.getByRole('button',{name:'設定パネルの表示切り替え'}).click();
  await expect(page.locator('.studio-controls')).toBeVisible();
  await page.getByRole('button',{name:'集中表示',exact:true}).click();
  await expect(page.locator('.studio-app')).toHaveClass(/studio-focus/);
  await expect(page.locator('.studio-controls')).toBeHidden();
  await page.keyboard.press('Escape');
  await expect(page.locator('.studio-app')).not.toHaveClass(/studio-focus/);
  await expect(page.locator('.studio-controls')).toBeVisible();

  await page.keyboard.press('Control+k');
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);

  await page.getByRole('button',{name:'UIテーマ切り替え'}).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme','light');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme','light');
  expect(errors).toEqual([]);
});

test('Studio v2 mobile action dock and command navigation do not overflow',async({browser})=>{
  const context=await browser.newContext({viewport:{width:390,height:844},
    deviceScaleFactor:2,isMobile:true,hasTouch:true});
  const page=await context.newPage();
  const errors:string[]=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto('./');
  const dock=page.getByRole('navigation',{name:'モバイルクイック操作'});
  await expect(dock).toBeVisible();
  await expect(page.locator('.studio-preview-panel')).toBeVisible();
  const original=await page.getByTestId('current-seed').textContent();
  await dock.getByRole('button',{name:'新規'}).click();
  await expect(page.getByTestId('current-seed')).not.toHaveText(original!);

  await dock.getByRole('button',{name:'保存'}).click();
  await expect(page.getByRole('navigation',{name:'設定カテゴリー'})
    .getByRole('button',{name:'書き出し',exact:true})).toHaveAttribute('aria-expanded','true');
  await dock.getByRole('button',{name:'集中'}).click();
  await expect(page.locator('.studio-app')).toHaveClass(/studio-focus/);
  await dock.getByRole('button',{name:'戻る'}).click();
  await expect(page.locator('.studio-app')).not.toHaveClass(/studio-focus/);

  await dock.getByRole('button',{name:'探す'}).click();
  await page.getByRole('searchbox',{name:'コマンドを検索'}).fill('カラー');
  await page.getByText('カラーの設定を開く',{exact:true}).click();
  await expect(page.getByRole('navigation',{name:'設定カテゴリー'})
    .getByRole('button',{name:'カラー',exact:true})).toHaveAttribute('aria-expanded','true');
  await expect.poll(async()=>page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1)).toBe(true);
  expect(errors).toEqual([]);
  await context.close();
});
