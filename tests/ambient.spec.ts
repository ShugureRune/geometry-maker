import {test,expect} from '@playwright/test';
test('ambient modes remain bounded, pause, stop and restore normal preview',async({page})=>{
 await page.goto('./');await page.getByLabel('アニメーションを有効化').uncheck();await expect(page.getByTestId('ambient-preview')).toHaveCount(0);
 await page.getByLabel('自動待機画面を有効化').check();await expect(page.getByTestId('ambient-preview')).toHaveCount(1);
 for(const version of ['2d-v4','2d-v5'])for(const mode of ['growth','float','scroll','combined']){
 await page.getByLabel('生成アルゴリズム').selectOption(version);await page.getByLabel('待機アニメーション').selectOption(mode);await page.getByRole('button',{name:'待機画面を再生',exact:true}).click();await page.waitForTimeout(200);await page.getByRole('button',{name:'待機画面を一時停止',exact:true}).click();expect(await page.locator('[data-shape-id]').count()).toBeLessThan(2500);
 }
 await page.getByRole('button',{name:'待機画面を停止',exact:true}).click();await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.getByLabel('自動待機画面を有効化').uncheck();await expect(page.getByTestId('ambient-preview')).toHaveCount(0);await expect(page.getByTestId('preview')).toHaveCount(1);
});
test('perfect loop boundary frames match and ambient videos encode',async({page})=>{
 test.setTimeout(180000);await page.goto('/tests/fixtures/ambient.html');
 const {mkdir,writeFile}=await import('node:fs/promises');await mkdir('test-results/ambient',{recursive:true});
 for(const version of ['2d-v4','2d-v5'])for(const mode of ['growth','float','scroll','combined']){
  await page.evaluate(({mode,version})=>(window as any).ambientFrame(0,mode,version),{mode,version});await page.waitForTimeout(30);const first=await page.getByTestId('ambient-preview').screenshot();
  await page.evaluate(({mode,version})=>(window as any).ambientFrame(1,mode,version),{mode,version});await page.waitForTimeout(30);expect((await page.getByTestId('ambient-preview').screenshot()).equals(first)).toBe(true);
  await page.evaluate(({mode,version})=>(window as any).ambientFrame(.5,mode,version),{mode,version});await page.waitForTimeout(30);await page.getByTestId('ambient-preview').screenshot({path:`test-results/ambient/${version}-${mode}.png`});
 }
 for(const mode of ['growth','float','scroll','combined'])for(const format of ['webm','mp4']){await page.evaluate(mode=>(window as any).ambientFrame(0,mode),mode);const data=await page.evaluate(format=>(window as any).ambientExport(format),format);await writeFile(`test-results/ambient/${mode}.${format}`,Buffer.from(data,'base64'));const {execFileSync}=await import('node:child_process');const raw=execFileSync('ffmpeg',['-v','error','-i',`test-results/ambient/${mode}.${format}`,'-f','rawvideo','-pix_fmt','rgb24','-'],{maxBuffer:64*1024*1024});const size=512*288*3;let difference=0;for(let i=0;i<size;i++)difference+=Math.abs(raw[i]-raw[raw.length-size+i]);expect(difference/size).toBeLessThan(12);}
});
test('30 simulated minutes keep scene DOM and retained heap bounded',async({page})=>{
 test.setTimeout(120000);await page.goto('/tests/fixtures/ambient.html');const session=await page.context().newCDPSession(page);await session.send('Performance.enable');
 async function sample(){await session.send('HeapProfiler.collectGarbage');const {metrics}=await session.send('Performance.getMetrics');return metrics.find(m=>m.name==='JSHeapUsedSize')!.value;}
 for(let t=0;t<100;t+=10)await page.evaluate(async t=>{(window as any).ambientFrame(t,'combined','2d-v5',true);await new Promise(r=>setTimeout(r,5));},t);
 const before=await sample();let maxNodes=0;
 for(let t=100;t<=1800;t+=7.3){await page.evaluate(async t=>{(window as any).ambientFrame(t,'combined','2d-v5',true);await new Promise(r=>setTimeout(r,5));},t);maxNodes=Math.max(maxNodes,await page.locator('svg').count());}
 const after=await sample();expect(maxNodes).toBeLessThanOrEqual(3);expect(after-before).toBeLessThan(20*1024*1024);console.log({simulatedSeconds:1800,before,after,maxNodes});
});
test('ambient JSON, pause, UI hiding and visibility retain independent state',async({page})=>{
 await page.goto('./');await page.getByLabel('アニメーションを有効化').uncheck();await page.getByLabel('自動待機画面を有効化').check();await page.getByLabel('待機アニメーション').selectOption('float');await page.waitForTimeout(200);await page.getByRole('button',{name:'待機画面を一時停止',exact:true}).click();const paused=await page.getByTestId('ambient-preview').screenshot();await page.waitForTimeout(100);expect((await page.getByTestId('ambient-preview').screenshot()).equals(paused)).toBe(true);
 await page.getByRole('button',{name:'操作を隠す',exact:true}).click();await expect(page.getByLabel('生成設定')).toBeHidden();await page.getByRole('button',{name:'操作を表示',exact:true}).click();await expect(page.getByLabel('生成設定')).toBeVisible();
 const pending=page.waitForEvent('download');await page.getByRole('button',{name:'設定JSONを保存',exact:true}).click();const {readFile}=await import('node:fs/promises');const data=await readFile((await (await pending).path())!);expect(JSON.parse(data.toString()).ambient.mode).toBe('float');await page.getByLabel('設定JSONファイル').setInputFiles({name:'ambient.json',mimeType:'application/json',buffer:data});await expect(page.getByLabel('自動待機画面を有効化')).not.toBeChecked();await page.getByLabel('自動待機画面を有効化').check();await expect(page.getByLabel('待機アニメーション')).toHaveValue('float');
 await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));});await page.waitForTimeout(100);const hidden=await page.locator('.ambient-controls > .help').textContent();await page.waitForTimeout(300);expect(await page.locator('.ambient-controls > .help').textContent()).toBe(hidden);await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:false});document.dispatchEvent(new Event('visibilitychange'));});
});
test('reduced motion waits for explicit ambient play',async({page})=>{
 await page.emulateMedia({reducedMotion:'reduce'});await page.goto('./');await page.getByLabel('自動待機画面を有効化').check();await expect(page.locator('.ambient-controls > .help')).toContainText('停止・一時停止中');await page.getByRole('button',{name:'待機画面を再生',exact:true}).click();await expect(page.locator('.ambient-controls > .help')).toContainText('再生中');
});
