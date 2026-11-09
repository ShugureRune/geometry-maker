import {test,expect} from '@playwright/test';
test('random startup, automatic growth, 200% glow and independent persisted UI theme',async({page})=>{
 await page.goto('./');const seed=page.getByLabel('シード値',{exact:true});const first=await seed.inputValue();expect(first).toMatch(/^[0-9a-f]{24}$/);
 await expect(page.getByLabel('アニメーションを有効化')).toBeChecked();await expect(page.getByLabel('発光強度')).toHaveValue('100');
 await expect(page.getByRole('button',{name:'一時停止',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'完成状態を表示',exact:true}).click();const before=await page.getByTestId('preview').evaluate(n=>n.outerHTML);
 await page.getByRole('button',{name:'UIテーマ切り替え'}).click();expect(await page.getByTestId('preview').evaluate(n=>n.outerHTML)).toBe(before);await expect(page.locator('html')).toHaveAttribute('data-theme','light');
 await page.getByLabel('発光強度').fill('200');await page.reload();expect(await seed.inputValue()).not.toBe(first);await expect(page.locator('html')).toHaveAttribute('data-theme','light');
 await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
