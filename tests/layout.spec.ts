import {test,expect} from '@playwright/test';
test('mobile edits precede exports; desktop retains two columns',async({page})=>{
 await page.goto('./');await page.getByLabel('アニメーションを有効化').uncheck();await page.getByLabel('シード値',{exact:true}).fill('undefined-heartbeat');await page.getByLabel('発光強度').fill('0');
 for(const width of [390,720,1440]){
  await page.setViewportSize({width,height:844});
  const preview=(await page.locator('.preview-panel').boundingBox())!;
  const controls=(await page.locator('.controls').boundingBox())!;
  const exports=(await page.locator('.export-area').boundingBox())!;
  if(width<=720){expect(controls.y).toBeGreaterThanOrEqual(preview.y+preview.height-1);expect(exports.y).toBeGreaterThanOrEqual(controls.y+controls.height-1);}
  else {expect(controls.x).toBeLessThan(preview.x);expect(exports.x).toBe(preview.x);expect(exports.y).toBeGreaterThanOrEqual(preview.y+preview.height-1);}
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 }
});
