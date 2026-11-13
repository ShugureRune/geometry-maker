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
  await expect(planeState(page)).resolves.toBeNull();
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
