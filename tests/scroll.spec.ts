import {test,expect} from './ui-test';
import {mkdir,writeFile} from 'node:fs/promises';
const fixture='/tests/fixtures/scroll.html';
async function frame(page:any,time:number,patch:object={}){await page.evaluate(({time,patch}:any)=>(window as any).scrollFrame(time,patch),{time,patch});await page.waitForTimeout(50);}
test('coordinate chunks enter, grow, leave and reproduce across directions, ratios and algorithms',async({page})=>{
 test.setTimeout(180000);await page.goto(fixture);await mkdir('test-results/scroll',{recursive:true});
 for(const version of ['2d-v4','2d-v5'])for(const direction of ['horizontal','vertical','diagonal'])for(const ratio of ['16:9','9:16','1:1']){
  await frame(page,0,{version,ratio,settings:{direction,duration:14,speed:1,scrollSpeed:1}});expect(await page.locator('[data-shape-id]').count()).toBe(0);
  const initial=await page.locator('[data-chunk]').evaluateAll(nodes=>nodes.map(n=>n.getAttribute('data-chunk-seed')));
  await frame(page,1); // Empty areas are valid in the clustered world.
  await frame(page,3);const at3=await page.locator('[data-shape-id]').evaluateAll(nodes=>nodes.map(n=>[n.getAttribute('data-kind'),n.getAttribute('transform')]));
  await expect(page.locator('[data-testid=background]')).toHaveCount(1);
  expect(await page.locator('[data-chunk]').evaluateAll(nodes=>nodes.every(n=>Number(n.getAttribute('data-growth-start'))<=3))).toBe(true);
  if(ratio==='16:9'){await page.getByTestId('ambient-preview').screenshot({path:`test-results/scroll/${version}-${direction}-3.png`});}
  await frame(page,40);const later=await page.locator('[data-chunk]').evaluateAll(nodes=>nodes.map(n=>n.getAttribute('data-chunk-seed')));expect(later.some(s=>initial.includes(s))).toBe(false);
  expect(Number(await page.getByTestId('ambient-preview').getAttribute('data-cache-size'))).toBeLessThanOrEqual(48);expect(await page.locator('[data-chunk]').count()).toBeLessThanOrEqual(48);
  await frame(page,3);expect(await page.locator('[data-shape-id]').evaluateAll(nodes=>nodes.map(n=>[n.getAttribute('data-kind'),n.getAttribute('transform')]))).toEqual(at3);
 }
 await frame(page,20,{settings:{scrollDensity:0}});expect(await page.locator('[data-shape-id]').count()).toBe(0);await expect(page.locator('[data-testid=background]')).toHaveCount(1);
});
test('time-based video frames match preview and infinite scroll encodes WebM and MP4',async({page})=>{
 test.setTimeout(180000);await page.goto(fixture);await mkdir('test-results/scroll',{recursive:true});
 for(const time of [0,1,3,10]){
  await frame(page,time);const svg=await page.evaluate(t=>(window as any).scrollSvg(t),time);
  const before=await page.locator('[data-shape-id]').evaluateAll(nodes=>nodes.map(n=>[n.getAttribute('data-kind'),n.getAttribute('transform'),Array.from(n.querySelectorAll('path')).map(p=>p.getAttribute('d'))]));
  const after=await page.evaluate(svg=>{const dom=new DOMParser().parseFromString(svg,'image/svg+xml');return Array.from(dom.querySelectorAll('[data-shape-id]')).map(n=>[n.getAttribute('data-kind'),n.getAttribute('transform'),Array.from(n.querySelectorAll('path')).map(p=>p.getAttribute('d'))]);},svg);expect(after).toEqual(before);
  await page.getByTestId('ambient-preview').screenshot({path:`test-results/scroll/time-${time}.png`});await writeFile(`test-results/scroll/time-${time}.svg`,svg);
  await page.evaluate(svg=>{const img=document.createElement('img');img.id='export-frame';img.width=800;img.height=450;img.src=URL.createObjectURL(new Blob([svg],{type:'image/svg+xml'}));document.body.append(img);return img.decode();},svg);
  await page.locator('#export-frame').screenshot({path:`test-results/scroll/export-${time}.png`});await page.locator('#export-frame').evaluate((img:any)=>{URL.revokeObjectURL(img.src);img.remove();});
 }
 await frame(page,0,{settings:{exportDuration:2}});
 const {execFileSync}=await import('node:child_process');
 execFileSync('python',['-c',`from PIL import Image, ImageChops, ImageStat
for t in [0,1,3,10]:
 a=Image.open(f'test-results/scroll/time-{t}.png').convert('RGB');b=Image.open(f'test-results/scroll/export-{t}.png').convert('RGB')
 difference=sum(ImageStat.Stat(ImageChops.difference(a,b)).mean)/3
 assert difference<1.0,(t,difference)
 print(t,difference)`]);
 for(const format of ['webm','mp4']){const data=await page.evaluate(format=>(window as any).scrollExport(format),format);const path=`test-results/scroll/infinite.${format}`;await writeFile(path,Buffer.from(data,'base64'));const probe=JSON.parse(execFileSync('ffprobe',['-v','quiet','-count_frames','-show_streams','-of','json',path],{encoding:'utf8'}));expect(probe.streams[0].nb_read_frames).toBe('48');}
});
test('phone sliders retain settings, camera position, playback, and JSON',async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.goto('./');await page.getByLabel('自動待機画面を有効化').check();await page.getByLabel('待機アニメーション').selectOption('scroll');await page.getByText('待機画面の詳細設定',{exact:true}).click();
 await expect(page.locator('.ambient-controls input[type=number]')).toHaveCount(0);await expect(page.locator('.ambient-range input[type=range]')).toHaveCount(13);
 await page.getByRole('button',{name:'待機画面を一時停止',exact:true}).click();const before=await page.getByTestId('ambient-preview').getAttribute('data-scroll-world');expect(before).toBe('v3');
 for(const slider of await page.locator('.ambient-range input').all()){await slider.fill(await slider.getAttribute('max')||'1');await expect(slider).toHaveValue(await slider.getAttribute('max')||'1');const box=(await slider.boundingBox())!;expect(box.height).toBeGreaterThanOrEqual(44);}
 await page.getByRole('button',{name:'待機画面を停止',exact:true}).click();await page.getByRole('button',{name:'待機画面を再生',exact:true}).click();await page.waitForTimeout(300);await page.getByRole('button',{name:'待機画面を一時停止',exact:true}).click();
 const seed=await page.getByTestId('current-seed').textContent();const anchors=()=>page.locator('[data-chunk]').evaluateAll(nodes=>nodes.map(n=>[n.getAttribute('data-chunk'),n.getAttribute('data-anchor-x'),n.getAttribute('data-anchor-y')]));const a=await anchors();await page.getByLabel('スクロール方向').selectOption('diagonal');expect(await anchors()).toEqual(a);expect(await page.getByTestId('current-seed').textContent()).toBe(seed);
 const pending=page.waitForEvent('download');await page.getByRole('button',{name:'設定JSONを保存',exact:true}).click();const data=await(await import('node:fs/promises')).readFile((await(await pending).path())!);expect(JSON.parse(data.toString()).ambient.scrollSpeed).toBe(4);await page.getByLabel('設定JSONファイル').setInputFiles({name:'scroll.json',mimeType:'application/json',buffer:data});await page.getByLabel('自動待機画面を有効化').check();await expect(page.getByLabel('待機画面の再生速度')).toHaveValue('4');expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
