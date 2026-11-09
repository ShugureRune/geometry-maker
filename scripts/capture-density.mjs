// Local browser evidence; no deployment or product export dependencies.
import { chromium } from '@playwright/test';
import { mkdir,readFile,writeFile } from 'node:fs/promises';
const folder='docs/density';await mkdir(folder,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH});
const entries=[];
try {
 const page=await browser.newPage({viewport:{width:1440,height:1000}});
 await page.goto(process.env.PREVIEW_URL||'http://127.0.0.1:5173/');
 await page.getByLabel('生成アルゴリズム').selectOption('2d-v4');
 for(const seed of ['undefined-heartbeat','neon-city']) {
  await page.getByLabel('シード値',{exact:true}).fill(seed);
  for(const ratio of ['16:9','9:16','1:1']) for(const density of [0,25,50,75,100]) {
   await page.getByLabel('キャンバスの比率').selectOption(ratio);
   await page.getByLabel('図形密度').fill(String(density));
   const name=`${seed}-${ratio.replace(':','x')}-${density}.png`;
   await page.getByTestId('preview').screenshot({path:`${folder}/${name}`});
   entries.push({seed,ratio,density,name,count:await page.locator('[data-testid="shapes"] > g').count()});
  }
 }
 for(const seed of ['undefined-heartbeat','neon-city']) {
  const sheet=await browser.newPage({viewport:{width:1800,height:1100}});
  const cells=await Promise.all(entries.filter(e=>e.seed===seed).map(async e=>`<article><p>${e.ratio} / ${e.density}% / ${e.count} shapes</p><img src="data:image/png;base64,${(await readFile(`${folder}/${e.name}`)).toString('base64')}"></article>`));
  await sheet.setContent(`<html><meta charset="UTF-8"><style>body{background:#111526;color:#eee;font:18px sans-serif;margin:24px}main{display:grid;grid-template-columns:repeat(5,1fr);gap:12px}article{background:#22283c;padding:8px;margin:0}img{width:100%;height:360px;object-fit:contain}p{margin:0 0 8px}</style><h1>${seed} — density / v4</h1><main>${cells.join('')}</main></html>`);
  await sheet.locator('img').evaluateAll(nodes=>Promise.all(nodes.map(n=>n.decode())));
  await sheet.screenshot({path:`${folder}/comparison-${seed}.png`,fullPage:true});await sheet.close();
 }
 await writeFile(`${folder}/manifest.json`,JSON.stringify(entries,null,2)+'\n');
 console.log(entries);
} finally {await browser.close();}
