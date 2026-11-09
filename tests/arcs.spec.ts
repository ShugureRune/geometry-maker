import {test,expect} from '@playwright/test';
test('partial two/three-ring arcs preserve dash gaps throughout growth with and without glow',async({page})=>{
 await page.goto('/tests/fixtures/arcs.html');
 for(const glow of [0,100])for(const progress of [.25,.9,.95,.99,1]){
  await page.evaluate(({progress,glow})=>(window as unknown as {arcFrame:(p:number,g:number)=>void}).arcFrame(progress,glow),{progress,glow});
  await expect(page.locator('[data-shape-id]')).toHaveCount(2);
  for(const id of ['fill-0','fill-1']){
   const arc=page.locator(`[data-shape-id="${id}"] > path`).nth(1);
   await expect(arc).not.toHaveAttribute('pathLength');
   const computed=await arc.evaluate(n=>({dash:getComputedStyle(n).strokeDasharray,offset:getComputedStyle(n).strokeDashoffset,length:(n as SVGPathElement).getTotalLength()}));
   expect(computed.dash).toBe('6.5px, 6px');expect(computed.offset).toBe('0px');expect(computed.length).toBeGreaterThan(0);
  }
 }
});
