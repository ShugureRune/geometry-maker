import {test, expect, type Page, type Download} from '@playwright/test';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';

test.setTimeout(90_000);
async function category(page: Page, name: string) {
  const button = page.getByRole('navigation', {name: '設定カテゴリー'}).getByRole('button', {name, exact: true});
  if (await button.getAttribute('aria-expanded') !== 'true') await button.click();
}
async function start(page: Page) {
  await page.emulateMedia({reducedMotion: 'reduce'});
  await page.goto('./');
  await page.getByLabel('シード値', {exact: true}).fill('geometry-3d');
  await page.getByLabel('シード値', {exact: true}).press('Enter');
  await page.getByRole('button', {name: '3Dモード', exact: true}).click();
  await expect(page.getByTestId('three-preview').locator('canvas')).toBeVisible();
  await expect(page.getByRole('button', {name: '視点をリセット', exact: true})).toBeEnabled();
}
async function png(page: Page): Promise<Buffer> {
  await category(page, '書き出し');
  await page.getByLabel('3D 幅 (px)').fill('512'); await page.getByLabel('3D 高さ (px)').fill('512');
  const pending = page.waitForEvent('download');
  await page.getByRole('button', {name: '3D PNGを書き出す', exact: true}).click();
  const download: Download = await pending;
  expect(download.suggestedFilename()).toMatch(/geometry-maker_3d-v1_seed-geometry-3d_512x512\.png/);
  expect(await download.failure()).toBeNull();
  return readFile((await download.path())!);
}
const digest = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');

test('3D is lazy, returns to the unchanged 2D geometry, text, locks and timeline', async ({page}) => {
  const loaded: string[] = [];
  page.on('request', request => loaded.push(request.url()));
  await page.emulateMedia({reducedMotion: 'reduce'}); await page.goto('./');
  expect(loaded.some(url => /ThreePreview|three\.module|react-three_fiber/.test(url))).toBe(false);
  await category(page, 'アニメーション');
  await page.getByRole('button', {name: '完成状態を表示', exact: true}).click();
  await page.getByLabel('タイムライン', {exact: true}).fill('850');
  const position = await page.getByTestId('playback-position').textContent();
  await category(page, '図形'); await page.getByLabel('生成アルゴリズム').selectOption('2d-v4');
  await page.getByLabel('図形密度').fill('75');
  await category(page, '文字'); await page.getByLabel('文字を表示').check();
  await page.getByLabel('表示する文字', {exact: true}).fill('2D preserved');
  await category(page, 'カラー'); await page.getByLabel('主役色 HEX').fill('#7855bb');
  await page.getByRole('button', {name: '主役色を固定', exact: true}).click();
  const geometry = () => page.getByTestId('shapes').evaluate(node => node.innerHTML.replace(/url\(#[^)]+\)/g, 'url(#paint)').replace(/id="[^"]+"/g, ''));
  const before = await geometry();
  await page.getByRole('button', {name: '3Dモード', exact: true}).click();
  await expect(page.getByTestId('three-preview').locator('canvas')).toBeVisible();
  expect(loaded.some(url => /ThreePreview/.test(url))).toBe(true);
  await expect(page.getByRole('button', {name: '文字', exact: true})).toBeDisabled();
  await page.getByRole('button', {name: '2Dモード', exact: true}).click();
  await expect(page.getByTestId('preview')).toBeVisible();
  expect(await geometry()).toBe(before);
  await expect(page.getByTestId('text-overlay')).toContainText('2D preserved');
  await expect(page.getByRole('button', {name: '主役色を固定', exact: true})).toHaveAttribute('aria-pressed', 'true');
  await category(page, 'アニメーション'); await expect(page.getByTestId('playback-position')).toHaveText(position!);
  await category(page, '図形'); await expect(page.getByLabel('生成アルゴリズム')).toHaveValue('2d-v4');
  await expect(page.getByLabel('図形密度')).toHaveValue('75'); await expect(page.locator('canvas')).toHaveCount(0);
});

test('3D PNG preserves reproducible geometry and view; mouse and zoom change the view', async ({page}) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await start(page);
  const first = await png(page);
  expect(first.subarray(1, 4).toString()).toBe('PNG'); expect(first.readUInt32BE(16)).toBe(512); expect(first.readUInt32BE(20)).toBe(512);
  expect(first.length).toBeGreaterThan(10_000);
  await category(page, '図形'); await page.getByRole('button', {name: '同じ設定で再生成', exact: true}).click();
  expect(digest(await png(page))).toBe(digest(first));
  const canvas = page.getByTestId('three-preview').locator('canvas'), box = (await canvas.boundingBox())!;
  await page.mouse.move(box.x + box.width * .45, box.y + box.height * .5); await page.mouse.down();
  await page.mouse.move(box.x + box.width * .65, box.y + box.height * .6, {steps: 8}); await page.mouse.up();
  await page.waitForTimeout(300);
  const rotated = await png(page); expect(digest(rotated)).not.toBe(digest(first));
  await canvas.hover(); await page.mouse.wheel(0, -200); await page.waitForTimeout(300);
  expect(digest(await png(page))).not.toBe(digest(rotated));
  await page.getByRole('button', {name: '視点をリセット', exact: true}).click();
  await page.waitForTimeout(300);
  expect(digest(await png(page))).toBe(digest(first));
  expect(errors).toEqual([]);
});

test('switching modes suspends and resumes existing growth and ambient clocks', async ({page}) => {
  await page.emulateMedia({reducedMotion: 'reduce'}); await page.goto('./'); await category(page, 'アニメーション');
  await page.getByLabel('成長時間（秒）').fill('30'); await page.getByRole('button', {name: '最初から再生', exact: true}).click();
  await page.waitForTimeout(100); await page.getByRole('button', {name: '3Dモード', exact: true}).click();
  await expect(page.getByRole('button', {name: '視点をリセット', exact: true})).toBeEnabled();
  const position = await page.getByTestId('playback-position').textContent();
  await page.waitForTimeout(200); await expect(page.getByTestId('playback-position')).toHaveText(position!);
  await page.getByRole('button', {name: '2Dモード', exact: true}).click();
  await expect.poll(async () => parseFloat((await page.getByTestId('playback-position').textContent())!)).toBeGreaterThan(parseFloat(position!));
  await page.getByLabel('自動待機画面を有効化').check(); await page.getByLabel('待機アニメーション').selectOption('float');
  await page.getByRole('button', {name: '待機画面を再生', exact: true}).click();
  await page.getByRole('button', {name: '3Dモード', exact: true}).click();
  const clock = page.locator('.ambient-controls .help').filter({hasText: /秒。通常のシード値/});
  await expect(clock).toContainText('停止・一時停止中'); const time = await clock.textContent();
  await page.waitForTimeout(200); await expect(clock).toHaveText(time!);
  await page.getByRole('button', {name: '2Dモード', exact: true}).click(); await expect(clock).toContainText('再生中');
  const frame = await page.getByTestId('ambient-preview').innerHTML();
  await expect.poll(() => page.getByTestId('ambient-preview').innerHTML()).not.toBe(frame);
});

test('3D theme, materials, glow, background and stable density all render', async ({page}) => {
  await start(page); const preview = page.getByTestId('three-preview');
  const count = Number(await preview.getAttribute('data-object-count'));
  await page.getByLabel('図形密度').fill('0'); await expect(preview).toHaveAttribute('data-object-count', '0');
  const empty = await png(page);
  await category(page, '図形'); await page.getByLabel('図形密度').fill('100');
  expect(Number(await preview.getAttribute('data-object-count'))).toBeGreaterThan(count);
  expect(digest(await png(page))).not.toBe(digest(empty));
  await category(page, 'カラー'); await page.getByLabel('テーマを選ぶ').selectOption('neon');
  await category(page, '装飾');
  for (const material of ['matte', 'metal', 'glass', 'wireframe', 'theme']) {
    await page.getByLabel('マテリアル', {exact: true}).selectOption(material);
    await expect(page.getByTestId('three-preview').locator('canvas')).toBeVisible();
    expect((await png(page)).length).toBeGreaterThan(10_000); await category(page, '装飾');
  }
  await page.getByLabel('発光強度').fill('0'); const noGlow = await png(page);
  await category(page, '装飾'); await page.getByLabel('発光強度').fill('200');
  expect(digest(await png(page))).not.toBe(digest(noGlow));
  await category(page, '背景'); await page.getByRole('button', {name: '単色', exact: true}).click();
  await category(page, 'カラー'); await page.getByLabel('背景色 HEX', {exact: true}).fill('#f0f1f7');
  expect((await png(page)).length).toBeGreaterThan(10_000);
});

test('3D animation pauses cleanly and resumes; aspect ratios and quality work', async ({page}) => {
  await start(page); await category(page, 'アニメーション');
  await page.getByLabel('3Dアニメーションを有効化').check();
  const before = await png(page); await page.waitForTimeout(150); expect(digest(await png(page))).not.toBe(digest(before));
  await category(page, 'アニメーション'); await page.getByRole('button', {name: '3Dを一時停止', exact: true}).click();
  const paused = await png(page); await page.waitForTimeout(200); expect(digest(await png(page))).toBe(digest(paused));
  await category(page, '図形');
  for (const ratio of ['9:16', '1:1', '16:9']) {
    await page.getByLabel('キャンバスの比率').selectOption(ratio);
    const box = (await page.locator('.three-frame').boundingBox())!;
    const [w, h] = ratio.split(':').map(Number); expect(box.width / box.height).toBeCloseTo(w / h, 1);
  }
  await page.getByLabel('3D描画品質').selectOption('low'); await expect(page.getByTestId('three-preview')).toHaveAttribute('data-quality', 'low');
  expect((await png(page)).length).toBeGreaterThan(10_000);
});

test('WebGL unavailable gives a clear fallback and keeps 2D usable', async ({page}) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function(this: HTMLCanvasElement, type: string, ...args: unknown[]) {
      return type === 'webgl2' ? null : (original as Function).apply(this, [type, ...args]);
    } as typeof original;
  });
  await page.goto('./'); await page.getByRole('button', {name: '3Dモード', exact: true}).click();
  await expect(page.getByRole('alert')).toContainText('この環境では3Dを表示できません');
  await category(page, '書き出し'); await expect(page.getByRole('button', {name: '3D PNGを書き出す', exact: true})).toBeDisabled();
  await page.getByRole('button', {name: '2Dモード', exact: true}).click(); await expect(page.getByTestId('preview')).toBeVisible();
});

test('lost WebGL context is recoverable without breaking 2D', async ({page}) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await start(page);
  await page.getByTestId('three-preview').locator('canvas').evaluate(canvas => {
    (canvas as HTMLCanvasElement).getContext('webgl2')!.getExtension('WEBGL_lose_context')!.loseContext();
  });
  await expect(page.getByRole('alert')).toContainText('3D描画が中断されました');
  await page.getByRole('button', {name: '2Dモード', exact: true}).click(); await expect(page.getByTestId('preview')).toBeVisible();
  await page.getByRole('button', {name: '3Dモード', exact: true}).click();
  await expect(page.getByRole('button', {name: '視点をリセット', exact: true})).toBeEnabled();
  await expect(page.locator('canvas')).toHaveCount(1); expect(errors).toEqual([]);
});

test('failed lazy library loading leaves an explicit way back to 2D', async ({page}) => {
  await page.route(/\/ThreePreview[^/]*\.(?:tsx|js)(?:\?|$)/, route => route.abort());
  await page.goto('./'); await page.getByRole('button', {name: '3Dモード', exact: true}).click();
  await expect(page.getByRole('alert')).toContainText('3D表示を開始できませんでした');
  await expect(page.getByRole('alert')).toHaveAttribute('data-three-error-kind','module');
  await expect(page.getByRole('button',{name:'最新版を再読み込み'})).toBeVisible();
  await expect(page.getByTestId('three-error-detail')).toContainText('エラー種別：module');
  await page.getByRole('button', {name: '2Dモードへ戻る', exact: true}).click();
  await expect(page.getByTestId('preview')).toBeVisible();
});

test('mobile touch rotates and pinches with automatic lightweight rendering and no overflow', async ({browser}) => {
  const context = await browser.newContext({viewport: {width: 390, height: 844}, deviceScaleFactor: 2, isMobile: true, hasTouch: true});
  const page = await context.newPage(); await start(page);
  await expect(page.getByTestId('three-preview')).toHaveAttribute('data-quality', 'low');
  const before = await png(page);
  await page.getByTestId('three-preview').scrollIntoViewIfNeeded();
  const canvas = page.getByTestId('three-preview').locator('canvas'), box = (await canvas.boundingBox())!;
  const x = box.x + box.width * .5, y = box.y + box.height * .5;
  const client = await context.newCDPSession(page);
  await client.send('Input.dispatchTouchEvent', {type: 'touchStart', touchPoints: [{x, y, id: 1}]});
  for (let i = 1; i <= 6; i++) await client.send('Input.dispatchTouchEvent', {type: 'touchMove', touchPoints: [{x: x + i * 8, y: y + i * 3, id: 1}]});
  await client.send('Input.dispatchTouchEvent', {type: 'touchEnd', touchPoints: []}); await page.waitForTimeout(300);
  const rotated = await png(page); expect(digest(rotated)).not.toBe(digest(before));
  await canvas.scrollIntoViewIfNeeded();
  const nextBox = (await canvas.boundingBox())!, cx = nextBox.x + nextBox.width / 2, cy = nextBox.y + nextBox.height / 2;
  await client.send('Input.dispatchTouchEvent', {type: 'touchStart', touchPoints: [{x: cx - 25, y: cy, id: 1}, {x: cx + 25, y: cy, id: 2}]});
  for (let i = 1; i <= 4; i++) await client.send('Input.dispatchTouchEvent', {type: 'touchMove', touchPoints: [{x: cx - 25 - 6 * i, y: cy, id: 1}, {x: cx + 25 + 6 * i, y: cy, id: 2}]});
  await client.send('Input.dispatchTouchEvent', {type: 'touchEnd', touchPoints: []}); await page.waitForTimeout(300);
  expect(digest(await png(page))).not.toBe(digest(rotated));
  await category(page, '装飾'); await page.getByLabel('発光強度').fill('75');
  const slider = page.getByLabel('ライトの強さ'); await slider.focus(); await slider.press('ArrowRight');
  expect(Number(await slider.inputValue())).toBeGreaterThan(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await context.close();
});


test('13 solid kinds are individually selectable, save to 3D JSON, and render with neon outlines', async ({page}) => {
  await start(page);
  await category(page,'図形');
  const preview=page.getByTestId('three-preview');
  const allCount=Number(await preview.getAttribute('data-object-count'));
  const kinds=['円柱','円すい','カプセル','三角柱','四角すい','トーラスノット'];
  for(const name of kinds)await expect(page.getByLabel(name+'を生成')).toBeChecked();
  await page.getByRole('button',{name:'新しい6種類',exact:true}).click();
  for(const name of kinds)await expect(page.getByLabel(name+'を生成')).toBeChecked();
  await expect(page.getByLabel('球体を生成')).not.toBeChecked();
  expect(Number(await preview.getAttribute('data-object-count'))).toBe(allCount);
  const newlyStyled=await png(page);expect(newlyStyled.length).toBeGreaterThan(10_000);
  await category(page,'図形');
  await page.getByRole('button',{name:'従来の7種類',exact:true}).click();
  expect(Number(await preview.getAttribute('data-object-count'))).toBe(allCount);
  expect(digest(await png(page))).not.toBe(digest(newlyStyled));
  await category(page,'図形');
  await page.getByRole('button',{name:'新しい6種類',exact:true}).click();
  await category(page,'装飾');
  await page.getByLabel('ネオン線画を有効化').check();
  await page.getByLabel('ネオン表示方式').selectOption('lines');
  await expect(preview).toHaveAttribute('data-neon-mode','lines');
  expect((await png(page)).length).toBeGreaterThan(10_000);
  await category(page,'書き出し');
  const pending=page.waitForEvent('download');
  await page.getByRole('button',{name:'3Dの設定を保存',exact:true}).click();
  const json=await readFile((await (await pending).path())!,'utf8');
  const settings=JSON.parse(json).settings;
  expect(settings.enabledKinds).toEqual(['cylinder','cone','capsule','prism','pyramid','torus-knot']);
  await page.getByRole('button',{name:'保存した3D設定を読み込む',exact:true}).click();
  await page.getByLabel('保存した3D設定ファイル').setInputFiles({name:'shapes.json',mimeType:'application/json',buffer:Buffer.from(json)});
  await category(page,'図形');
  await expect(page.getByLabel('カプセルを生成')).toBeChecked();
  await expect(page.getByLabel('立方体を生成')).not.toBeChecked();
  await page.getByLabel('カプセルを生成').uncheck();
  await expect(page.getByLabel('カプセルを生成')).not.toBeChecked();
  await page.getByRole('button',{name:'全種類',exact:true}).click();
  for(const name of kinds)await expect(page.getByLabel(name+'を生成')).toBeChecked();
  expect(Number(await preview.getAttribute('data-object-count'))).toBe(allCount);
});

test('3D figures fade, scale and disappear without changing IDs, and preserve paused PNG and JSON',async({page})=>{
  await start(page);
  const preview=page.getByTestId('three-preview');
  const count=await preview.getAttribute('data-object-count');
  const before=digest(await png(page));
  await category(page,'アニメーション');
  await page.getByLabel('出現・消失アニメーションを有効化').check();
  await expect(preview).toHaveAttribute('data-visibility-enabled','true');
  await page.locator('#three-visibility-mode').selectOption('fade-scale');
  await page.locator('#three-visibility-duration').fill('8');
  await page.locator('#three-visibility-ratio').fill('50');
  await page.getByLabel('主役図形は常に表示').uncheck();
  await page.getByLabel('図形ごとにタイミングをずらす').uncheck();
  await expect(preview).toHaveAttribute('data-visibility-mode','fade-scale');
  expect(await preview.getAttribute('data-object-count')).toBe(count);
  const disappeared=digest(await png(page));
  expect(disappeared).not.toBe(before);
  await category(page,'アニメーション');
  await page.locator('#three-visibility-mode').selectOption('scale');
  await expect(preview).toHaveAttribute('data-visibility-mode','scale');
  await page.locator('#three-visibility-mode').selectOption('fade');
  await expect(preview).toHaveAttribute('data-visibility-mode','fade');
  await page.locator('#three-visibility-mode').selectOption('fade-scale');
  await category(page,'装飾');
  await page.getByLabel('ネオン線画を有効化').check();
  await page.getByLabel('ネオン表示方式').selectOption('lines');
  await expect(preview).toHaveAttribute('data-neon-mode','lines');
  const paused=digest(await png(page));
  await page.waitForTimeout(180);
  expect(digest(await png(page))).toBe(paused);
  await category(page,'書き出し');
  const pending=page.waitForEvent('download');
  await page.getByRole('button',{name:'3Dの設定を保存',exact:true}).click();
  const bytes=await readFile((await (await pending).path())!);
  const project=JSON.parse(bytes.toString());
  expect(project.settings.visibilityAnimation).toMatchObject({
    enabled:true,mode:'fade-scale',duration:8,visibleRatio:.5,stagger:false,keepPrimaryVisible:false,
  });
  await category(page,'アニメーション');
  await page.getByLabel('出現・消失アニメーションを有効化').uncheck();
  await expect(preview).toHaveAttribute('data-visibility-enabled','false');
  await category(page,'書き出し');
  await page.getByLabel('保存した3D設定ファイル').setInputFiles({name:'appearance.json',mimeType:'application/json',buffer:bytes});
  await category(page,'アニメーション');
  await expect(page.getByLabel('出現・消失アニメーションを有効化')).toBeChecked();
  await expect(page.locator('#three-visibility-mode')).toHaveValue('fade-scale');
  await expect(preview).toHaveAttribute('data-object-count',count!);
  await category(page,'書き出し');
  await expect(page.getByRole('button',{name:'3D PNGを書き出す',exact:true})).toBeEnabled();
  expect(digest(await png(page))).toBe(paused);
});

test('3D floor perspective grid renders in PNG, works with neon, and round-trips in 3D JSON', async ({page}) => {
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await start(page);
  await category(page,'アニメーション');
  await page.getByLabel('3Dアニメーションを有効化').uncheck();
  const original=digest(await png(page));
  const preview=page.getByTestId('three-preview');
  const shapeCount=await preview.getAttribute('data-object-count');
  await category(page,'背景');
  await expect(page.getByRole('heading',{name:'床の模様'})).toBeVisible();
  await expect(preview).toHaveAttribute('data-floor-grid','off');
  await page.getByLabel('3D床グリッドを有効化').check();
  await expect(preview).toHaveAttribute('data-floor-grid','on');
  // Show the real rendered diameter; underlying saved extent remains legacy-compatible.
  await expect(page.locator('#floor-grid-extent')).toHaveValue('700');
  await page.locator('#floor-grid-extent').fill('1000');
  await expect(page.locator('#floor-grid-extent')).toHaveValue('1000');
  await page.locator('#floor-grid-opacity').fill('.9');
  await page.locator('#floor-grid-thickness').fill('3');
  await page.locator('#floor-grid-spacing').fill('2');
  await page.locator('#floor-grid-scroll').fill('2.5');
  const withGrid=digest(await png(page));
  expect(withGrid).not.toBe(original);
  await category(page,'背景');
  // A change in physical (world-space) stroke width must change the rendered PNG.
  await page.locator('#floor-grid-thickness').fill('5');
  expect(digest(await png(page))).not.toBe(withGrid);
  await category(page,'背景');
  await page.locator('#floor-grid-thickness').fill('3');
  await category(page,'背景');
  await page.locator('#floor-grid-hex').fill('#ff4499');
  const pink=digest(await png(page));
  expect(pink).not.toBe(withGrid);
  await category(page,'背景');
  await page.locator('#floor-grid-glow').fill('160');
  const glowing=digest(await png(page));
  expect(glowing).not.toBe(pink);
  await category(page,'装飾');
  await page.getByRole('button',{name:'ネオンネットワーク',exact:true}).click();
  await expect(preview).toHaveAttribute('data-neon-mode','transparent');
  const neonGrid=digest(await png(page));
  expect(neonGrid).not.toBe(glowing);
  await category(page,'書き出し');
  const pending=page.waitForEvent('download');
  await page.getByRole('button',{name:'3Dの設定を保存',exact:true}).click();
  const bytes=await readFile((await (await pending).path())!);
  const project=JSON.parse(bytes.toString());
  expect(project.settings.floorGrid).toMatchObject({
    enabled:true,color:'#ff4499',opacity:.9,thickness:3,spacing:2,glow:160,scrollSpeed:2.5,extent:100,
  });
  await category(page,'背景');
  await page.getByLabel('3D床グリッドを有効化').uncheck();
  await expect(preview).toHaveAttribute('data-floor-grid','off');
  expect(digest(await png(page))).not.toBe(neonGrid);
  await category(page,'書き出し');
  await page.getByLabel('保存した3D設定ファイル').setInputFiles({
    name:'floor-grid.json',mimeType:'application/json',buffer:bytes,
  });
  await expect(preview).toHaveAttribute('data-floor-grid','on');
  await category(page,'背景');
  await expect(page.getByLabel('3D床グリッドを有効化')).toBeChecked();
  await expect(page.locator('#floor-grid-scroll')).toHaveValue('2.5');
  await expect(page.locator('#floor-grid-extent')).toHaveValue('1000');
  await expect(preview).toHaveAttribute('data-object-count',shapeCount!);
  expect(digest(await png(page))).toBe(neonGrid);
  await page.getByRole('button',{name:'2Dモード',exact:true}).click();
  await expect(page.getByTestId('preview')).toBeVisible();
  await expect(page.getByRole('heading',{name:'床の模様'})).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('3D floor circuit renders connected traces, animates signals and restores its PCB settings', async ({page}) => {
  const errors:string[]=[];
  page.on('pageerror',error=>errors.push(error.message));
  page.on('console',message=>{
    if(message.type()==='error'&&/WebGLProgram|Shader Error|VALIDATE_STATUS|GLSL/.test(message.text()))
      errors.push(message.text());
  });
  await start(page);
  await category(page,'アニメーション');
  await page.getByLabel('3Dアニメーションを有効化').uncheck();
  await category(page,'背景');
  await page.getByLabel('3D床グリッドを有効化').check();
  const preview=page.getByTestId('three-preview');
  await expect(preview).toHaveAttribute('data-floor-style','grid');
  await page.locator('#floor-grid-spacing').fill('3.5');
  await page.locator('#floor-grid-thickness').fill('4');
  await page.locator('#floor-grid-opacity').fill('1');
  const regular=digest(await png(page));
  await category(page,'背景');
  await page.getByLabel('床のデザイン').selectOption('circuit');
  await expect(preview).toHaveAttribute('data-floor-style','circuit');
  await expect(page.locator('#floor-circuit-density')).toBeVisible();
  await page.locator('#floor-circuit-density').fill('90');
  await page.locator('#floor-circuit-speed').fill('2');
  const circuit=digest(await png(page));
  expect(circuit).not.toBe(regular);
  expect(errors).toEqual([]); // Surface GLSL compilation errors before image comparisons.
  expect(digest(await png(page))).toBe(circuit); // Paused time must not jitter.
  await category(page,'背景');
  await page.locator('#floor-circuit-detail').fill('0');
  const withoutParts=digest(await png(page));
  expect(withoutParts).not.toBe(circuit); // ICs and vias use different masks.
  await category(page,'背景');
  await page.locator('#floor-circuit-detail').fill('85');
  await page.locator('#floor-circuit-board-opacity').fill('0.55');
  const withBoard=digest(await png(page));
  expect(withBoard).not.toBe(circuit);
  await category(page,'背景');
  await page.locator('#floor-circuit-accent').fill('#e6a65c');
  const metal=digest(await png(page));
  expect(metal).not.toBe(withBoard);
  await category(page,'背景');
  await page.locator('#floor-circuit-density').fill('0');
  await expect(page.locator('#floor-circuit-density')).toHaveValue('0');
  const noWires=digest(await png(page));
  if(noWires===circuit){
    await category(page,'背景');
    await page.getByLabel('3D床グリッドを有効化').uncheck();
    const disabled=digest(await png(page));
    throw new Error('PCB density did not change the image. noFloor='+disabled+
      ' circuit='+circuit+' control='+await page.locator('#floor-circuit-density').count()+
      ' browserErrors='+JSON.stringify(errors));
  }
  await category(page,'背景');
  await page.locator('#floor-circuit-density').fill('90');
  await category(page,'アニメーション');
  await page.getByLabel('3Dアニメーションを有効化').check();
  await page.waitForTimeout(550);
  await page.getByLabel('3Dアニメーションを有効化').uncheck();
  expect(digest(await png(page))).not.toBe(circuit);
  const savedFrame=digest(await png(page));
  const floorBefore=await preview.evaluate(el=>({
    time:el.dataset.floorTime,offset:el.dataset.floorOffset,mode:el.dataset.floorStyle,
  }));
  await category(page,'書き出し');
  const pending=page.waitForEvent('download');
  await page.getByRole('button',{name:'3Dの設定を保存',exact:true}).click();
  const projectBytes=await readFile((await (await pending).path())!);
  expect(JSON.parse(projectBytes.toString()).settings.floorGrid).toMatchObject({
    enabled:true,style:'circuit',circuitDensity:90,circuitSpeed:2,thickness:4,spacing:3.5,
    circuitDetail:85,circuitBoardOpacity:.55,circuitAccentColor:'#e6a65c',
  });
  await category(page,'背景');
  await page.getByLabel('床のデザイン').selectOption('grid');
  expect(digest(await png(page))).not.toBe(savedFrame);
  await category(page,'書き出し');
  await page.getByLabel('保存した3D設定ファイル').setInputFiles({
    name:'pcb-floor.json',mimeType:'application/json',buffer:projectBytes,
  });
  await expect(preview).toHaveAttribute('data-floor-style','circuit');
  await category(page,'背景');
  await expect(page.locator('#floor-circuit-speed')).toHaveValue('2');
  await expect(page.locator('#floor-circuit-density')).toHaveValue('90');
  await expect(page.locator('#floor-circuit-detail')).toHaveValue('85');
  await expect(page.locator('#floor-circuit-board-opacity')).toHaveValue('0.55');
  await expect(page.locator('#floor-circuit-accent')).toHaveValue('#e6a65c');
  const restored=digest(await png(page));
  const restoredTwice=digest(await png(page));
  const floorAfter=await preview.evaluate(el=>({
    time:el.dataset.floorTime,offset:el.dataset.floorOffset,mode:el.dataset.floorStyle,
  }));
  // Compare the restored project with the saved state, not only its PNG bytes.
  await category(page,'書き出し');
  const diagnosticDownload=page.waitForEvent('download');
  await page.getByRole('button',{name:'3Dの設定を保存',exact:true}).click();
  const restoredProject=JSON.parse((await readFile((await (await diagnosticDownload).path())!)).toString());
  console.log('MB JSON',JSON.stringify({
    savedFrame,restored,restoredTwice,floorBefore,floorAfter,
    before:{floorTime:project.floorElapsedSeconds,time:project.elapsedSeconds,view:project.view,background:project.background,colors:project.colorSettings},
    after:{floorTime:restoredProject.floorElapsedSeconds,time:restoredProject.elapsedSeconds,view:restoredProject.view,background:restoredProject.background,colors:restoredProject.colorSettings},
    settingsSame:JSON.stringify(restoredProject.settings)===JSON.stringify(project.settings),
  }));
  expect(restoredTwice).toBe(savedFrame);
  expect(errors).toEqual([]);
});

test('3D floor motherboard central core, IC count and signals change PNG and survive JSON',async({page})=>{
  const errors:string[]=[];
  page.on('pageerror',error=>errors.push(error.message));
  page.on('console',message=>{
    if(message.type()==='error'&&/WebGLProgram|Shader Error|VALIDATE_STATUS|GLSL/.test(message.text()))
      errors.push(message.text());
  });
  await start(page);
  await category(page,'アニメーション');
  await page.getByLabel('3Dアニメーションを有効化').uncheck();
  await category(page,'背景');
  await page.getByLabel('3D床グリッドを有効化').check();
  await page.getByLabel('床のデザイン').selectOption('circuit');
  await page.locator('#floor-circuit-density').fill('90');
  await page.locator('#floor-grid-opacity').fill('1');
  await page.locator('#floor-circuit-chip-count').fill('8');
  await page.locator('#floor-circuit-core-scale').fill('1.4');
  const preview=page.getByTestId('three-preview');
  await expect(page.getByLabel('中央演算コア・立体ICチップを表示')).toBeChecked();
  const full=digest(await png(page));
  await category(page,'背景');
  await page.getByLabel('中央演算コア・立体ICチップを表示').uncheck();
  const flat=digest(await png(page));
  expect(full).not.toBe(flat); // 3D hardware must actually be visible in the camera.
  await category(page,'背景');
  await page.getByLabel('中央演算コア・立体ICチップを表示').check();
  const afterToggle=digest(await png(page));
  const afterToggleTwice=digest(await png(page));
  console.log('MB TOGGLE',JSON.stringify({full,afterToggle,afterToggleTwice}));
  expect(afterToggleTwice).toBe(full); // No frame-time random layout.
  await category(page,'背景');
  await page.locator('#floor-circuit-chip-count').fill('0');
  const processorOnly=digest(await png(page));
  expect(processorOnly).not.toBe(full);
  await category(page,'背景');
  await page.locator('#floor-circuit-chip-count').fill('8');
  await category(page,'アニメーション');
  await page.getByLabel('3Dアニメーションを有効化').check();
  await page.waitForTimeout(750);
  await page.getByLabel('3Dアニメーションを有効化').uncheck();
  const paused=digest(await png(page));
  expect(paused).not.toBe(full);
  expect(digest(await png(page))).toBe(paused);
  await category(page,'書き出し');
  const pending=page.waitForEvent('download');
  await page.getByRole('button',{name:'3Dの設定を保存',exact:true}).click();
  const saved=await readFile((await (await pending).path())!);
  expect(JSON.parse(saved.toString()).settings.floorGrid).toMatchObject({
    circuitWorldEnabled:true,circuitChipCount:8,circuitCoreScale:1.4,
  });
  await category(page,'背景');
  await page.getByLabel('中央演算コア・立体ICチップを表示').uncheck();
  await category(page,'書き出し');
  await page.getByLabel('保存した3D設定ファイル').setInputFiles({
    name:'living-motherboard.json',mimeType:'application/json',buffer:saved,
  });
  await expect(preview).toHaveAttribute('data-floor-style','circuit');
  await category(page,'背景');
  await expect(page.locator('#floor-circuit-chip-count')).toHaveValue('8');
  await expect(page.locator('#floor-circuit-core-scale')).toHaveValue('1.4');
  expect(digest(await png(page))).toBe(paused);
  expect(errors).toEqual([]);
});

test('3D floor dense CPU city preset amplifies circuitry and remains deterministic',async({page})=>{
  const errors:string[]=[];
  page.on('pageerror',error=>errors.push(error.message));
  page.on('console',message=>{
    if(message.type()==='error'&&/WebGLProgram|Shader Error|VALIDATE_STATUS|GLSL/.test(message.text()))
      errors.push(message.text());
  });
  await start(page);
  await category(page,'アニメーション');
  await page.getByLabel('3Dアニメーションを有効化').uncheck();
  await category(page,'背景');
  await page.getByLabel('3D床グリッドを有効化').check();
  await page.getByLabel('床のデザイン').selectOption('circuit');
  const before=digest(await png(page));
  await category(page,'背景');
  await page.getByRole('button',{name:'巨大演算都市（高密度）'}).click();
  await expect(page.locator('#floor-circuit-core-scale')).toHaveValue('1.6');
  await expect(page.locator('#floor-circuit-chip-count')).toHaveValue('24');
  await expect(page.locator('#floor-circuit-detail')).toHaveValue('95');
  await expect(page.locator('#floor-circuit-density')).toHaveValue('90');
  await expect(page.getByLabel('中央演算コア・立体ICチップを表示')).toBeChecked();
  const after=digest(await png(page));
  expect(after).not.toBe(before);
  expect(digest(await png(page))).toBe(after);
  expect(errors).toEqual([]);
});
