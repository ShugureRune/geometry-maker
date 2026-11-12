import {test,expect,type Page} from '@playwright/test';

test.setTimeout(110_000);

async function category(page:Page,label:string){
  const item=page.getByRole('navigation',{name:'設定カテゴリー'})
    .getByRole('button',{name:label,exact:true});
  if(await item.getAttribute('aria-expanded')!=='true')await item.click();
}

for(const style of ['grid','circuit'] as const){
  test(`moving ${style} floor keeps its animation phase across morph and exit-enter seed changes`,
    async({page})=>{
      const errors:string[]=[];
      page.on('pageerror',e=>errors.push(e.message));
      await page.goto('./');
      await page.getByRole('button',{name:'3Dモード',exact:true}).click();
      await category(page,'図形');
      await page.getByLabel('3D描画品質').selectOption('low');
      const preview=page.getByTestId('three-preview');
      await expect(preview.locator('canvas')).toBeVisible();
      await category(page,'背景');
      await page.getByLabel('3D床グリッドを有効化').check();
      await page.locator('#floor-grid-style').selectOption(style);
      await page.locator('#floor-grid-scroll').fill('1');
      if(style==='circuit'){
        await page.getByLabel('中央演算コア・立体ICチップを表示').check();
        await page.locator('#floor-circuit-speed').fill('2');
      }
      await category(page,'アニメーション');
      await page.getByLabel('3D待機画面モードを有効化').check();
      const mode=page.locator('#three-standby-mode');
      const length=page.locator('#three-standby-transition');
      await length.fill('1');
      const floorTime=async()=>Number(await preview.getAttribute('data-floor-time'));
      const floorOffset=async()=>Number(await preview.getAttribute('data-floor-offset'));
      await expect.poll(floorTime).toBeGreaterThan(0);
      for(const effect of ['morph','exit-enter'] as const){
        await mode.selectOption(effect);
        // Advance the floor long enough that resetting to 0 would be obvious.
        await page.waitForTimeout(900);
        const before=await floorTime();
        const beforeOffset=await floorOffset();
        expect(before).toBeGreaterThan(0.7);
        expect(Number.isFinite(beforeOffset)).toBe(true);
        const oldSeed=await page.getByTestId('current-seed').textContent();
        await page.getByRole('button',{name:'今すぐ次の3Dシードへ'}).click();
        await expect(preview).toHaveAttribute('data-standby-active','true');
        expect(await page.getByTestId('current-seed').textContent()).not.toBe(oldSeed);
        const after=await floorTime();
        const offset=await floorOffset();
        const sceneElapsed=Number(await preview.getAttribute('data-standby-elapsed'));
        expect(sceneElapsed).toBeLessThan(.9);
        // Figures rewind to start their morph. The grid/PCB must not rewind.
        expect(after).toBeGreaterThanOrEqual(before);
        expect(after-before).toBeLessThan(1.2);
        expect(Number.isFinite(offset)).toBe(true);
        // The moving floor phase is derived from the continuous clock.
        // Its modulo wrapping is seamless because the grid repeats each cell.
        expect(Math.abs(offset-((after*1)%2.5))).toBeLessThan(.002);
        await expect(preview).toHaveAttribute('data-standby-active','false',{timeout:12000});
        const complete=await floorTime();
        expect(complete).toBeGreaterThanOrEqual(after);
      }
      await page.getByRole('button',{name:'3Dを一時停止',exact:true}).click();
      const frozen=await floorTime();
      await page.waitForTimeout(450);
      expect(await floorTime()).toBeCloseTo(frozen,4);
      // After a morph, scene time and floor time differ. Both must be
      // persisted independently or refreshing the app would teleport the PCB.
      await expect.poll(async()=>page.evaluate(()=>{
        try{return JSON.parse(localStorage.getItem('geometry-maker-studio-autosave-v1')??'null')
          ?.threeD?.floorElapsedSeconds??-1;}
        catch{return -1;}
      })).toBeGreaterThan(frozen-.1);
      await page.reload();
      await expect(page.getByRole('button',{name:'3Dモード',exact:true}))
        .toHaveAttribute('aria-pressed','true');
      await expect(preview.locator('canvas')).toBeVisible();
      await expect.poll(floorTime).toBeGreaterThan(frozen-.1);
      expect(Math.abs((await floorTime())-frozen)).toBeLessThan(.11);
      expect(errors).toEqual([]);
    });
}
