// Development server required. Captures the real WebGL PNG path at a fixed time.
import {chromium} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';

const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH});
const directory='docs/void-prototype';
await mkdir(directory,{recursive:true});
try{
  const page=await browser.newPage({viewport:{width:1440,height:1000}});
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  page.on('console',message=>{if(message.type()==='error'&&/WebGLProgram|Shader Error|VALIDATE_STATUS|GLSL/.test(message.text()))errors.push(message.text());});
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.goto(process.env.TEST_BASE_URL??'http://127.0.0.1:5173');
  await page.getByRole('button',{name:'3Dモード',exact:true}).click();
  const records=[];
  for(const [seed,ratio,view] of [
    ['cosmic-web-01','16:9',{position:[1.5,1,18],target:[0,0,0]}],
    ['filament-prototype-01','16:9',{position:[1.5,1,18],target:[0,0,0]}],
    ['cosmic-depth-17','16:9',{position:[8,4,16],target:[0,0,0]}],
    ['cosmic-web-01','9:16',{position:[1,1,19],target:[0,0,0]}],
  ]){
    const project=await page.evaluate(async({seed,ratio,view})=>{
      const {threeDefaults}=await import('/src/three/settings.ts');
      const {voidDefaults}=await import('/src/three/void-settings.ts');
      return {kind:'geometry-maker-3d',schemaVersion:1,algorithmVersion:'3d-v1',seed,aspectRatio:ratio,density:100,visualTheme:'cosmic',
        background:{mode:'gradient',solid:'#060b21',colors:['#080526','#18112d','#071d31'],angle:135,glowIntensity:90,
          figureColors:{primary:'#b995ff',support:'#76cfe8',accent:'#beffd4'}},
        settings:{...threeDefaults,animation:false,quality:'high',floorGrid:{...threeDefaults.floorGrid,enabled:false},celestial:{...threeDefaults.celestial,enabled:false},
          entrance:{...threeDefaults.entrance,enabled:false},voidMode:{...voidDefaults,enabled:true}},
        view,elapsedSeconds:12,floorElapsedSeconds:12,exportWidth:ratio==='16:9'?1280:720,exportHeight:ratio==='16:9'?720:1280};
    },{seed,ratio,view});
    const category=page.getByRole('navigation',{name:'設定カテゴリー'}).getByRole('button',{name:'書き出し',exact:true});
    if(await category.getAttribute('aria-expanded')!=='true')await category.click();
    await page.getByLabel('保存した3D設定ファイル',{exact:true}).setInputFiles({name:'void.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(project))});
    await page.getByRole('button',{name:'視点をリセット',exact:true}).waitFor();
    await page.waitForFunction(()=>!document.querySelector('button[aria-label="視点をリセット"]')?.disabled);
    const filename=`${seed}-${ratio.replace(':','x')}`;
    const pending=page.waitForEvent('download');
    await page.getByRole('button',{name:'3D PNGを書き出す',exact:true}).click();
    await(await pending).saveAs(`${directory}/${filename}.png`);
    await writeFile(`${directory}/${filename}.json`,JSON.stringify(project,null,2)+'\n');
    const preview=page.getByTestId('three-preview');
    records.push({seed,ratio,view,objects:await preview.getAttribute('data-object-count'),wires:await preview.getAttribute('data-network-count')});
  }
  if(errors.length)throw new Error(errors.join('\n'));
  console.log(JSON.stringify(records,null,2));
}finally{await browser.close();}
