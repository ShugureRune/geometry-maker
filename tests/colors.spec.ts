import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';
test('seed colors, independent rerolls, locks, HEX, JSON and exports',async({page})=>{
 await page.goto('./');await page.getByLabel('カラー変更モード').selectOption('seed');
 const color=(name:string)=>page.getByLabel(name,{exact:true});
 const positions=()=>page.getByTestId('shapes').locator(':scope>g').evaluateAll(nodes=>nodes.map(n=>n.getAttribute('transform')));
 const initial=await positions();const primary=await color('主役色').inputValue(),support=await color('補助色').inputValue(),bg=await color('グラデーション色1').inputValue();
 await page.getByRole('button',{name:'主役色をランダム変更',exact:true}).click();
 expect(await color('主役色').inputValue()).not.toBe(primary);expect(await color('補助色').inputValue()).toBe(support);expect(await color('グラデーション色1').inputValue()).toBe(bg);expect(await positions()).toEqual(initial);
 await page.getByRole('button',{name:'主役色を固定',exact:true}).click();
 await color('主役色 HEX').fill('#123456');
 await color('シード値').fill('new-seed');expect(await color('主役色').inputValue()).toBe('#123456');expect(await color('補助色').inputValue()).not.toBe(support);
 const locked=await color('主役色').inputValue();await page.getByRole('button',{name:'主役色をランダム変更',exact:true}).click();expect(await color('主役色').inputValue()).not.toBe(locked);await expect(page.getByRole('button',{name:'主役色を固定',exact:true})).toHaveAttribute('aria-pressed','true');
 const before=await color('グラデーション色2').inputValue();await page.getByRole('button',{name:'グラデーション色1をランダム変更',exact:true}).click();expect(await color('グラデーション色2').inputValue()).toBe(before);
 const save=page.waitForEvent('download');await page.getByRole('button',{name:'設定JSONを保存',exact:true}).click();const file=await save;const data=await readFile((await file.path())!);const settings=JSON.parse(data.toString());expect(settings.colorSettings.slots.primary.locked).toBe(true);expect(settings.colorSettings.slots.primary.reroll).toBe(2);
 await color('シード値').fill('changed');await page.getByLabel('設定JSONファイル').setInputFiles({name:'colors.json',mimeType:'application/json',buffer:data});await expect(color('シード値')).toHaveValue('new-seed');expect(await color('主役色').inputValue()).toBe(settings.colorSettings.slots.primary.color);
 const svgSave=page.waitForEvent('download');await page.getByRole('button',{name:'SVGを書き出す',exact:true}).click();const svg=await readFile((await (await svgSave).path())!);expect(svg.toString()).toContain(settings.colorSettings.slots.primary.color);
 const pngSave=page.waitForEvent('download');await page.getByRole('button',{name:'PNGを書き出す',exact:true}).click();expect(await (await pngSave).failure()).toBeNull();
});
test.describe('mobile color controls',()=>{
 test.use({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
 test('locks and rerolls a single slot with touch',async({page})=>{
  await page.goto('./');await page.getByLabel('カラー変更モード').selectOption('seed');
  const lock=page.getByRole('button',{name:'アクセント色を固定',exact:true});await lock.tap();await expect(lock).toHaveAttribute('aria-pressed','true');
  const input=page.getByLabel('アクセント色',{exact:true});const before=await input.inputValue();
  await page.getByRole('button',{name:'アクセント色をランダム変更',exact:true}).tap();expect(await input.inputValue()).not.toBe(before);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 });
});
