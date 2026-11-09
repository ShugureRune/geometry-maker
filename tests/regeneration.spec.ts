import {test,expect,type Page} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import {NEW_SHAPE_KINDS} from '../src/scene';
async function snapshot(page:Page){return page.getByTestId('shapes').evaluate(element=>{
 const record=(n:Element):unknown=>[n.tagName,[...n.attributes].filter(a=>!(a.name==='style'&&!a.value)).map(a=>[a.name,a.value]).sort((a,b)=>a[0].localeCompare(b[0])),[...n.children].map(record)];return JSON.stringify(record(element));
});}

test('regeneration replays a fresh deterministic clock; seed commits and randomize replay; paint/density do not',async({page})=>{
 await page.clock.install({time:new Date('2026-01-01T00:00:00Z')});
 await page.clock.pauseAt(new Date('2026-01-01T00:00:01Z'));
 await page.goto('./');await page.getByLabel('アニメーションを有効化').uncheck();await page.getByLabel('シード値',{exact:true}).fill('undefined-heartbeat');await page.getByLabel('発光強度').fill('0');
 const seed=page.getByLabel('シード値',{exact:true}),timeline=page.getByLabel('タイムライン',{exact:true});
 const regenerate=page.getByRole('button',{name:'同じ設定で再生成',exact:true});
 const shapes=page.getByTestId('shapes'),position=page.getByTestId('playback-position');
 const complete=await snapshot(page),originalSeed=await seed.inputValue();
 const originalColors=await page.locator('input[type=color]').evaluateAll(nodes=>nodes.map(n=>(n as HTMLInputElement).value));
 await page.getByLabel('成長時間（秒）').fill('2');await page.getByLabel('再生速度',{exact:true}).selectOption('2');
 await page.getByLabel('アニメーションを有効化').check();await timeline.fill('800');
 await regenerate.click();await expect(timeline).toHaveValue('0');await expect(shapes.locator(':scope>g')).toHaveCount(0);
 await page.clock.runFor(350);expect(Number(await timeline.inputValue())).toBeGreaterThan(300);
 await page.getByRole('button',{name:'一時停止',exact:true}).click();
 await timeline.fill('350');const partial=await snapshot(page);expect(partial).not.toBe(complete);
 await page.getByRole('button',{name:'再生',exact:true}).click();
 // Restart while already playing cancels the old clock. RAF samples can differ
 // by a frame; exact reproducibility is checked at the same explicit seek time.
 await regenerate.click();await expect(timeline).toHaveValue('0');
 await page.clock.runFor(350);expect(Number(await timeline.inputValue())).toBeGreaterThan(300);
 expect(Number(await timeline.inputValue())).toBeLessThanOrEqual(360);
 await page.getByRole('button',{name:'一時停止',exact:true}).click();
 await timeline.fill('350');expect(await snapshot(page)).toBe(partial);
 await page.getByRole('button',{name:'再生',exact:true}).click();
 await page.clock.runFor(1000);await expect(position).toContainText('100%');expect(await snapshot(page)).toBe(complete);
 expect(await seed.inputValue()).toBe(originalSeed);
 expect(await page.locator('input[type=color]').evaluateAll(nodes=>nodes.map(n=>(n as HTMLInputElement).value))).toEqual(originalColors);
 await page.getByRole('button',{name:'主役色を固定',exact:true}).click();const primary=await page.getByLabel('主役色',{exact:true}).inputValue();
 await page.getByRole('button',{name:'ランダムシードを生成',exact:true}).click();await expect(timeline).toHaveValue('0');expect(await seed.inputValue()).not.toBe(originalSeed);await expect(page.getByLabel('主役色',{exact:true})).toHaveValue(primary);
 await timeline.fill('600');await seed.fill('confirmed-seed');await expect(timeline).toHaveValue('600');
 await seed.dispatchEvent('keydown',{key:'Enter',code:'Enter',isComposing:true});await expect(timeline).toHaveValue('600');
 await seed.press('Enter');await expect(timeline).toHaveValue('0');
 await timeline.fill('700');await seed.fill('blur-commit');await expect(timeline).toHaveValue('700');
 await seed.press('Tab');await expect(timeline).toHaveValue('0');
 await timeline.fill('600');await page.getByLabel('主役色',{exact:true}).fill('#aabbcc');await expect(timeline).toHaveValue('600');
 await page.getByLabel('図形密度').fill('100');await expect(timeline).toHaveValue('600');
 await page.getByLabel('アニメーションを有効化').uncheck();await regenerate.click();await page.clock.runFor(250);
 await expect(timeline).toHaveValue('0');expect(await shapes.locator(':scope>g').count()).toBeGreaterThan(0);
});

test('all new kinds render and grow from the same geometric contours',async({page})=>{
 await page.goto('/tests/fixtures/shapes.html');
 await expect(page.locator('[data-shape-id]')).toHaveCount(NEW_SHAPE_KINDS.length);
 const complete=await snapshot(page);
 await page.evaluate(()=> (window as unknown as {atlasProgress:(n:number)=>void}).atlasProgress(0));
 await expect(page.locator('[data-shape-id]')).toHaveCount(0);
 await page.evaluate(()=> (window as unknown as {atlasProgress:(n:number)=>void}).atlasProgress(.5));
 await expect(page.locator('[data-shape-id]')).toHaveCount(NEW_SHAPE_KINDS.length);
 for(const kind of NEW_SHAPE_KINDS){const node=page.locator(`[data-kind="${kind}"]`);expect(await node.locator('path,circle').count()).toBeGreaterThan(0);}
 const partial=await snapshot(page);expect(partial).not.toBe(complete);
 await page.evaluate(()=> (window as unknown as {atlasProgress:(n:number)=>void}).atlasProgress(1));expect(await snapshot(page)).toBe(complete);
});

test('old JSON keeps v4 geometry and filenames, while v5 settings round trip with animation',async({page})=>{
 await page.goto('./');await page.getByLabel('アニメーションを有効化').uncheck();await page.getByLabel('シード値',{exact:true}).fill('undefined-heartbeat');await page.getByLabel('発光強度').fill('0');
 const old={schemaVersion:1,algorithmVersion:'2d-v4',seed:'reference',aspectRatio:'16:9',backgroundMode:'solid',solidColor:'#111526',gradientColors:['#111526','#222222','#333333'],gradientAngle:135,exportWidth:512,exportHeight:288};
 await page.getByLabel('設定JSONファイル').setInputFiles({name:'old.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(old))});
 await expect(page.getByTestId('preview')).toHaveAttribute('data-algorithm','2d-v4');await expect(page.getByLabel('生成アルゴリズム')).toHaveValue('2d-v4');
 await expect(page.getByRole('status').filter({hasText:'旧v4設定'})).toBeVisible();
 const pending=page.waitForEvent('download');await page.getByRole('button',{name:'SVGを書き出す',exact:true}).click();const oldSvg=await pending;expect(oldSvg.suggestedFilename()).toContain('2d-v4');expect(await readFile((await oldSvg.path())!,'utf8')).toContain('data-algorithm="2d-v4"');
 const legacy=await snapshot(page);await page.getByLabel('生成アルゴリズム').selectOption('2d-v5');expect(await snapshot(page)).not.toBe(legacy);
 await page.getByLabel('アニメーションを有効化').check();await page.getByLabel('成長時間（秒）').fill('12');await page.getByLabel('再生速度',{exact:true}).selectOption('1.5');await page.getByLabel('イージング').selectOption('ease-out-in');await page.getByLabel('図形密度').fill('100');
 const saved=page.waitForEvent('download');await page.getByRole('button',{name:'設定JSONを保存',exact:true}).click();const json=await saved;const data=await readFile((await json.path())!);expect(JSON.parse(data.toString())).toMatchObject({algorithmVersion:'2d-v5',animationEnabled:true,animationDuration:12,playbackSpeed:1.5,easingType:'ease-out-in',density:100});
 await page.getByLabel('成長時間（秒）').fill('1');await page.getByLabel('設定JSONファイル').setInputFiles({name:'v5.json',mimeType:'application/json',buffer:data});await expect(page.getByLabel('成長時間（秒）')).toHaveValue('12');await expect(page.getByLabel('図形密度')).toHaveValue('100');await expect(page.getByLabel('タイムライン',{exact:true})).toHaveValue('0');
});

test.describe('phone regeneration',()=>{
 test.use({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
 test('touch replay and reduced-motion behavior remain usable',async({page})=>{
  await page.goto('./');await page.getByLabel('アニメーションを有効化').uncheck();await page.getByLabel('シード値',{exact:true}).fill('undefined-heartbeat');await page.getByLabel('発光強度').fill('0');await page.getByLabel('アニメーションを有効化').check();
  await page.getByRole('button',{name:'同じ設定で再生成',exact:true}).tap();await expect(page.getByRole('button',{name:'一時停止',exact:true})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.emulateMedia({reducedMotion:'reduce'});await page.getByRole('button',{name:'ランダムシードを生成',exact:true}).tap();
  await expect(page.getByTestId('playback-position')).toContainText('100%');await expect(page.getByRole('button',{name:'再生',exact:true})).toBeVisible();
 });
});
