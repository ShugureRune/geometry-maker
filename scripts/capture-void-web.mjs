import {chromium,expect} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';

const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH});
const directory='docs/void-web-v2';await mkdir(directory,{recursive:true});
try{
  const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error'&&/WebGLProgram|Shader Error|GLSL/.test(m.text()))errors.push(m.text());});
  await page.emulateMedia({reducedMotion:'reduce'});await page.goto(process.env.TEST_BASE_URL??'http://127.0.0.1:5173');
  await page.getByRole('button',{name:'3Dモード',exact:true}).click();
  await page.getByRole('navigation',{name:'設定カテゴリー'}).getByRole('button',{name:'書き出し',exact:true}).click();
  const records=[];
  const cases=(process.env.VOID_SEEDS??'cosmic-web-01,cosmic-web-02,cosmic-depth-17').split(',').map(seed=>({seed,ratio:'16:9',density:100,limit:2800,quality:'high',label:seed}));
  if(!process.env.VOID_SEEDS)cases.push(
    {seed:'cosmic-web-01',ratio:'16:9',density:50,limit:1400,quality:'high',label:'standard'},
    {seed:'cosmic-depth-17',ratio:'1:1',density:75,limit:1400,quality:'high',label:'square'},
    {seed:'cosmic-web-01',ratio:'9:16',density:100,limit:2800,quality:'auto',label:'portrait-lightweight'},
  );
  for(const item of cases){
    await page.setViewportSize(item.quality==='auto'?{width:390,height:844}:{width:1440,height:1000});
    const project=await page.evaluate(async item=>{
      const {threeDefaults}=await import('/src/three/settings.ts');const {voidWebDefaults}=await import('/src/three/void-settings.ts');
      return {kind:'geometry-maker-3d',schemaVersion:1,algorithmVersion:'3d-v1',seed:item.seed,aspectRatio:item.ratio,density:item.density,visualTheme:'cosmic',
        background:{mode:'gradient',solid:'#030617',colors:['#08051d','#0a1027','#031422'],angle:135,glowIntensity:75,figureColors:{primary:'#b995ff',support:'#65bfe4',accent:'#a8ebcf'}},
        settings:{...threeDefaults,animation:false,quality:item.quality,floorGrid:{...threeDefaults.floorGrid,enabled:false},celestial:{...threeDefaults.celestial,enabled:false},
          entrance:{...threeDefaults.entrance,enabled:false},voidMode:{...voidWebDefaults,enabled:true,objectLimit:item.limit}},
        elapsedSeconds:24,floorElapsedSeconds:24,exportWidth:item.ratio==='9:16'?720:item.ratio==='1:1'?960:1280,exportHeight:item.ratio==='9:16'?1280:item.ratio==='1:1'?960:720};
    },item);
    const old=await page.getByTestId('three-preview').locator('canvas').elementHandle();
    await page.getByLabel('保存した3D設定ファイル',{exact:true}).setInputFiles({name:'web.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(project))});
    if(old)await page.waitForFunction(el=>!el.isConnected,old);
    const save=page.getByRole('button',{name:'3D PNGを書き出す',exact:true});
    await expect(save).toBeEnabled({timeout:30_000});
    const pending=page.waitForEvent('download');await save.click();await(await pending).saveAs(`${directory}/${item.label}.png`);
    const preview=page.getByTestId('three-preview');
    const renderQuality=await preview.getAttribute('data-quality');
    // Make the companion settings portable: a desktop GPU would resolve auto differently.
    if(project.settings.quality==='auto')project.settings.quality=renderQuality;
    await writeFile(`${directory}/${item.label}.json`,JSON.stringify(project,null,2)+'\n');
    records.push({...item,renderQuality,objects:await preview.getAttribute('data-object-count'),filaments:await preview.getAttribute('data-void-filaments'),knots:await preview.getAttribute('data-void-knots')});
  }
  if(errors.length)throw new Error(errors.join('\n'));
  console.log(JSON.stringify(records,null,2));
  await writeFile(`${directory}/gallery.json`,JSON.stringify(records,null,2)+'\n');
}finally{await browser.close();}
