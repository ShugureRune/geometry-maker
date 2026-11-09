import{chromium}from'playwright';
import{mkdir,writeFile}from'node:fs/promises';
const folder=process.env.SOAK_OUTPUT||'/tmp/geometry-scroll-soak';await mkdir(folder,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium'});
const pages=[];
for(const version of ['2d-v4','2d-v5']){
 const page=await browser.newPage({viewport:{width:1000,height:800}});const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(process.env.TEST_BASE_URL||'http://127.0.0.1:5173');
 const open=async name=>{const button=page.getByRole('navigation',{name:'設定カテゴリー'}).getByRole('button',{name,exact:true});if(await button.getAttribute('aria-expanded')!=='true')await button.click();};
 await open('図形');await page.getByLabel('生成アルゴリズム').selectOption(version);await page.getByLabel('シード値',{exact:true}).fill('chunk-soak');await page.getByLabel('図形密度').fill('50');await open('装飾');await page.getByLabel('発光強度').fill('25');await open('アニメーション');await page.getByLabel('自動待機画面を有効化').check();await page.getByLabel('待機アニメーション').selectOption('scroll');await page.getByText('待機画面の詳細設定',{exact:true}).click();await page.getByLabel('待機画面の再生速度').fill('4');await page.getByLabel('ループ時間（秒）').fill('4');await page.getByLabel('スクロール方向').selectOption('diagonal');await page.getByLabel('低負荷表示（20fps）').check();
 const cdp=await page.context().newCDPSession(page);await cdp.send('Performance.enable');pages.push({page,version,cdp,errors});
}
const start=Date.now(),samples=[];
for(let minute=0;minute<=10;minute++){
 if(minute)await new Promise(r=>setTimeout(r,Math.max(0,start+minute*60000-Date.now())));
 for(const{page,version,cdp,errors}of pages){await cdp.send('HeapProfiler.collectGarbage');const{metrics}=await cdp.send('Performance.getMetrics');const row={minute,version,elapsed:(Date.now()-start)/1000,heap:metrics.find(m=>m.name==='JSHeapUsedSize').value,cache:Number(await page.getByTestId('ambient-preview').getAttribute('data-cache-size')),groups:await page.locator('[data-chunk]').count(),shapes:await page.locator('[data-shape-id]').count(),clock:await page.locator('.ambient-controls>.help').textContent(),errors};samples.push(row);console.log(JSON.stringify(row));if(row.cache>48||row.groups>25||errors.length)throw new Error('Bound or browser error');if([0,5,10].includes(minute))await page.getByTestId('ambient-preview').screenshot({path:`${folder}/${version}-${minute}.png`});}
 await writeFile(`${folder}/metrics.json`,JSON.stringify(samples,null,2));
}
for(const version of ['2d-v4','2d-v5']){const rows=samples.filter(s=>s.version===version);const warm=rows.filter(s=>s.minute>=3&&s.minute<=5),last=rows.filter(s=>s.minute>=8);const mean=values=>values.reduce((n,s)=>n+s.heap,0)/values.length;if(mean(last)-mean(warm)>8*1024*1024)throw new Error('Retained heap increased beyond tolerance');}
await browser.close();console.log('10 MINUTE SCROLL SOAK PASSED');
