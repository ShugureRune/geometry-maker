import { test, expect, type Locator } from '@playwright/test';

async function snapshot(nodes:Locator) {
 return nodes.evaluateAll(elements=>{
  const canonical=(n:Element):unknown=>[n.tagName,[...n.attributes].map(a=>[a.name,a.value]).sort((a,b)=>a[0].localeCompare(b[0])),[...n.children].map(canonical)];
  return Object.fromEntries(elements.map(n=>[n.getAttribute('data-shape-id')!,JSON.stringify(canonical(n))]));
 });
}
test('density preserves hero geometry, candidate positions and colors across ratios',async({page})=>{
 await page.goto('./');await page.getByLabel('アニメーションを有効化').uncheck();await page.getByLabel('シード値',{exact:true}).fill('undefined-heartbeat');await page.getByLabel('発光強度').fill('0');
 const slider=page.getByLabel('図形密度');
 await expect(slider).toHaveValue('50');
 await expect(slider).toHaveAttribute('step','5');
 for (const width of [1440,390]) {
  await page.setViewportSize({width,height:900});
  for(const ratio of ['16:9','9:16','1:1']) {
   await page.getByLabel('キャンバスの比率').selectOption(ratio);
   await slider.fill('100');
   const all=await snapshot(page.locator('[data-testid="shapes"] > g'));
   const hero=await snapshot(page.locator('[data-testid="shapes"] > [data-role="hero"]'));
   const colors=await page.locator('input[type="color"]').evaluateAll(nodes=>nodes.map(n=>(n as HTMLInputElement).value));
   let count=0;
   for(const density of [0,25,50,75,100]) {
    await slider.fill(String(density));
    const visible=Object.entries(await snapshot(page.locator('[data-testid="shapes"] > g')));
    expect(visible.length).toBeGreaterThanOrEqual(count);count=visible.length;
    for(const [id,html] of visible)expect(html).toBe(all[id!]);
    if(density===0)expect(count).toBe(0);
    else expect(await snapshot(page.locator('[data-testid="shapes"] > [data-role="hero"]'))).toEqual(hero);
   }
   await slider.fill('25');await slider.fill('100');
   expect(await snapshot(page.locator('[data-testid="shapes"] > g'))).toEqual(all);
   expect(await page.locator('input[type="color"]').evaluateAll(nodes=>nodes.map(n=>(n as HTMLInputElement).value))).toEqual(colors);
  }
 }
 // A real pointer interaction updates before pointer release; keyboard is usable too.
 await slider.scrollIntoViewIfNeeded();
 const bounds=(await slider.boundingBox())!;
 await page.mouse.move(bounds.x+bounds.width-8,bounds.y+bounds.height/2);
 await page.mouse.down();
 await page.mouse.move(bounds.x+8,bounds.y+bounds.height/2,{steps:4});
 expect(Number(await slider.inputValue())).toBeLessThan(100);
 await page.mouse.up();
 await slider.focus();await page.keyboard.press('Home');
 await expect(slider).toHaveValue('0');await page.keyboard.press('ArrowRight');
 await expect(slider).toHaveValue('5');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});

test.describe('touch density control',()=>{
 test.use({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
 test('updates via touch on a phone-sized screen',async({page})=>{
  await page.goto('./');await page.getByLabel('アニメーションを有効化').uncheck();await page.getByLabel('シード値',{exact:true}).fill('undefined-heartbeat');await page.getByLabel('発光強度').fill('0');
  const slider=page.getByLabel('図形密度');
  await slider.fill('0');await slider.scrollIntoViewIfNeeded();
  const b=(await slider.boundingBox())!;expect(b.height).toBeGreaterThanOrEqual(44);
  await page.touchscreen.tap(b.x+b.width/2,b.y+b.height/2);
  await expect(slider).toHaveValue('50');
  expect(await page.locator('[data-testid="shapes"] > g').count()).toBeGreaterThan(0);
 });
});
