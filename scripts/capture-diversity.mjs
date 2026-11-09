import {chromium} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
const output='docs/diversity-v5';await mkdir(output,{recursive:true});
const seeds=['undefined-heartbeat','neon-city','design-6','001',...Array.from({length:20},(_,i)=>`diversity-${i+4}`)];
const ratios=['16:9','9:16','1:1'];
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH});
const entries=[],pictures=new Map(),errors=[];
const key=(version,theme,seed,ratio,density)=>[version,theme,seed,ratio,density].join('|');
async function theme(page,t){
 await page.getByLabel('カラー変更モード').selectOption('manual');
 if(t==='dark'){
  await page.getByRole('button',{name:'グラデーション',exact:true}).click();
  for(const [i,c] of ['#101b2d','#241938','#102a30'].entries())await page.getByLabel(`グラデーション色${i+1}`,{exact:true}).fill(c);
 } else {await page.getByRole('button',{name:'単色',exact:true}).click();await page.getByLabel('背景色',{exact:true}).fill('#faf8ff');}
 for(const [i,c]of (t==='dark'?['#ba9bff','#6f87bc','#9af5d8']:['#704096','#4d638e','#236e64']).entries())await page.getByLabel(['主役色','補助色','アクセント色'][i],{exact:true}).fill(c);
}
async function capture(page,version,t,seed,ratio,density){
 await page.getByLabel('シード値',{exact:true}).fill(seed);
 await page.getByLabel('キャンバスの比率').selectOption(ratio);
 await page.getByLabel('図形密度').fill(String(density));
 const svg=page.getByTestId('preview');
 pictures.set(key(version,t,seed,ratio,density),(await svg.screenshot()).toString('base64'));
 entries.push({version,theme:t,seed,ratio,density,type:await svg.getAttribute('data-composition'),shapes:await page.locator('[data-testid="shapes"] > g').count()});
}
async function sheet(name,title,cells,columns=4){
 const page=await browser.newPage({viewport:{width:1600,height:1100}});
 await page.setViewportSize({width:1600,height:name==='shape-growth'?560:1100});
 await page.setContent(`<html><meta charset="utf-8"><style>body{background:#111526;color:#eee;font:15px sans-serif;margin:24px}main{display:grid;grid-template-columns:repeat(${columns},1fr);gap:12px}article{background:#21283a;padding:10px}img{width:100%;height:${name==='shape-growth'?390:220}px;object-fit:contain}h2{font-size:15px;font-weight:500}</style><h1>${title}</h1><main>${cells.map(({label,image})=>`<article><h2>${label}</h2><img src="data:image/png;base64,${image}"></article>`).join('')}</main></html>`);
 await page.locator('img').evaluateAll(nodes=>Promise.all(nodes.map(n=>n.decode())));
 await page.screenshot({path:`${output}/${name}.png`,fullPage:true});await page.close();
}
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}});page.on('pageerror',e=>errors.push(e.message));
 await page.goto(process.env.PREVIEW_URL||'http://127.0.0.1:5173/');
 for(const t of ['dark','light']){
  await theme(page,t);
  for(const seed of seeds)for(const ratio of ratios)await capture(page,'v5',t,seed,ratio,50);
  console.log('captured',t,'24 seeds / 3 ratios');
  for(const ratio of ratios){const cells=seeds.map(seed=>{const e=entries.find(e=>e.seed===seed&&e.theme===t&&e.ratio===ratio&&e.version==='v5');return{label:`${seed} / ${e.type} / ${e.shapes} shapes`,image:pictures.get(key('v5',t,seed,ratio,50))};});await sheet(`overview-${t}-${ratio.replace(':','x')}`,`2d-v5 / ${t} / ${ratio} / 24 seeds / 50%`,cells);}
 }
 await theme(page,'dark');
 for(const seed of seeds.slice(0,6))for(const ratio of ratios)for(const density of [0,100])await capture(page,'v5','dark',seed,ratio,density);
 for(const ratio of ratios)await sheet(`density-${ratio.replace(':','x')}`,`Density / ${ratio} / 0% → 50% → 100%`,seeds.slice(0,6).flatMap(seed=>[0,50,100].map(density=>({label:`${seed} / ${density}%`,image:pictures.get(key('v5','dark',seed,ratio,density))}))),3);
 await page.goto(process.env.BASELINE_URL||'http://127.0.0.1:4173/');
 for(const t of ['dark','light']){
  await theme(page,t);for(const seed of seeds.slice(0,8))await capture(page,'v4',t,seed,'16:9',50);
  await sheet(`comparison-${t}`,`v4 → v5 / ${t} / same seed, palette, ratio and density`,seeds.slice(0,8).flatMap(seed=>['v4','v5'].map(v=>({label:`${seed} / ${v}`,image:pictures.get(key(v,t,seed,'16:9',50))}))),4);
 }
 await page.goto(new URL('/tests/fixtures/shapes.html',process.env.PREVIEW_URL||'http://127.0.0.1:5173/').href);
 const atlas=[];
 for(const t of [0,.5,1]){await page.evaluate(t=>window.atlasProgress(t),t);await page.waitForTimeout(50);atlas.push({label:`All 16 new kinds / progress ${t}`,image:(await page.getByTestId('preview').screenshot()).toString('base64')});}
 await sheet('shape-growth','Shape atlas / 0% → 50% → 100% (rows match NEW_SHAPE_KINDS)',atlas,3);
 if(errors.length)throw Error(errors.join('\n'));
 await writeFile(`${output}/manifest.json`,JSON.stringify({seeds,ratios,entries,errors},null,2)+'\n');
 console.log('saved sheets and manifest');
}finally{await browser.close();}
