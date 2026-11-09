import {test,expect} from '@playwright/test';
test('mobile edits precede exports; desktop retains two columns',async({page})=>{
 await page.goto('./');
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
