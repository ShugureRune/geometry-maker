import {test,expect,type Page} from '@playwright/test';
import {readFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {threeDefaults} from '../src/three/settings';
import {voidWebDefaults} from '../src/three/void-settings';
import type {ThreeProject} from '../src/three/project';

test.setTimeout(180_000);
const hash=(bytes:Buffer)=>createHash('sha256').update(bytes).digest('hex');
function fixture(seed='cosmic-web-01'):ThreeProject{return {
  kind:'geometry-maker-3d',schemaVersion:1,algorithmVersion:'3d-v1',seed,aspectRatio:'16:9',density:100,visualTheme:'cosmic',
  background:{mode:'gradient',solid:'#04091b',colors:['#08051d','#0a1027','#031422'],angle:135,glowIntensity:75,figureColors:{primary:'#b995ff',support:'#65bfe4',accent:'#a8ebcf'}},
  settings:{...threeDefaults,animation:false,quality:'high',floorGrid:{...threeDefaults.floorGrid!,enabled:false},celestial:{...threeDefaults.celestial!,enabled:false},
    entrance:{...threeDefaults.entrance!,enabled:false},voidMode:{...voidWebDefaults,enabled:true,objectLimit:1400}},
  elapsedSeconds:24,floorElapsedSeconds:24,exportWidth:640,exportHeight:360,
};}
async function category(page:Page,name:string){const button=page.getByRole('navigation',{name:'設定カテゴリー'}).getByRole('button',{name,exact:true});if(await button.getAttribute('aria-expanded')!=='true')await button.click();}
function errorsOn(page:Page){const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&/WebGLProgram|Shader Error|GLSL|VALIDATE_STATUS/.test(m.text()))errors.push(m.text());});return errors;}
async function restore(page:Page,project:ThreeProject){
  await category(page,'書き出し');const old=await page.getByTestId('three-preview').locator('canvas').elementHandle();
  await page.getByLabel('保存した3D設定ファイル',{exact:true}).setInputFiles({name:'web.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(project))});
  if(old)await page.waitForFunction(element=>!element.isConnected,old);
  await expect(page.getByRole('button',{name:'視点をリセット',exact:true})).toBeEnabled({timeout:30_000});
}
async function open(page:Page,project=fixture()){
  await page.emulateMedia({reducedMotion:'reduce'});await page.goto('./');await page.getByRole('button',{name:'3Dモード',exact:true}).click();await restore(page,project);
}
async function png(page:Page){await category(page,'書き出し');const pending=page.waitForEvent('download');await page.getByRole('button',{name:'3D PNGを書き出す',exact:true}).click();return readFile((await(await pending).path())!);}
async function saved(page:Page):Promise<ThreeProject>{await category(page,'書き出し');const pending=page.waitForEvent('download');await page.getByRole('button',{name:'3Dの設定を保存',exact:true}).click();return JSON.parse(await readFile((await(await pending).path())!,'utf8'));}
async function inspect(page:Page){return page.evaluate(async()=>{
  const url=performance.getEntriesByType('resource').find(e=>e.name.includes('@react-three_fiber.js'))!.name;
  const {_roots}=await import(/* @vite-ignore */url);const root=_roots.get(document.querySelector('[data-testid="three-preview"] canvas')) as any,scene=root.store.getState().scene;
  let bodies=0,outlines=0,bodyBatches=0,outlineBatches=0,individual=0,sphereVertices=0;const matrices:Record<string,number[]>={};
  scene.getObjectByName('void-web-batches')?.traverse((o:any)=>{
    if(o.isInstancedMesh){
      if(o.name==='void-web-outline'){outlines+=o.count;outlineBatches++;}
      else{bodies+=o.count;bodyBatches++;if(o.name==='void-web-solid-sphere')sphereVertices=o.geometry.getAttribute('position').count;for(let i=0;i<o.count;i++)matrices[`${o.name}:${i}`]=Array.from(o.instanceMatrix.array.slice(i*16,i*16+16));}
    }else if(o.isMesh)individual++;
  });
  const gl=root.store.getState().gl,context=gl.getContext(),debug=context.getExtension('WEBGL_debug_renderer_info');
  const renderer=String(context.getParameter(debug?debug.UNMASKED_RENDERER_WEBGL:context.RENDERER));
  return {bodies,outlines,bodyBatches,outlineBatches,individual,matrices,fog:!!scene.fog,sphereVertices,renderer};
});}

test('a new VOID session defaults to a large web and explicitly retains the old version',async({page})=>{
  const errors=errorsOn(page),normal=fixture();delete normal.settings.voidMode;await open(page,normal);
  const original=hash(await png(page));await category(page,'背景');await page.getByLabel('VOID MODEを有効化').check();
  await expect(page.getByTestId('three-preview')).toHaveAttribute('data-void-mode','web');
  await expect(page.locator('#void-version')).toHaveValue('void-web-v2');
  expect(Number(await page.getByTestId('three-preview').getAttribute('data-object-count'))).toBeGreaterThan(600);
  await category(page,'図形');const spacing=page.locator('#three-spacing');
  await expect(spacing).toHaveValue('100');
  const start=await inspect(page),key=Object.keys(start.matrices).find(id=>Math.abs(start.matrices[id][12])>.01)!;
  await spacing.fill('150');await expect(spacing).toHaveValue('150');
  await expect.poll(async()=>(await inspect(page)).matrices[key]?.[12]).not.toBe(start.matrices[key][12]);
  await spacing.fill('100');
  await expect.poll(async()=>(await inspect(page)).matrices[key]?.[12]).toBe(start.matrices[key][12]);
  await category(page,'背景');
  await page.locator('#void-version').selectOption('void-filaments-v1');await expect(page.getByTestId('three-preview')).toHaveAttribute('data-void-mode','prototype');
  expect(Number(await page.getByTestId('three-preview').getAttribute('data-object-count'))).toBeLessThanOrEqual(35);
  await page.getByLabel('VOID MODEを有効化').uncheck();expect(hash(await png(page))).toBe(original);
  const automatic=fixture();automatic.settings.quality='auto';automatic.settings.voidMode!.objectLimit=2800;await restore(page,automatic);
  const actual=await inspect(page);if(/swiftshader|llvmpipe|software|basic render/i.test(actual.renderer)){
    await expect(page.getByTestId('three-preview')).toHaveAttribute('data-quality','low');await expect(page.getByTestId('three-preview')).toHaveAttribute('data-object-count','640');
  }
  expect(errors).toEqual([]);
});

test('2800 real solids use bounded GPU batches and restore PNG, limits, density, depth and JSON',async({page})=>{
  const errors=errorsOn(page),project=fixture();project.settings.voidMode!.objectLimit=2800;await open(page,project);
  const preview=page.getByTestId('three-preview');await expect(preview).toHaveAttribute('data-object-count','2800');
  expect(Number(await preview.getAttribute('data-void-filaments'))).toBeGreaterThan(70);
  const first=await inspect(page);expect(first.bodies).toBe(2800);expect(first.outlines).toBe(2800);expect(first.bodyBatches).toBe(13);expect(first.outlineBatches).toBe(13);expect(first.individual).toBe(0);expect(first.fog).toBe(true);
  const image=await png(page),json=await saved(page);await restore(page,json);expect(hash(await png(page))).toBe(hash(image));
  await category(page,'背景');await page.locator('#void-object-limit').fill('600');await expect(preview).toHaveAttribute('data-object-count','600');
  await page.locator('#void-object-limit').fill('2800');const restored=await inspect(page);expect(restored.matrices).toEqual(first.matrices);
  await category(page,'図形');await page.getByLabel('クイック密度').fill('0');await expect(preview).toHaveAttribute('data-object-count','0');
  await page.getByLabel('クイック密度').fill('100');expect((await inspect(page)).matrices).toEqual(first.matrices);
  await category(page,'背景');await page.locator('#void-depth-fade').fill('0');expect((await inspect(page)).fog).toBe(false);expect(hash(await png(page))).not.toBe(hash(image));
  await category(page,'背景');await page.locator('#void-depth-fade').fill('80');expect(hash(await png(page))).toBe(hash(image));
  await mkdir('test-results/void-web',{recursive:true});await page.getByTestId('three-preview').screenshot({path:'test-results/void-web/large-web.png'});expect(errors).toEqual([]);
  const canvas=preview.locator('canvas');await canvas.scrollIntoViewIfNeeded();await canvas.hover();await page.mouse.wheel(0,-3000);
  await expect.poll(async()=>(await inspect(page)).sphereVertices,{timeout:30_000}).toBeGreaterThan(first.sphereVertices);
  expect((await inspect(page)).matrices).toEqual(first.matrices);
  const closeImage=await png(page),closeProject=await saved(page);await restore(page,closeProject);
  await expect.poll(async()=>(await inspect(page)).sphereVertices,{timeout:30_000}).toBeGreaterThan(first.sphereVertices);
  expect(hash(await png(page))).toBe(hash(closeImage));
  await page.getByRole('button',{name:'視点をリセット',exact:true}).click();
  await expect.poll(async()=>(await inspect(page)).sphereVertices,{timeout:30_000}).toBe(first.sphereVertices);expect(errors).toEqual([]);
});

test('mobile lightweight web grows, preserves paused frames and completes standby rewiring',async({browser})=>{
  const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:2}),page=await context.newPage(),errors=errorsOn(page);
  try{
    const project=fixture();project.aspectRatio='9:16';project.settings.quality='auto';project.settings.voidMode!.objectLimit=2800;project.settings.entrance={...project.settings.entrance!,enabled:true,mode:'neural-grow'};
    project.elapsedSeconds=0;await open(page,project);const preview=page.getByTestId('three-preview');
    await expect(preview).toHaveAttribute('data-quality','low');await expect(preview).toHaveAttribute('data-object-count','640');expect((await inspect(page)).bodies).toBe(0);
    project.elapsedSeconds=2.5;await restore(page,project);const middle=await inspect(page);expect(middle.bodies).toBeGreaterThan(0);expect(middle.bodies).toBeLessThan(640);
    project.elapsedSeconds=12;await restore(page,project);expect((await inspect(page)).bodies).toBe(640);
    const first=hash(await png(page));await page.waitForTimeout(150);expect(hash(await png(page))).toBe(first);
    await category(page,'背景');const slider=page.locator('#void-object-limit');await slider.scrollIntoViewIfNeeded();const box=(await slider.boundingBox())!;await page.touchscreen.tap(box.x+box.width*.75,box.y+box.height/2);
    expect(Number(await slider.inputValue())).toBeGreaterThan(600);await expect(preview).toHaveAttribute('data-object-count','640');
    await category(page,'アニメーション');await page.getByRole('button',{name:'3Dを再生',exact:true}).click();await page.getByLabel('3D待機画面モードを有効化').check();await page.getByRole('button',{name:'今すぐ次の3Dシードへ',exact:true}).click();
    await expect(preview).toHaveAttribute('data-standby-active','true');await expect(preview).toHaveAttribute('data-standby-active','false',{timeout:30_000});
    await expect(preview).toHaveAttribute('data-void-mode','web');expect(Number(await preview.getAttribute('data-object-count'))).toBeLessThanOrEqual(640);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);expect(errors).toEqual([]);
  }finally{await context.close();}
});

test('cosmic web reconnect sparks visibly follow the ON/OFF switch during standby',async({page})=>{
  const project=fixture('reconnect-cosmic');
  project.settings.quality='low';
  project.settings.voidMode!.objectLimit=600;
  project.settings.animation=true;
  project.settings.standby={...threeDefaults.standby!,enabled:true,mode:'morph',
    transitionSeconds:8,pauseOnInteraction:false,reconnectGlow:true};
  project.elapsedSeconds=12;
  await open(page,project);
  await category(page,'アニメーション');
  const glow=page.getByRole('checkbox',{name:'ワイヤー再接続時に発光'});
  await expect(glow).toBeChecked();
  await expect(page.locator('#three-standby-reconnect-intensity')).toHaveValue('25');
  const preview=page.getByTestId('three-preview');
  await page.getByRole('button',{name:'今すぐ次の3Dシードへ'}).click();
  await expect(preview).toHaveAttribute('data-standby-wire-phase','reconnect',{timeout:20_000});
  const count=async()=>page.evaluate(async()=>{
    const url=performance.getEntriesByType('resource').find(e=>e.name.includes('@react-three_fiber.js'))!.name;
    const {_roots}=await import(/* @vite-ignore */url);
    const canvas=document.querySelector('[data-testid="three-preview"] canvas');
    const root=_roots.get(canvas) as any;
    return root?.store.getState().scene.getObjectByName('standby-reconnect-sparks')?.count??0;
  });
  await expect.poll(count,{timeout:5_000,intervals:[40,100,160]}).toBeGreaterThan(0);
  await page.getByRole('button',{name:'3Dを一時停止',exact:true}).click();
  await expect.poll(count).toBeGreaterThan(0);
  const canvas=preview.locator('canvas');
  const on=await canvas.screenshot();
  const strength=page.locator('#three-standby-reconnect-intensity');
  await strength.fill('0');
  await expect.poll(count).toBe(0);
  const zero=await canvas.screenshot();
  expect(on.equals(zero)).toBe(false);
  await glow.uncheck();
  await expect.poll(count).toBe(0);
  const off=await canvas.screenshot();
  expect(on.equals(off)).toBe(false);
});

test('the web exports WebM and MP4 using exact animation frames and restores preview',async({page})=>{
  const errors=errorsOn(page),project=fixture();project.settings.quality='low';project.settings.voidMode!.objectLimit=600;
  project.settings.entrance={...project.settings.entrance!,enabled:true,mode:'neural-grow',duration:2};project.elapsedSeconds=0;project.exportWidth=256;project.exportHeight=256;await open(page,project);
  const background=(await png(page)).toString('base64');project.elapsedSeconds=12;await restore(page,project);
  const before=hash(await png(page));await category(page,'書き出し');await page.locator('.three-video-panel > summary').click();
  await page.locator('#three-video-width').fill('256');await page.locator('#three-video-height').fill('256');await page.locator('#three-video-duration').fill('3');await page.locator('#three-video-fps').selectOption('24');
  const endFrames:number[][]=[];
  for(const format of ['webm','mp4']){
    await page.locator('#three-video-format').selectOption(format);const start=page.getByRole('button',{name:'3D動画を保存',exact:true});
    await expect(start).toBeEnabled({timeout:30_000});const pending=page.waitForEvent('download');await start.click();const download=await pending;
    expect(await download.failure()).toBeNull();expect((await readFile((await download.path())!)).length).toBeGreaterThan(1000);
    const video=await readFile((await download.path())!);
    const decoded=await page.evaluate(async({bytes,format,background})=>{
      const url=URL.createObjectURL(new Blob([new Uint8Array(bytes)],{type:format==='mp4'?'video/mp4':'video/webm'})),v=document.createElement('video');v.src=url;
      const canvas=document.createElement('canvas');canvas.width=256;canvas.height=256;const c=canvas.getContext('2d')!;
      const image=new Image();image.src='data:image/png;base64,'+background;await image.decode();c.drawImage(image,0,0);const expected=c.getImageData(0,0,256,256).data;
      try{
        await new Promise<void>((resolve,reject)=>{v.onloadeddata=()=>resolve();v.onerror=()=>reject(new Error('video decode'));});
        c.drawImage(v,0,0);const first=c.getImageData(0,0,256,256).data;let changed=0;
        for(let i=0;i<first.length;i+=4)if(Math.abs(first[i]-expected[i])+Math.abs(first[i+1]-expected[i+1])+Math.abs(first[i+2]-expected[i+2])>45)changed++;
        await new Promise<void>(resolve=>{v.onseeked=()=>resolve();v.currentTime=71/24;});c.drawImage(v,0,0);
        return {duration:v.duration,firstForeground:changed,last:Array.from(c.getImageData(0,0,256,256).data)};
      }finally{URL.revokeObjectURL(url);}
    },{bytes:Array.from(video),format,background});
    expect(decoded.duration).toBeGreaterThanOrEqual(2.95);expect(decoded.firstForeground).toBeLessThan(150);endFrames.push(decoded.last);
    expect(hash(await png(page))).toBe(before);
  }
  project.elapsedSeconds=71/24;await restore(page,project);const completed=(await png(page)).toString('base64');
  for(const pixels of endFrames){
    const difference=await page.evaluate(async({pixels,completed})=>{
      const image=new Image();image.src='data:image/png;base64,'+completed;await image.decode();const canvas=document.createElement('canvas');canvas.width=256;canvas.height=256;const c=canvas.getContext('2d')!;c.drawImage(image,0,0);const expected=c.getImageData(0,0,256,256).data;let difference=0;
      for(let i=0;i<expected.length;i++)if(i%4!==3)difference+=Math.abs(expected[i]-pixels[i]);return difference/(256*256*3);
    },{pixels,completed});
    expect(difference).toBeLessThan(12); // lossy codec tolerance at matching timestamp
  }
  expect(errors).toEqual([]);
});
