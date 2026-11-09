import {test,expect} from '@playwright/test';
test('mobile category grid and desktop preview retain usable layouts',async({page})=>{
 await page.goto('./');for(const width of [390,720,1440]){
 await page.setViewportSize({width,height:844});const preview=(await page.locator('.preview-panel').boundingBox())!,controls=(await page.locator('.controls').boundingBox())!;
 if(width<=720)expect(controls.y).toBeGreaterThanOrEqual(preview.y+preview.height-1);else expect(controls.x+controls.width).toBeLessThanOrEqual(preview.x+1);
 const buttons=page.getByRole('navigation',{name:'設定カテゴリー'}).getByRole('button');await expect(buttons).toHaveCount(6);for(const button of await buttons.all()){const box=(await button.boundingBox())!;expect(box.width).toBeGreaterThan(44);expect(box.height).toBeGreaterThanOrEqual(44);}
 await page.getByRole('button',{name:'書き出し',exact:true}).click();await expect(page.getByRole('button',{name:'PNGを書き出す',exact:true})).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.getByRole('button',{name:'図形',exact:true}).click();
 }
});
