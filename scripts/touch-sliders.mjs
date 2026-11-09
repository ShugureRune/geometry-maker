import{webkit,chromium,devices}from'playwright';
import{mkdir}from'node:fs/promises';
const name=process.env.TOUCH_BROWSER||'webkit',browser=await(name==='webkit'?webkit:chromium).launch(name==='chromium'?{executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium'}:process.env.WEBKIT_EXECUTABLE?{executablePath:process.env.WEBKIT_EXECUTABLE}:{});
const page=await browser.newPage({...devices[name==='webkit'?'iPhone 13':'Pixel 7']});await page.emulateMedia({reducedMotion:'reduce'});await page.goto(process.env.TEST_BASE_URL||'http://127.0.0.1:5173');await page.getByRole('button',{name:'アニメーション',exact:true}).click();await page.getByLabel('自動待機画面を有効化').check();await page.getByText('待機画面の詳細設定',{exact:true}).click();
for(const slider of await page.locator('.ambient-range input').all()){
 const before=await slider.inputValue();await slider.scrollIntoViewIfNeeded();const box=await slider.boundingBox();await page.touchscreen.tap(box.x+box.width*.7,box.y+box.height/2);const after=await slider.inputValue();if(before===after)throw new Error('Touch did not update '+await slider.getAttribute('id'));console.log(await slider.getAttribute('id'),before,after);
}
if(await page.locator('.ambient-controls input[type=number]').count())throw new Error('Numeric input remains');if(!await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth))throw new Error('Horizontal overflow');await mkdir('docs/chunk-scroll',{recursive:true});await page.screenshot({path:`docs/chunk-scroll/${name}-phone.png`,fullPage:true});await browser.close();console.log(name+' TOUCH PASSED');
