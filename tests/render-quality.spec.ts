import { test, expect, type Page } from '@playwright/test';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
async function save(page:Page,name:string,path:string){const pending=page.waitForEvent('download');await page.getByRole('button',{name,exact:true}).click();const download=await Promise.race([pending,page.getByRole('alert').first().waitFor({state:'visible',timeout:0}).then(async()=>{throw new Error(await page.getByRole('alert').first().textContent() || 'export error');})]);await download.saveAs(path);return await readFile(path);}
const cases=[
  {seed:'undefined-heartbeat',ratio:'16:9',width:1280,height:720,glow:0,fps:24},
  {seed:'neon-city',ratio:'16:9',width:1920,height:1080,glow:50,fps:30},
  {seed:'design-6',ratio:'16:9',width:3840,height:2160,glow:100,fps:60},
  {seed:'undefined-heartbeat',ratio:'9:16',width:1080,height:1920,glow:150,fps:30},
  {seed:'neon-city',ratio:'1:1',width:2048,height:2048,glow:200,fps:24},
];
test('same-size preview, PNG, SVG, MP4 and WebM preserve rendering across resolutions and versions',async({page})=>{
 test.setTimeout(900000);
 await mkdir('test-results/render-quality',{recursive:true});
 const results:unknown[]=[];
 for(const version of ['2d-v4','2d-v5'])for(const item of cases){
  await page.goto('./');await page.getByLabel('アニメーションを有効化').uncheck();
  await page.getByLabel('生成アルゴリズム').selectOption(version);
  await page.getByLabel('シード値',{exact:true}).fill(item.seed);await page.getByLabel('シード値',{exact:true}).press('Enter');
  await page.getByLabel('キャンバスの比率').selectOption(item.ratio);
  await page.getByRole('button',{name:'ネオンナイト',exact:true}).click();
  await page.getByLabel('発光強度').fill(String(item.glow));
  await page.getByLabel('幅 (px)',{exact:true}).fill(String(item.width));await page.getByLabel('高さ (px)',{exact:true}).fill(String(item.height));
  await page.addStyleTag({content:'.canvas-frame{width:320px!important;max-height:none!important}.artwork{width:100%;height:100%}'});
  const prefix=`test-results/render-quality/${version}-${item.seed}-${item.width}x${item.height}`;
  const preview=page.getByTestId('preview');await expect(preview.locator('[vector-effect="non-scaling-stroke"]')).toHaveCount(0);
  const manifest=await preview.locator('[data-shape-id]').evaluateAll(nodes=>nodes.map(n=>({id:n.getAttribute('data-shape-id'),kind:n.getAttribute('data-kind'),transform:n.getAttribute('transform'),stroke:n.getAttribute('stroke-width')})));
  const previewBytes=await preview.screenshot({path:`${prefix}-preview.png`,scale:'css'});
  const svg=await save(page,'SVGを書き出す',`${prefix}.svg`);
  const png=await save(page,'PNGを書き出す',`${prefix}.png`);
  await page.getByLabel('アニメーションを有効化').check();await page.getByLabel('成長時間（秒）').fill('1');await page.getByLabel('再生速度',{exact:true}).selectOption('4');
  await page.locator('summary').filter({hasText:'動画書き出し'}).click();
  await page.getByLabel('動画の幅 (px)').fill(String(item.width));await page.getByLabel('動画の高さ (px)').fill(String(item.height));await page.getByLabel('動画FPS').selectOption(String(item.fps));
  const images:{name:string,data:string}[]=[{name:'PREVIEW',data:`data:image/png;base64,${previewBytes.toString('base64')}`},{name:'PNG',data:`data:image/png;base64,${png.toString('base64')}`},{name:'SVG',data:`data:image/svg+xml;base64,${svg.toString('base64')}`}];
  for(const format of ['mp4','webm']){
   console.log(version,item.seed,item.width,item.height,format);
   await page.getByLabel('動画形式',{exact:true}).selectOption(format);
   await expect(page.getByRole('button',{name:'動画を書き出す',exact:true})).toBeEnabled({timeout:30000});
   await save(page,'動画を書き出す',`${prefix}.${format}`);
   execFileSync('ffmpeg',['-y','-v','error','-i',`${prefix}.${format}`,'-vf',`select=eq(n\\,${Math.ceil(.25*item.fps)})`,'-frames:v','1',`${prefix}-${format}-last.png`]);
   images.push({name:format.toUpperCase(),data:`data:image/png;base64,${(await readFile(`${prefix}-${format}-last.png`)).toString('base64')}`});
  }
  // Compare actual downloaded files at the same CSS size as the live SVG.
  const rendered=await page.evaluate(async({images,svgText,manifest})=>{
    const source=new DOMParser().parseFromString(svgText,'image/svg+xml');
    const outputManifest=[...source.querySelectorAll('[data-shape-id]')].map(n=>({id:n.getAttribute('data-shape-id'),kind:n.getAttribute('data-kind'),transform:n.getAttribute('transform'),stroke:n.getAttribute('stroke-width')}));
    if(JSON.stringify(manifest)!==JSON.stringify(outputManifest))throw new Error('Geometry or stroke widths changed on export');
    const box=source.documentElement.getAttribute('viewBox')!.split(' ').map(Number);const canvas=document.createElement('canvas');canvas.width=320;canvas.height=Math.round(320*box[3]/box[2]);const ctx=canvas.getContext('2d')!;
    const pixels:Uint8ClampedArray[]=[];const outputs=[];
    for(const item of images){const image=new Image();image.src=item.data;await image.decode();ctx.clearRect(0,0,canvas.width,canvas.height);ctx.imageSmoothingQuality='high';ctx.drawImage(image,0,0,canvas.width,canvas.height);pixels.push(ctx.getImageData(0,0,canvas.width,canvas.height).data);outputs.push({name:item.name,png:canvas.toDataURL().split(',')[1]});}
    const errors=pixels.map(data=>{let sum=0;for(let i=0;i<data.length;i+=4)for(let c=0;c<3;c++)sum+=Math.abs(data[i+c]-pixels[0][i+c]);return sum/(data.length/4*3);});return{outputs,errors,kinds:[...new Set(outputManifest.map(n=>n.kind))]};
  },{images,svgText:svg.toString(),manifest});
  for(const error of rendered.errors)expect(error).toBeLessThan(5);
  for(const image of rendered.outputs)await writeFile(`${prefix}-${image.name.toLowerCase()}-display.png`,Buffer.from(image.png,'base64'));
  results.push({version,...item,errors:rendered.errors,kinds:rendered.kinds});
 }
 await writeFile('test-results/render-quality/results.json',JSON.stringify(results,null,2));
});
test('scene-space stroke coverage is invariant with output resolution and DPR',async({browser})=>{
 for(const dpr of [1,2]){
  const context=await browser.newContext({deviceScaleFactor:dpr,viewport:{width:1000,height:800}});const page=await context.newPage();await page.goto('/tests/fixtures/strokes.html');
  const preview=page.getByTestId('preview');await expect(preview.locator('[data-shape-id]')).toHaveCount(3);
  const screenshot=(await preview.screenshot({scale:'css'})).toString('base64');
  const result=await page.evaluate(async({screenshot})=>{
   const source=document.querySelector('[data-testid="preview"]')!;
   async function coverage(url:string){const image=new Image();image.src=url;await image.decode();const c=document.createElement('canvas');c.width=640;c.height=360;const ctx=c.getContext('2d')!;ctx.imageSmoothingQuality='high';ctx.drawImage(image,0,0,640,360);const pixels=ctx.getImageData(320,0,1,360).data;return [80,180,280].map(center=>{let sum=0;for(let y=center-12;y<=center+12;y++)sum+=pixels[y*4]/255;return sum;});}
   const native=await coverage(`data:image/png;base64,${screenshot}`);const outputs=[];
   for(const width of [1280,1920,3840]){const clone=source.cloneNode(true) as SVGSVGElement;clone.removeAttribute('class');clone.removeAttribute('style');clone.setAttribute('width',String(width));clone.setAttribute('height',String(width*9/16));const url=URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(clone)],{type:'image/svg+xml'}));
    const image=new Image();image.src=url;await image.decode();const canvas=document.createElement('canvas');canvas.width=width;canvas.height=width*9/16;canvas.getContext('2d')!.drawImage(image,0,0);URL.revokeObjectURL(url);outputs.push(await coverage(canvas.toDataURL()));}
   return{native,outputs};
  },{screenshot});
  for(const value of result.native)expect(Math.abs(value-1.6)).toBeLessThan(.2);
  for(const coverage of result.outputs)for(const value of coverage)expect(Math.abs(value-1.6)).toBeLessThan(.2);
  await context.close();
 }
});
