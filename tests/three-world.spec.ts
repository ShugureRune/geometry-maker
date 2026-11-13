import {test,expect,type Page} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';

test.setTimeout(220_000);
async function category(page:Page,name:string){
  const b=page.getByRole('navigation',{name:'設定カテゴリー'})
    .getByRole('button',{name,exact:true});
  if(await b.getAttribute('aria-expanded')!=='true')await b.click();
}
async function start(page:Page){
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.goto('./');
  await page.getByLabel('シード値',{exact:true}).fill('3d-world-builder-2026');
  await page.getByLabel('シード値',{exact:true}).press('Enter');
  await page.getByRole('button',{name:'3Dモード',exact:true}).click();
  await expect(page.getByTestId('three-preview').locator('canvas')).toBeVisible();
  await category(page,'アニメーション');
  await page.getByLabel('3Dアニメーションを有効化').uncheck();
}
async function png(page:Page):Promise<Buffer>{
  await category(page,'書き出し');
  await page.getByLabel('3D 幅 (px)').fill('420');
  await page.getByLabel('3D 高さ (px)').fill('420');
  const next=page.waitForEvent('download');
  await page.getByRole('button',{name:'3D PNGを書き出す',exact:true}).click();
  return readFile((await (await next).path())!);
}
const digest=(b:Buffer)=>createHash('sha256').update(b).digest('hex');

test('mountain canyon volcano glacier and floating islands render differently and preserve figures',async({page})=>{
  const errors:string[]=[];
  page.on('pageerror',err=>errors.push(err.message));
  page.on('console',message=>{
    if(message.type()==='error'&&/WebGLProgram|Shader Error|VALIDATE_STATUS|GLSL/.test(message.text()))
      errors.push(message.text());
  });
  await start(page);
  const preview=page.getByTestId('three-preview'),count=await preview.getAttribute('data-object-count');
  const images=new Set<string>();
  for(const kind of ['alpine-peaks','grand-canyon','volcanic-field','glacier','floating-islands']){
    await category(page,'背景');
    await page.getByLabel('3D背景の種類').selectOption(kind);
    await expect(preview).toHaveAttribute('data-sky-kind',kind);
    await expect(preview).toHaveAttribute('data-object-count',count!);
    await category(page,'書き出し');
    const next=page.waitForEvent('download');
    await page.getByRole('button',{name:'3D PNGを書き出す',exact:true}).click();
    const bytes=await readFile((await (await next).path())!);
    expect(bytes.subarray(1,4).toString()).toBe('PNG');
    expect(bytes.length).toBeGreaterThan(4000);
    images.add(digest(bytes));
  }
  expect(images.size).toBe(5);
  expect(errors).toEqual([]);
});

test('sun time, storms, natural density and water reflection adjust image and survive 3D JSON',async({page})=>{
  await start(page);
  await category(page,'背景');
  await page.getByLabel('3D背景の種類').selectOption('shallow-water');
  const hour=page.locator('#three-world-hour'),weather=page.locator('#three-world-weather');
  const ref=page.locator('#three-world-water-reflection'),clouds=page.locator('#three-world-clouds');
  await hour.fill('12');
  const noon=digest(await png(page));
  await category(page,'背景');
  await hour.fill('0');
  const midnight=digest(await png(page));
  expect(noon).not.toBe(midnight);
  await category(page,'背景');
  await weather.selectOption('storm');
  const storm=digest(await png(page));
  expect(storm).not.toBe(midnight);
  await category(page,'背景');
  await ref.fill('0');
  const noReflection=digest(await png(page));
  expect(noReflection).not.toBe(storm);
  await category(page,'背景');
  await clouds.fill('0');
  await page.locator('#three-world-nature').fill('130');
  await page.locator('#three-world-water-waves').fill('180');
  await page.getByLabel('3D背景の種類').selectOption('alpine-peaks');
  const saved=digest(await png(page));
  await category(page,'書き出し');
  const download=page.waitForEvent('download');
  await page.getByRole('button',{name:'3Dの設定を保存'}).click();
  const bytes=await readFile((await (await download).path())!);
  const project=JSON.parse(bytes.toString());
  expect(project.settings.sky.world).toMatchObject({
    timeOfDay:0,weather:'storm',natureDensity:130,cloudAmount:0,waterReflection:0,waterWaves:180,
  });
  await category(page,'背景');
  await page.locator('#three-world-hour').fill('12');
  await category(page,'書き出し');
  await page.getByLabel('保存した3D設定ファイル').setInputFiles({
    name:'world.json',mimeType:'application/json',buffer:bytes,
  });
  await expect(page.getByTestId('three-preview')).toHaveAttribute('data-sky-kind','alpine-peaks');
  await category(page,'背景');
  await expect(page.locator('#three-world-hour')).toHaveValue('0');
  expect(digest(await png(page))).toBe(saved);
});

async function savedView(page:Page):Promise<{position:number[];target:number[]}>{
  await category(page,'書き出し');
  const download=page.waitForEvent('download');
  await page.getByRole('button',{name:'3Dの設定を保存',exact:true}).click();
  const data=JSON.parse(await readFile((await(await download).path())!,'utf8'));
  return data.view;
}
const gap=(a:number[],b:number[])=>Math.hypot(...a.map((value,i)=>value-b[i]));

test('one camera mode looks in place and moves with wheel/WASD without changing 3D export',async({page})=>{
  await start(page);
  await category(page,'背景');
  await page.getByLabel('3D背景の種類').selectOption('endless-desert');
  const preview=page.getByTestId('three-preview'),canvas=preview.locator('canvas');
  await expect(preview).toHaveAttribute('data-navigation','unified');
  await expect(page.locator('#three-world-explore')).toHaveCount(0);
  await expect(page.locator('#three-world-explore-speed')).toBeVisible();
  await expect(page.getByRole('button',{name:'探索 ↑'})).toHaveCount(0);

  const before=await savedView(page),box=(await canvas.boundingBox())!;
  await page.mouse.move(box.x+box.width*.45,box.y+box.height*.45);
  await page.mouse.down();
  await page.mouse.move(box.x+box.width*.45+90,box.y+box.height*.45+25,{steps:6});
  await page.mouse.up();
  const looked=await savedView(page);
  expect(gap(looked.position,before.position)).toBeLessThan(.001);
  expect(gap(looked.target,before.target)).toBeGreaterThan(.5);

  await canvas.hover();
  await page.mouse.wheel(0,-280);
  const advanced=await savedView(page);
  expect(gap(advanced.position,looked.position)).toBeGreaterThan(.15);

  const beforeImage=digest(await png(page));
  await canvas.focus();
  await page.keyboard.down('w');
  await page.waitForTimeout(350);
  await page.keyboard.up('w');
  const afterImage=digest(await png(page));
  expect(beforeImage).not.toBe(afterImage);
});

test('mobile touch rotates in place, two fingers pan, and pinch moves the camera forward',async({browser})=>{
  const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true,deviceScaleFactor:1});
  const page=await context.newPage();
  try{
    await start(page);
    const canvas=page.getByTestId('three-preview').locator('canvas');
    const gestureCenter=async()=>{
      await canvas.scrollIntoViewIfNeeded();
      const bounds=(await canvas.boundingBox())!;
      return {x:bounds.x+bounds.width*.5,y:bounds.y+bounds.height*.5};
    };
    const cdp=await context.newCDPSession(page);
    const fire=async(type:'touchStart'|'touchMove'|'touchEnd',points:{id:number;x:number;y:number}[])=>
      cdp.send('Input.dispatchTouchEvent',{type,touchPoints:points});
    const before=await savedView(page);
    const {x,y}=await gestureCenter();
    await fire('touchStart',[{id:1,x,y}]);
    await fire('touchMove',[{id:1,x:x+70,y:y+30}]);
    await fire('touchEnd',[]);
    const looked=await savedView(page);
    expect(gap(before.position,looked.position)).toBeLessThan(.001);
    expect(gap(before.target,looked.target)).toBeGreaterThan(.3);
    const facing=(v:{position:number[];target:number[]})=>
      v.target.map((n,i)=>n-v.position[i]);

    const panCenter=await gestureCenter(),px=panCenter.x,py=panCenter.y;
    await fire('touchStart',[{id:2,x:px-25,y:py},{id:3,x:px+25,y:py}]);
    await fire('touchMove',[{id:2,x:px+45,y:py},{id:3,x:px+95,y:py}]);
    await fire('touchEnd',[]);
    const panned=await savedView(page);
    expect(gap(looked.position,panned.position)).toBeGreaterThan(.2);
    expect(gap(facing(looked),facing(panned))).toBeLessThan(.01);

    const pinchCenter=await gestureCenter(),zx=pinchCenter.x,zy=pinchCenter.y;
    await fire('touchStart',[{id:4,x:zx-30,y:zy},{id:5,x:zx+30,y:zy}]);
    await fire('touchMove',[{id:4,x:zx-70,y:zy},{id:5,x:zx+70,y:zy}]);
    await fire('touchEnd',[]);
    const zoomed=await savedView(page);
    expect(gap(panned.position,zoomed.position)).toBeGreaterThan(.5);
    expect(gap(facing(panned),facing(zoomed))).toBeLessThan(.01);
  }finally{await context.close();}
});

test('mobile low quality handles floating islands, snowy weather and solar lighting then returns to 2D',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await start(page);
  await category(page,'図形');
  await page.getByLabel('3D描画品質').selectOption('low');
  await page.getByLabel('3D天体を表示').check();
  await category(page,'背景');
  await page.getByLabel('3D背景の種類').selectOption('floating-islands');
  await page.locator('#three-world-weather').selectOption('snow');
  await page.locator('#three-world-hour').fill('7');
  await expect(page.getByTestId('three-preview')).toHaveAttribute('data-quality','low');
  await expect(page.getByTestId('three-preview')).toHaveAttribute('data-celestial-count','6');
  await category(page,'書き出し');
  const next=page.waitForEvent('download');
  await page.getByRole('button',{name:'3D PNGを書き出す',exact:true}).click();
  expect((await readFile((await (await next).path())!)).length).toBeGreaterThan(4000);
  await page.getByRole('button',{name:'2Dモード',exact:true}).click();
  await expect(page.getByTestId('preview')).toBeVisible();
});
