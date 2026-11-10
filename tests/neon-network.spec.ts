import {test,expect,type Page} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';

test.setTimeout(120_000);
async function category(page:Page,name:string){
  const button=page.getByRole('navigation',{name:'設定カテゴリー'}).getByRole('button',{name,exact:true});
  if(await button.getAttribute('aria-expanded')!=='true')await button.click();
}
async function start(page:Page){
  await page.emulateMedia({reducedMotion:'reduce'});await page.goto('./');
  await page.getByLabel('シード値',{exact:true}).fill('cosmic-3d');await page.getByLabel('シード値',{exact:true}).press('Enter');
  await page.getByRole('button',{name:'3Dモード',exact:true}).click();
  await expect(page.getByRole('button',{name:'視点をリセット',exact:true})).toBeEnabled();
  await category(page,'カラー');await page.getByLabel('テーマを選ぶ').selectOption('neon');
  await category(page,'装飾');
}
async function savePNG(page:Page,width=512,height=512){
  await category(page,'書き出し');await page.getByLabel('3D 幅 (px)').fill(String(width));await page.getByLabel('3D 高さ (px)').fill(String(height));
  const pending=page.waitForEvent('download');await page.getByRole('button',{name:'3D PNGを書き出す',exact:true}).click();
  const download=await pending;expect(await download.failure()).toBeNull();
  const bytes=await readFile((await download.path())!);expect(bytes.subarray(1,4).toString()).toBe('PNG');
  expect(bytes.readUInt32BE(16)).toBe(width);expect(bytes.readUInt32BE(20)).toBe(height);return bytes;
}
const hash=(bytes:Buffer)=>createHash('sha256').update(bytes).digest('hex');
async function saveJSON(page:Page){
  await category(page,'書き出し');const pending=page.waitForEvent('download');await page.getByRole('button',{name:'3D設定JSONを保存',exact:true}).click();
  const download=await pending;return readFile((await download.path())!,'utf8');
}

test('presets and nearest connections preserve seed, objects, view and original materials',async({page})=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await start(page);
  const preview=page.getByTestId('three-preview'),count=await preview.getAttribute('data-object-count');
  const standard=await savePNG(page);const savedBase=JSON.parse(await saveJSON(page));await category(page,'装飾');
  await page.getByRole('button',{name:'ネオンネットワーク',exact:true}).click();
  await expect(preview).toHaveAttribute('data-neon-mode','transparent');expect(Number(await preview.getAttribute('data-network-count'))).toBeGreaterThan(0);
  expect(hash(await savePNG(page))).not.toBe(hash(standard));
  const project=JSON.parse(await saveJSON(page));expect(project.seed).toBe(savedBase.seed);expect(project.density).toBe(savedBase.density);
  expect(project.view).toEqual(savedBase.view);expect(project.settings.material).toBe(savedBase.settings.material);expect(project.background).toEqual(savedBase.background);
  await category(page,'装飾');await page.getByLabel('図形の接続を有効化').uncheck();await expect(preview).toHaveAttribute('data-network-count','0');
  await page.getByLabel('図形の接続を有効化').check();await page.getByLabel('最大接続数',{exact:true}).fill('1');
  expect(Number(await preview.getAttribute('data-network-count'))).toBeLessThanOrEqual(Math.floor(Number(count)/2));
  await page.getByRole('button',{name:'サイバーグリッド',exact:true}).click();await expect(preview).toHaveAttribute('data-neon-mode','lines');
  await page.getByRole('button',{name:'スタンダード',exact:true}).click();await expect(preview).toHaveAttribute('data-neon-mode','off');
  await expect(preview).toHaveAttribute('data-network-count','0');expect(hash(await savePNG(page))).toBe(hash(standard));
  await category(page,'図形');await page.getByLabel('図形密度').fill('0');await category(page,'装飾');await page.getByRole('button',{name:'ネオンネットワーク',exact:true}).click();
  await expect(preview).toHaveAttribute('data-object-count','0');await expect(preview).toHaveAttribute('data-network-count','0');
  await category(page,'図形');await page.getByLabel('図形密度').fill('100');expect(Number(await preview.getAttribute('data-network-count'))).toBeGreaterThan(0);
  await expect(page.getByTestId('current-seed')).toHaveText('cosmic-3d');expect(errors).toEqual([]);
});

test('all neon modes, custom colors, thickness, opacity and glow affect real PNG pixels',async({page})=>{
  await start(page);await page.getByRole('button',{name:'ネオンネットワーク',exact:true}).click();
  const images=new Set<string>();
  for(const mode of ['lines','transparent','surface']){
    await category(page,'装飾');await page.getByLabel('ネオン表示方式').selectOption(mode);images.add(hash(await savePNG(page)));
  }
  expect(images.size).toBe(3);
  await category(page,'装飾');await page.getByLabel('ネオン表示方式').selectOption('transparent');await page.getByLabel('面の不透明度',{exact:true}).fill('0.5');
  const translucent=hash(await savePNG(page));await category(page,'装飾');await page.getByLabel('面の不透明度',{exact:true}).fill('0');expect(hash(await savePNG(page))).not.toBe(translucent);
  await category(page,'装飾');await page.getByLabel('輪郭線の色モード').selectOption('custom');await page.locator('#neon-hex').fill('#33ccff');
  await page.getByLabel('接続線の色モード').selectOption('custom');await page.locator('#network-hex').fill('#ee44ff');
  const colored=hash(await savePNG(page));await category(page,'装飾');await page.getByLabel('輪郭線の太さ',{exact:true}).fill('4');await page.getByLabel('接続線の太さ',{exact:true}).fill('4');
  expect(hash(await savePNG(page))).not.toBe(colored);
  await category(page,'装飾');await page.getByLabel('接続線の不透明度',{exact:true}).fill('0');const hiddenLinks=hash(await savePNG(page));
  await category(page,'装飾');await page.getByLabel('接続線の不透明度',{exact:true}).fill('1');expect(hash(await savePNG(page))).not.toBe(hiddenLinks);
  await category(page,'装飾');await page.getByLabel('輪郭線の発光強度',{exact:true}).fill('0');await page.getByLabel('接続線の発光強度',{exact:true}).fill('0');
  const noGlow=hash(await savePNG(page));await category(page,'装飾');await page.getByLabel('輪郭線の発光強度',{exact:true}).fill('200');await page.getByLabel('接続線の発光強度',{exact:true}).fill('200');
  expect(hash(await savePNG(page))).not.toBe(noGlow);expect((await savePNG(page,1920,1080)).length).toBeGreaterThan(50_000);
});

test('pulse shares the pausable 3D clock and JSON restores exact paused pose and style',async({page})=>{
  await start(page);await page.getByRole('button',{name:'ネオンネットワーク',exact:true}).click();
  await category(page,'アニメーション');await page.getByLabel('3D浮遊量',{exact:true}).fill('0');await page.getByLabel('3D回転量',{exact:true}).fill('0');
  await page.getByRole('button',{name:'3Dを再生',exact:true}).click();
  const moving=hash(await savePNG(page));await page.waitForTimeout(300);expect(hash(await savePNG(page))).not.toBe(moving);
  await category(page,'アニメーション');await page.getByRole('button',{name:'3Dを一時停止',exact:true}).click();
  const paused=await savePNG(page);await page.waitForTimeout(200);expect(hash(await savePNG(page))).toBe(hash(paused));
  const saved=await saveJSON(page),project=JSON.parse(saved);expect(project.settings.network.animation).toBe('pulse');expect(project.elapsedSeconds).toBeGreaterThan(0);
  await category(page,'装飾');await page.getByRole('button',{name:'スタンダード',exact:true}).click();
  await category(page,'図形');await page.getByLabel('シード値',{exact:true}).fill('changed');
  await category(page,'書き出し');await page.getByLabel('3D設定JSONファイル',{exact:true}).setInputFiles({name:'network.json',mimeType:'application/json',buffer:Buffer.from(saved)});
  await expect(page.getByText('3D設定を読み込みました。',{exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'視点をリセット',exact:true})).toBeEnabled();
  await expect(page.getByTestId('current-seed')).toHaveText('cosmic-3d');expect(hash(await savePNG(page))).toBe(hash(paused));
  const after=JSON.parse(await saveJSON(page));expect(after.settings).toEqual(project.settings);expect(after.elapsedSeconds).toBe(project.elapsedSeconds);
  await page.getByLabel('3D設定JSONファイル',{exact:true}).setInputFiles({name:'bad.json',mimeType:'application/json',buffer:Buffer.from('{')});
  await expect(page.getByRole('alert')).toContainText('JSONの書式');await expect(page.getByTestId('current-seed')).toHaveText('cosmic-3d');
});

test('mobile touch controls, lightweight neon and 2D export remain usable',async({browser})=>{
  const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true});
  const page=await context.newPage();const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await start(page);
  await page.getByRole('button',{name:'サイバーグリッド',exact:true}).tap();await expect(page.getByTestId('three-preview')).toHaveAttribute('data-quality','low');
  const slider=page.getByLabel('接続線の太さ',{exact:true});await slider.scrollIntoViewIfNeeded();const box=(await slider.boundingBox())!;
  await slider.tap({position:{x:box.width*.7,y:box.height/2}});expect(Number(await slider.inputValue())).toBeGreaterThan(1);
  await page.getByLabel('輪郭線の色モード').selectOption('accent');expect((await savePNG(page)).length).toBeGreaterThan(10_000);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.getByRole('button',{name:'2Dモード',exact:true}).tap();await expect(page.getByTestId('preview')).toBeVisible();
  await category(page,'書き出し');const pending=page.waitForEvent('download');await page.getByRole('button',{name:'SVGを書き出す',exact:true}).click();
  const file=await pending;expect(await file.failure()).toBeNull();expect((await readFile((await file.path())!,'utf8'))).toContain('<svg');
  expect(errors).toEqual([]);await context.close();
});

test('network-only edits refresh the paused live canvas without an export or another control change',async({page})=>{
  await start(page);await page.getByLabel('図形の接続を有効化').check();
  await page.getByLabel('接続線の色モード').selectOption('custom');await page.locator('#network-hex').fill('#ff0022');
  const canvas=page.getByTestId('three-preview').locator('canvas');
  const before=hash(await canvas.screenshot());await page.locator('#network-hex').fill('#00ccff');
  await expect.poll(async()=>hash(await canvas.screenshot())).not.toBe(before);
  const colored=hash(await canvas.screenshot());await page.getByLabel('接続線の発光強度',{exact:true}).fill('0');
  await expect.poll(async()=>hash(await canvas.screenshot())).not.toBe(colored);
  await page.getByLabel('ネオン線画を有効化').check();await page.getByLabel('ネオン表示方式').selectOption('lines');
  await expect(page.getByTestId('three-preview')).toHaveAttribute('data-neon-mode','lines');
});
