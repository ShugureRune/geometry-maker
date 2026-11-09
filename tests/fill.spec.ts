import {test,expect} from '@playwright/test';
test('fill approaches its inherited final opacity without a completion jump, with and without glow',async({page})=>{
 await page.goto('/tests/fixtures/fill.html');
 for(const glow of [0,100]){
  const samples:number[][]=[];
  for(const progress of [.9,.95,.99,1]){
   await page.evaluate(({progress,glow})=>(window as unknown as {fillFrame:(p:number,g:number)=>void}).fillFrame(progress,glow),{progress,glow});
   await expect(page.locator('[data-shape-id]')).toHaveCount(9);
   const values=await page.locator('[data-shape-id]').evaluateAll(nodes=>nodes.map(n=>({target:Number(n.getAttribute('fill-opacity')),actual:[...n.querySelectorAll('path')].map(p=>Number(getComputedStyle(p).fillOpacity))})));
   for(const v of values)for(const actual of v.actual){expect(actual).toBeLessThanOrEqual(v.target+1e-6);expect(actual).toBeCloseTo(v.target*progress,5);}
   const pixels=await page.getByTestId('preview').evaluate(async svg=>{
    const clone=svg.cloneNode(true) as SVGSVGElement;clone.setAttribute('width','1200');clone.setAttribute('height','900');const url=URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(clone)],{type:'image/svg+xml'}));
    try{const image=new Image();image.src=url;await image.decode();const c=document.createElement('canvas');c.width=1200;c.height=900;const ctx=c.getContext('2d')!;ctx.drawImage(image,0,0);return Array.from({length:9},(_,i)=>Array.from(ctx.getImageData(200+i%3*400,150+Math.floor(i/3)*300,1,1).data).slice(0,3)).flat();}finally{URL.revokeObjectURL(url);}
   });samples.push(pixels);
   await page.getByTestId('preview').screenshot({path:`test-results/fill-${glow}-${progress}.png`});
  }
  for(let i=0;i<samples[2].length;i++)expect(Math.abs(samples[3][i]-samples[2][i])).toBeLessThanOrEqual(3);
 }
});
