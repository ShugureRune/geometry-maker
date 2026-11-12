import {test,expect,type Page} from '@playwright/test';
import {readFile} from 'node:fs/promises';

test.setTimeout(90_000);

async function category(page:Page,label:string){
  const tab=page.getByRole('navigation',{name:'設定カテゴリー'})
    .getByRole('button',{name:label,exact:true});
  if(await tab.getAttribute('aria-expanded')!=='true')await tab.click();
}
async function viewFromSavedSettings(page:Page){
  await category(page,'書き出し');
  const pending=page.waitForEvent('download');
  await page.getByRole('button',{name:'3Dの設定を保存',exact:true}).click();
  const data=JSON.parse(await readFile((await (await pending).path())!,'utf8'));
  expect(data.view?.position).toHaveLength(3);
  return data;
}
const distance=(a:number[],b:number[])=>
  Math.hypot(...a.map((n,i)=>n-b[i]));

test('standby camera orbit defaults OFF, moves without zoom jumps, pauses and survives refresh',async({page})=>{
  const errors:string[]=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto('./');
  await page.getByRole('button',{name:'3Dモード',exact:true}).click();
  await category(page,'図形');
  await page.getByLabel('3D描画品質').selectOption('low');
  const preview=page.getByTestId('three-preview');
  await expect(preview.locator('canvas')).toBeVisible();

  await category(page,'アニメーション');
  await page.getByLabel('3D待機画面モードを有効化').check();
  const toggle=page.getByRole('checkbox',{name:'待機中にカメラを自動回転'});
  await expect(toggle).not.toBeChecked();
  await expect(page.locator('#three-standby-camera-speed')).toHaveCount(0);
  await expect(preview).toHaveAttribute('data-camera-auto-rotate','off');

  await toggle.check();
  const speed=page.locator('#three-standby-camera-speed');
  await expect(speed).toBeVisible();
  await speed.fill('3');
  await expect(preview).toHaveAttribute('data-camera-auto-rotate','on');
  await page.waitForTimeout(700);
  const first=await viewFromSavedSettings(page);
  expect(first.settings.standby).toMatchObject({
    enabled:true,cameraAutoRotate:true,cameraRotateSpeed:3,
  });
  await page.waitForTimeout(1000);
  const later=await viewFromSavedSettings(page);
  expect(distance(later.view.position,first.view.position)).toBeGreaterThan(.08);
  // The camera should orbit at nearly constant distance around the same target.
  expect(distance(later.view.position,later.view.target))
    .toBeCloseTo(distance(first.view.position,first.view.target),1);
  expect(distance(later.view.target,first.view.target)).toBeLessThan(.05);

  await category(page,'アニメーション');
  await page.getByRole('button',{name:'3Dを一時停止',exact:true}).click();
  const paused=await viewFromSavedSettings(page);
  await page.waitForTimeout(850);
  const still=await viewFromSavedSettings(page);
  expect(distance(paused.view.position,still.view.position)).toBeLessThan(.05);

  await expect.poll(()=>page.evaluate(()=>{
    try{return JSON.parse(localStorage.getItem('geometry-maker-studio-autosave-v1')??'null')
      ?.threeD?.settings?.standby?.cameraAutoRotate;}
    catch{return null;}
  })).toBe(true);
  await page.reload();
  await expect(page.getByRole('button',{name:'3Dモード',exact:true}))
    .toHaveAttribute('aria-pressed','true');
  await category(page,'アニメーション');
  await expect(page.getByRole('checkbox',{name:'待機中にカメラを自動回転'})).toBeChecked();
  await expect(page.locator('#three-standby-camera-speed')).toHaveValue('3');
  expect(errors).toEqual([]);
});

test('tilted 10-degree orbit moves camera vertically, stays centered and restores its mode',async({page})=>{
  const errors:string[]=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto('./');
  await page.getByRole('button',{name:'3Dモード',exact:true}).click();
  await category(page,'図形');
  await page.getByLabel('3D描画品質').selectOption('low');
  const preview=page.getByTestId('three-preview');
  await expect(preview.locator('canvas')).toBeVisible();

  await category(page,'アニメーション');
  await page.getByLabel('3D待機画面モードを有効化').check();
  const orbit=page.getByRole('checkbox',{name:'待機中にカメラを自動回転'});
  await expect(orbit).not.toBeChecked();
  await orbit.check();
  const mode=page.locator('#three-standby-orbit-mode');
  await expect(mode).toHaveValue('horizontal');
  await expect(page.locator('#three-standby-camera-tilt')).toHaveCount(0);
  await mode.selectOption('inclined');
  await expect(preview).toHaveAttribute('data-camera-orbit-mode','inclined');
  const tilt=page.locator('#three-standby-camera-tilt');
  await expect(tilt).toHaveValue('10');
  await page.locator('#three-standby-camera-speed').fill('3');

  const first=await viewFromSavedSettings(page);
  await page.waitForTimeout(1450);
  const second=await viewFromSavedSettings(page);
  expect(Math.abs(second.view.position[1]-first.view.position[1])).toBeGreaterThan(.08);
  expect(distance(first.view.target,second.view.target)).toBeLessThan(.05);
  expect(distance(first.view.position,first.view.target))
    .toBeCloseTo(distance(second.view.position,second.view.target),1);

  await category(page,'アニメーション');
  await tilt.fill('20');
  await expect(tilt).toHaveValue('20');
  await mode.selectOption('horizontal');
  await expect(page.locator('#three-standby-camera-tilt')).toHaveCount(0);
  await mode.selectOption('inclined');
  await expect(tilt).toHaveValue('20');

  await expect.poll(async()=>page.evaluate(()=>{
    try{return JSON.parse(localStorage.getItem('geometry-maker-studio-autosave-v1')??'null')
      ?.threeD?.settings?.standby?.cameraOrbitMode;}
    catch{return null;}
  })).toBe('inclined');
  await page.reload();
  await category(page,'アニメーション');
  await expect(page.getByRole('checkbox',{name:'待機中にカメラを自動回転'})).toBeChecked();
  await expect(page.locator('#three-standby-orbit-mode')).toHaveValue('inclined');
  await expect(page.locator('#three-standby-camera-tilt')).toHaveValue('20');
  expect(errors).toEqual([]);
});
