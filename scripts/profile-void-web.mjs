// Short software/hardware WebGL probe; not a physical-phone or long-soak test.
import {chromium,expect} from '@playwright/test';
import {readFile,writeFile} from 'node:fs/promises';
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH});
try{
  const page=await browser.newPage({viewport:{width:1280,height:900}}),results=[],errors=[];
  page.on('pageerror',e=>errors.push(e.message));await page.emulateMedia({reducedMotion:'reduce'});
  await page.goto(process.env.TEST_BASE_URL??'http://127.0.0.1:5173');await page.getByRole('button',{name:'3Dモード',exact:true}).click();
  await page.getByRole('navigation',{name:'設定カテゴリー'}).getByRole('button',{name:'書き出し',exact:true}).click();
  const original=JSON.parse(await readFile('docs/void-web-v2/cosmic-web-01.json','utf8'));
  for(const [quality,limit] of [['low',2800],['high',1400],['high',2800]]){
    const project=structuredClone(original);project.settings.quality=quality;project.settings.voidMode.objectLimit=limit;project.settings.animation=true;project.settings.entrance.enabled=false;
    const old=await page.getByTestId('three-preview').locator('canvas').elementHandle();
    await page.getByLabel('保存した3D設定ファイル',{exact:true}).setInputFiles({name:'profile.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(project))});
    if(old)await page.waitForFunction(el=>!el.isConnected,old);await expect(page.getByRole('button',{name:'視点をリセット',exact:true})).toBeEnabled({timeout:30_000});
    await page.getByTestId('three-preview').scrollIntoViewIfNeeded();
    const result=await page.evaluate(async()=>{
      const url=performance.getEntriesByType('resource').find(e=>e.name.includes('@react-three_fiber.js')).name;
      const {_roots}=await import(url),root=_roots.get(document.querySelector('[data-testid="three-preview"] canvas')),{gl,scene}=root.store.getState(),context=gl.getContext(),ext=context.getExtension('WEBGL_debug_renderer_info');
      let bodyBatches=0,outlineBatches=0,instances=0;scene.getObjectByName('void-web-batches').traverse(o=>{if(o.isInstancedMesh){if(o.name==='void-web-outline')outlineBatches++;else{bodyBatches++;instances+=o.count;}}});
      const intervals=[],start=performance.now();let last;
      await new Promise(resolve=>{const tick=now=>{if(last!==undefined)intervals.push(now-last);last=now;if(now-start<2200)requestAnimationFrame(tick);else resolve();};requestAnimationFrame(tick);});
      const elapsed=performance.now()-start,sorted=[...intervals].sort((a,b)=>a-b);
      return {renderer:ext?context.getParameter(ext.UNMASKED_RENDERER_WEBGL):context.getParameter(context.RENDERER),instances,bodyBatches,outlineBatches,
        sampledFrames:intervals.length,elapsedMs:elapsed,observedFps:intervals.length/(elapsed/1000),medianFrameMs:sorted[Math.floor(sorted.length*.5)],p95FrameMs:sorted[Math.floor(sorted.length*.95)],gpuGeometries:gl.info.memory.geometries,gpuTextures:gl.info.memory.textures};
    });
    results.push({quality,requestedLimit:limit,...result});
  }
  if(errors.length)throw new Error(errors.join('\n'));
  await writeFile('docs/void-web-v2/performance.json',JSON.stringify({note:'Short headless Chromium probe on the recorded renderer; not a physical PC/phone benchmark or a long-duration leak test.',results},null,2)+'\n');
  console.log(JSON.stringify(results,null,2));
}finally{await browser.close();}
