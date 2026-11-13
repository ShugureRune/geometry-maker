import {test,expect,type Page} from '@playwright/test';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {threeDefaults} from '../src/three/settings';
import {voidDefaults} from '../src/three/void-settings';

test.setTimeout(150_000);
const hash=(buffer:Buffer)=>createHash('sha256').update(buffer).digest('hex');
async function category(page:Page,name:string){const button=page.getByRole('navigation',{name:'設定カテゴリー'}).getByRole('button',{name,exact:true});if(await button.getAttribute('aria-expanded')!=='true')await button.click();}
const fixture=(enabled=false,seed='filament-prototype-01')=>({kind:'geometry-maker-3d',schemaVersion:1,algorithmVersion:'3d-v1',seed,aspectRatio:'16:9',density:100,visualTheme:'cosmic',
  background:{mode:'gradient',solid:'#060b21',colors:['#080526','#18112d','#071d31'],angle:135,glowIntensity:90},
  settings:{...threeDefaults,animation:false,quality:'high',floorGrid:{...threeDefaults.floorGrid,enabled:false},celestial:{...threeDefaults.celestial,enabled:false},
    entrance:{...threeDefaults.entrance,enabled:false},network:{...threeDefaults.network,enabled:true,mode:'neural',animation:'signal'},
    neon:{...threeDefaults.neon,enabled:true,display:'surface'},...(enabled?{voidMode:{...voidDefaults,enabled:true}}:{})},
  view:{position:[1.5,1,20],target:[0,0,0]},elapsedSeconds:12,floorElapsedSeconds:12,exportWidth:640,exportHeight:360});
async function open(page:Page,project=fixture(),url='./'){
  await page.emulateMedia({reducedMotion:'reduce'});await page.goto(url);
  await page.getByRole('button',{name:'3Dモード',exact:true}).click();await category(page,'書き出し');
  await page.getByLabel('保存した3D設定ファイル',{exact:true}).setInputFiles({name:'scene.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(project))});
  await expect(page.getByText('3D設定を読み込みました。',{exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:'視点をリセット',exact:true})).toBeEnabled({timeout:30_000});
}
async function png(page:Page){await category(page,'書き出し');const pending=page.waitForEvent('download');await page.getByRole('button',{name:'3D PNGを書き出す',exact:true}).click();const file=await pending;expect(await file.failure()).toBeNull();return readFile((await file.path())!);}
async function json(page:Page){await category(page,'書き出し');const pending=page.waitForEvent('download');await page.getByRole('button',{name:'3Dの設定を保存',exact:true}).click();return readFile((await(await pending).path())!,'utf8');}
async function toggle(page:Page,enabled:boolean){
  await category(page,'背景');await page.getByLabel('VOID MODEを有効化').setChecked(enabled);
  // These regressions intentionally exercise the saved v1 prototype. New
  // VOID sessions default to the separately tested large web.
  if(enabled&&await page.locator('#void-version').count())await page.locator('#void-version').selectOption('void-filaments-v1');
  await expect(page.getByRole('button',{name:'視点をリセット',exact:true})).toBeEnabled({timeout:30_000});
}

test('OFF preserves ordinary 3D, restores its camera/time and never overwrites normal wiring',async({page})=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await open(page);
  const normal=await png(page),original=JSON.parse(await json(page));
  await toggle(page,true);const preview=page.getByTestId('three-preview');await expect(preview).toHaveAttribute('data-void-mode','prototype');
  expect(Number(await preview.getAttribute('data-object-count'))).toBeGreaterThanOrEqual(17);expect(Number(await preview.getAttribute('data-object-count'))).toBeLessThanOrEqual(35);
  const cosmic=await png(page);expect(hash(cosmic)).not.toBe(hash(normal));
  await category(page,'装飾');await expect(page.locator('#network-mode')).toHaveCount(0);await page.locator('#network-width').fill('2');
  await toggle(page,false);await expect(preview).toHaveAttribute('data-void-mode','off');expect(hash(await png(page))).toBe(hash(normal));
  const restored=JSON.parse(await json(page));expect(restored.settings.network).toEqual(original.settings.network);expect(restored.settings.neon).toEqual(original.settings.neon);
  expect(restored.elapsedSeconds).toBe(original.elapsedSeconds);expect(restored.view).toEqual(original.view);
  await toggle(page,true);await category(page,'装飾');await expect(page.locator('#network-width')).toHaveValue('2');expect(errors).toEqual([]);
});

/** Baseline checkout predates the optional reconnect flash preference.
 * Omit only that new JSON field when loading the exact same scene on base. */
function referenceFixture(enabled=false){
  const original=fixture(enabled);
  const legacy={...original,settings:{...original.settings,
    standby:{...original.settings.standby}}};
  delete (legacy.settings.standby as {reconnectGlow?:boolean}).reconnectGlow;
  return legacy;
}

test('matches the base reference pixel-for-pixel for ordinary 3D and saved v1 VOID',async({page,browser})=>{
  test.skip(!process.env.VOID_REFERENCE_URL,'Set VOID_REFERENCE_URL to a read-only checkout of the PR base.');
  await open(page);const actual=await png(page);
  const reference=await browser.newPage();try{
    await open(reference,referenceFixture(),process.env.VOID_REFERENCE_URL!);expect(hash(await png(reference))).toBe(hash(actual));
    if(await reference.getByLabel('VOID MODEを有効化').count()){
      await open(page,fixture(true));const prototype=await png(page);
      await open(reference,referenceFixture(true),process.env.VOID_REFERENCE_URL!);expect(hash(await png(reference))).toBe(hash(prototype));
    }
  }finally{await reference.close();}
});

test('returns to a completed normal standby pose without replaying its entrance',async({page})=>{
  const project={...fixture(),elapsedSeconds:0,standbyComplete:true};
  project.settings.entrance={...project.settings.entrance,enabled:true,mode:'neural-grow'};
  await open(page,project);const normal=hash(await png(page));
  await toggle(page,true);await toggle(page,false);
  expect(hash(await png(page))).toBe(normal);
  expect(JSON.parse(await json(page)).standbyComplete).toBe(true);
});

test('uses actual instanced solid batches, seeded graphs and shared PNG/JSON/video capture',async({page})=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  page.on('console',message=>{if(message.type()==='error'&&/WebGLProgram|Shader Error|VALIDATE_STATUS|GLSL/.test(message.text()))errors.push(message.text());});
  await open(page,fixture(true));const preview=page.getByTestId('three-preview');
  const structure=await page.evaluate(async()=>{
    // Inspect the rendered scene, not a separate geometry implementation.
    const name=performance.getEntriesByType('resource').find(e=>e.name.includes('@react-three_fiber.js'))!.name;
    const {_roots}=await import(/* @vite-ignore */name);const root=[..._roots.values()][0] as {store:{getState:()=>{scene:{traverse:(fn:(o:any)=>void)=>void}}}};
    let count=0,batches=0,individual=0;root.store.getState().scene.traverse(o=>{if(o.name==='void-prototype-batches')o.traverse((child:any)=>{if(child.isInstancedMesh){batches++;count+=child.count;}else if(child.isMesh&&!child.isLineSegments2)individual++;});});
    return {count,batches,individual};
  });
  expect(structure.count).toBe(Number(await preview.getAttribute('data-object-count')));expect(structure.batches).toBeLessThanOrEqual(13);expect(structure.individual).toBe(0);
  const first=await png(page),saved=await json(page);expect(JSON.parse(saved).settings.voidMode.version).toBe('void-filaments-v1');
  await toggle(page,false);await category(page,'書き出し');await page.getByLabel('保存した3D設定ファイル').setInputFiles({name:'void.json',mimeType:'application/json',buffer:Buffer.from(saved)});
  await expect(preview).toHaveAttribute('data-void-mode','prototype');await expect(page.getByRole('button',{name:'視点をリセット',exact:true})).toBeEnabled();expect(hash(await png(page))).toBe(hash(first));
  await category(page,'図形');await page.getByLabel('クイック密度').fill('0');await expect(preview).toHaveAttribute('data-object-count','0');await expect(preview).toHaveAttribute('data-network-count','0');
  await page.getByLabel('クイック密度').fill('100');expect(hash(await png(page))).toBe(hash(first));
  const seed=page.getByLabel('シード値',{exact:true});await category(page,'図形');await seed.fill('different-filament');await seed.press('Enter');expect(hash(await png(page))).not.toBe(hash(first));
  // The normal timed WebGL frame path is also the video source (no screen recording).
  await category(page,'書き出し');await page.locator('summary').filter({hasText:'3D動画を書き出す'}).click();
  await page.locator('#three-video-width').fill('256');await page.locator('#three-video-height').fill('256');
  await page.locator('#three-video-duration').fill('1');await page.locator('#three-video-fps').selectOption('24');
  for(const format of ['webm','mp4']){
    await page.locator('#three-video-format').selectOption(format);
    const start=page.getByRole('button',{name:'3D動画を保存',exact:true});await expect(start).toBeEnabled({timeout:20_000});
    const pending=page.waitForEvent('download');await start.click();const download=await pending;
    expect(await download.failure()).toBeNull();expect(download.suggestedFilename()).toMatch(new RegExp(`\\.${format}$`));
    expect((await readFile((await download.path())!)).length).toBeGreaterThan(1000);
  }
  expect(errors).toEqual([]);
});

test('small VOID on mobile coexists with morph standby and electrical effects',async({browser})=>{
  const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:2});const page=await context.newPage();
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  page.on('console',message=>{if(message.type()==='error'&&/WebGLProgram|Shader Error|VALIDATE_STATUS|GLSL/.test(message.text()))errors.push(message.text());});
  try{
    const project=fixture(true);project.settings.quality='auto';await open(page,project);const preview=page.getByTestId('three-preview');
    await expect(preview).toHaveAttribute('data-quality','low');await expect(preview).toHaveAttribute('data-neural-signals','on');
    const file=await png(page);expect(file.length).toBeGreaterThan(5000);
    await category(page,'アニメーション');await page.getByRole('button',{name:'3Dを再生',exact:true}).click();
    await page.getByLabel('3D待機画面モードを有効化').check();
    await page.getByRole('button',{name:'今すぐ次の3Dシードへ',exact:true}).click();
    await expect(preview).toHaveAttribute('data-standby-active','true');
    await expect(preview).toHaveAttribute('data-standby-active','false',{timeout:20_000});
    await expect(preview).toHaveAttribute('data-void-mode','prototype');expect(Number(await preview.getAttribute('data-object-count'))).toBeLessThanOrEqual(35);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);expect(errors).toEqual([]);
  }finally{await context.close();}
});
