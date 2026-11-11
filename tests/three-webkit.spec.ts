import {test,expect} from '@playwright/test';

test.use({browserName:'webkit',viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true});
test.setTimeout(90_000);

test('iPhone-sized WebKit can open 3D and render the live motherboard',async({page})=>{
  const errors:string[]=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{
    if(m.type()==='error'&&/WebGLProgram|Shader Error|VALIDATE_STATUS|GLSL/.test(m.text()))
      errors.push(m.text());
  });
  await page.goto('./');
  const hasWebGL2=await page.evaluate(()=>{
    const canvas=document.createElement('canvas');
    return !!canvas.getContext('webgl2');
  });
  test.skip(!hasWebGL2,'This WebKit host has no WebGL2 device; physical iOS validation is separate.');
  await page.getByRole('button',{name:'3Dモード',exact:true}).click();
  const preview=page.getByTestId('three-preview');
  await expect(preview.locator('canvas')).toBeVisible();
  await expect(preview).toHaveAttribute('data-quality','low');
  const bg=page.getByRole('navigation',{name:'設定カテゴリー'}).getByRole('button',{name:'背景',exact:true});
  if(await bg.getAttribute('aria-expanded')!=='true')await bg.click();
  await page.getByLabel('3D床グリッドを有効化').check();
  await page.getByLabel('床のデザイン').selectOption('circuit');
  await expect(preview).toHaveAttribute('data-floor-style','circuit');
  await expect(page.getByLabel('中央演算コア・立体ICチップを表示')).toBeChecked();
  await expect(preview.locator('canvas')).toBeVisible();
  await expect(page.getByText('3D表示を開始できませんでした')).toHaveCount(0);
  expect(errors).toEqual([]);
});
