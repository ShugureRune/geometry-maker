import{chromium}from'playwright';
import{writeFile,mkdir}from'node:fs/promises';
const version=process.env.SOAK_VERSION||'2d-v5';
const output=`test-results/ambient-soak-${version}`;
const browser=await chromium.launch(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{});
const page=await browser.newPage({viewport:{width:1280,height:900}});const errors=[];page.on('pageerror',error=>errors.push(error.message));
await page.goto(process.env.TEST_BASE_URL||'http://127.0.0.1:5173');await page.getByLabel('アニメーションを有効化').uncheck();await page.getByLabel('生成アルゴリズム').selectOption(process.env.SOAK_VERSION||'2d-v5');await page.getByLabel('シード値',{exact:true}).fill('ambient-30-minute-soak');await page.getByLabel('自動待機画面を有効化').check();await page.getByLabel('待機アニメーション').selectOption('combined');await page.getByText('待機画面の詳細設定',{exact:true}).click();await page.getByLabel('シード更新間隔（秒）').fill('4');await page.getByLabel('待機画面の再生速度').fill('4');await page.getByLabel('低負荷表示（20fps）').check();
const session=await page.context().newCDPSession(page);await session.send('Performance.enable');const samples=[];const start=Date.now();
await mkdir(output,{recursive:true});
for(let minute=0;minute<=30;minute++){
 if(minute>0)await new Promise(resolve=>setTimeout(resolve,Math.max(0,start+minute*60000-Date.now())));
 await session.send('HeapProfiler.collectGarbage');const {metrics}=await session.send('Performance.getMetrics');const sample={minute,elapsedSeconds:(Date.now()-start)/1000,heap:metrics.find(m=>m.name==='JSHeapUsedSize').value,nodes:await page.locator('svg').count(),shapes:await page.locator('[data-shape-id]').count(),clock:await page.locator('.ambient-controls > .help').textContent(),errors:[...errors]};samples.push(sample);console.log(JSON.stringify(sample));await writeFile(`${output}/metrics.json`,JSON.stringify(samples,null,2));
 if(sample.nodes>4||sample.shapes>256||errors.length)throw new Error('Unbounded scene or browser error');
}
await page.screenshot({path:`${output}/final.png`,fullPage:true});await browser.close();console.log('SOAK COMPLETE');
