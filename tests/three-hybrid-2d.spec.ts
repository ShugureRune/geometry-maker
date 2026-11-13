import {test,expect,type Page} from '@playwright/test';
import {readFile} from 'node:fs/promises';

test.setTimeout(100_000);
async function category(page:Page,label:string){
  const button=page.getByRole('navigation',{name:'設定カテゴリー'})
    .getByRole('button',{name:label,exact:true});
  if(await button.getAttribute('aria-expanded')!=='true')await button.click();
}
async function planeState(page:Page){
  return page.evaluate(async()=>{
    const entry=performance.getEntriesByType('resource')
      .find(e=>e.name.includes('@react-three_fiber.js'));
    if(!entry)return null;
    const {_roots}=await import(/* @vite-ignore */entry.name);
    const canvas=document.querySelector('[data-testid="three-preview"] canvas');
    if(!canvas)return null;
    const mesh=(_roots.get(canvas) as any)?.store.getState().scene.getObjectByName('hybrid-2d-plane');
    if(!mesh)return null;
    return {
      x:mesh.position.x,y:mesh.position.y,z:mesh.position.z,
      opacity:mesh.material.opacity,width:mesh.geometry.parameters.width,
      textureWidth:mesh.material.map?.image?.width??0,
    };
  });
}

test('native 2D SVG composites as a depth-aware textured plane with editable 3D transforms',async({page})=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.goto('./');
  await page.getByRole('button',{name:'3Dモード',exact:true}).click();
  await category(page,'図形');
  await page.getByLabel('3D描画品質').selectOption('low');
  const preview=page.getByTestId('three-preview');
  await expect(preview).toHaveAttribute('data-hybrid-2d','off');
  expect(await planeState(page)).toBeNull();
  const original=await preview.locator('canvas').screenshot();
  await page.getByLabel('3D空間に2D図形を合成').check();
  await expect(preview).toHaveAttribute('data-hybrid-2d','on');
  await expect.poll(async()=>(await planeState(page))?.textureWidth??0)
    .toBeGreaterThan(100);
  const textured=await preview.locator('canvas').screenshot();
  expect(original.equals(textured)).toBe(false);
  await page.locator('#hybrid-2d-x').fill('2');
  await page.locator('#hybrid-2d-y').fill('-1.5');
  await page.locator('#hybrid-2d-z').fill('3');
  await page.locator('#hybrid-2d-size').fill('10');
  await page.locator('#hybrid-2d-opacity').fill('0.5');
  await expect.poll(()=>planeState(page)).toMatchObject({
    x:2,y:-1.5,z:3,opacity:.5,
  });
  expect((await planeState(page))!.width).toBeGreaterThan(10);
  await page.getByLabel('2D図形をカメラに向ける').check();
  await expect(page.locator('#hybrid-2d-rotation-x')).toHaveCount(0);
  await page.getByLabel('2D図形をカメラに向ける').uncheck();
  await page.locator('#hybrid-2d-rotation-y').fill('60');
  await expect(preview.locator('canvas')).toBeVisible();
  await page.getByLabel('3D空間に2D図形を合成').uncheck();
  await expect.poll(()=>planeState(page)).toBeNull();
  expect(errors).toEqual([]);
});

test('hybrid scene exports and restores its native 2D source and transform',async({page})=>{
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.goto('./');
  await category(page,'図形');
  await page.getByLabel('生成アルゴリズム').selectOption('2d-v4');
  await page.getByRole('button',{name:'3Dモード',exact:true}).click();
  await category(page,'図形');
  await page.getByLabel('3D空間に2D図形を合成').check();
  await page.locator('#hybrid-2d-z').fill('-3');
  await category(page,'書き出し');
  const waiting=page.waitForEvent('download');
  await page.getByRole('button',{name:'3Dの設定を保存',exact:true}).click();
  const saved=await readFile((await (await waiting).path())!);
  const data=JSON.parse(saved.toString('utf8'));
  expect(data.settings.hybrid2D).toMatchObject({enabled:true,z:-3});
  expect(data.hybridSource.algorithmVersion).toBe('2d-v4');
  await category(page,'図形');
  await page.getByLabel('3D空間に2D図形を合成').uncheck();
  await page.getByRole('button',{name:'2Dモード',exact:true}).click();
  await category(page,'図形');
  await page.getByLabel('生成アルゴリズム').selectOption('2d-v5');
  await page.getByRole('button',{name:'3Dモード',exact:true}).click();
  await category(page,'書き出し');
  await page.getByLabel('保存した3D設定ファイル').setInputFiles({
    name:'hybrid-2d.json',mimeType:'application/json',buffer:saved,
  });
  await category(page,'図形');
  await expect(page.getByLabel('3D空間に2D図形を合成')).toBeChecked();
  await expect(page.locator('#hybrid-2d-z')).toHaveValue('-3');
  await page.getByRole('button',{name:'2Dモード',exact:true}).click();
  await category(page,'図形');
  await expect(page.getByLabel('生成アルゴリズム')).toHaveValue('2d-v4');
});

async function summonedPlanes(page:Page){
  return page.evaluate(async()=>{
    const entry=performance.getEntriesByType('resource')
      .find(e=>e.name.includes('@react-three_fiber.js'));
    if(!entry)return [];
    const {_roots}=await import(/* @vite-ignore */entry.name);
    const canvas=document.querySelector('[data-testid="three-preview"] canvas');
    if(!canvas)return [];
    const scene=(_roots.get(canvas) as any)?.store.getState().scene;
    const all:any[]=[];
    scene?.traverse((node:any)=>{
      if(node.name?.startsWith('hybrid-2d-plane'))
        all.push({seed:node.userData.hybridSeed,index:node.userData.hybridIndex,
          position:node.position.toArray(),textureWidth:node.material.map?.image?.width??0,
          textureId:node.material.map?.uuid??null});
    });
    return all.sort((a,b)=>a.index-b.index);
  });
}

test('summons multiple distinct native 2D seeds, rearranges without rerendering, and rerolls',async({page})=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.goto('./');
  await page.getByRole('button',{name:'3Dモード',exact:true}).click();
  await category(page,'図形');
  await page.getByLabel('3D描画品質').selectOption('low');
  await page.getByLabel('3D空間に2D図形を合成').check();
  await page.locator('#hybrid-2d-count').fill('8');
  const preview=page.getByTestId('three-preview');
  await expect(preview).toHaveAttribute('data-hybrid-2d-count','8');
  await expect.poll(async()=> (await summonedPlanes(page)).filter(x=>x.textureWidth>0).length,
    {timeout:20000,intervals:[100,250,400]}).toBe(8);
  const initial=await summonedPlanes(page);
  expect(initial).toHaveLength(8);
  expect(new Set(initial.map(x=>x.seed)).size).toBe(8);
  expect(new Set(initial.map(x=>x.position.join(','))).size).toBe(8);
  expect(initial.every(x=>x.textureWidth<=192)).toBe(true);
  await page.locator('#hybrid-2d-layout').selectOption('grid');
  await expect.poll(async()=> (await summonedPlanes(page))[1]?.position.join(','))
    .not.toBe(initial[1].position.join(','));
  const grid=await summonedPlanes(page);
  expect(grid.map(x=>x.seed)).toEqual(initial.map(x=>x.seed));
  expect(grid.map(x=>x.textureId)).toEqual(initial.map(x=>x.textureId));
  await page.getByRole('button',{name:'別シードを再抽選'}).click();
  await expect(page.getByTestId('hybrid-2d-variation')).toContainText('再抽選番号：1');
  await expect.poll(async()=> (await summonedPlanes(page)).filter(x=>x.textureWidth>0).length,
    {timeout:20000,intervals:[100,250,400]}).toBe(8);
  const rerolled=await summonedPlanes(page);
  expect(rerolled[0].seed).toBe(initial[0].seed);
  expect(rerolled.slice(1).map(x=>x.seed)).not.toEqual(initial.slice(1).map(x=>x.seed));
  expect(errors).toEqual([]);
});

test('large summon counts are capped on low quality and preserved in settings JSON',async({page})=>{
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.goto('./');
  await page.getByRole('button',{name:'3Dモード',exact:true}).click();
  await category(page,'図形');
  await page.getByLabel('3D描画品質').selectOption('low');
  await page.getByLabel('3D空間に2D図形を合成').check();
  await page.locator('#hybrid-2d-count').fill('32');
  await page.locator('#hybrid-2d-layout').selectOption('spiral');
  await page.locator('#hybrid-2d-spread').fill('15');
  await expect(page.getByTestId('three-preview')).toHaveAttribute('data-hybrid-2d-count','12');
  await expect.poll(async()=>(await summonedPlanes(page)).length,{timeout:25000}).toBe(12);
  await category(page,'書き出し');
  const waiting=page.waitForEvent('download');
  await page.getByRole('button',{name:'3Dの設定を保存',exact:true}).click();
  const data=JSON.parse((await readFile((await (await waiting).path())!)).toString('utf8'));
  expect(data.settings.hybrid2D).toMatchObject({enabled:true,count:32,layout:'spiral',spread:15});
  await category(page,'図形');
  await page.locator('#hybrid-2d-count').fill('1');
  await expect(page.getByTestId('three-preview')).toHaveAttribute('data-hybrid-2d-count','1');
  await category(page,'書き出し');
  await page.getByLabel('保存した3D設定ファイル').setInputFiles({
    name:'summons.json',mimeType:'application/json',
    buffer:Buffer.from(JSON.stringify(data)),
  });
  await category(page,'図形');
  await expect(page.locator('#hybrid-2d-count')).toHaveValue('32');
  await expect(page.locator('#hybrid-2d-layout')).toHaveValue('spiral');
  await expect(page.getByTestId('three-preview')).toHaveAttribute('data-hybrid-2d-count','12');
});
