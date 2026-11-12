import {test,expect,type Page} from '@playwright/test';
import {readFile} from 'node:fs/promises';

test.setTimeout(180_000);
async function category(page:Page,label:string){
  const button=page.getByRole('navigation',{name:'設定カテゴリー'}).getByRole('button',{name:label,exact:true});
  if(await button.getAttribute('aria-expanded')!=='true')await button.click();
}
async function magic(page:Page,reducedMotion:'reduce'|'no-preference'='reduce'){
  await page.emulateMedia({reducedMotion});
  await page.goto('./');
  await page.getByLabel('生成アルゴリズム').selectOption('2d-magic-v1');
  await expect(page.getByTestId('magic-controls')).toBeVisible();
  await expect(page.getByTestId('preview')).toHaveAttribute('data-algorithm','2d-magic-v1');
}
async function exportFile(page:Page,label:string){
  const download=page.waitForEvent('download');
  await page.getByRole('button',{name:label,exact:true}).click();
  return readFile(await (await download).path() as string);
}
test('style, ring count, symmetry, rune families and preview alpha all respond',async({page})=>{
  await magic(page);
  const preview=page.getByTestId('preview');
  const initial=await preview.locator('[data-shape-id]').count();
  await page.getByLabel('魔法陣のスタイル').selectOption('geometric');
  await expect(preview.locator('[data-shape-id="poly-main"]')).toHaveCount(1);
  await page.getByLabel('魔法陣のスタイル').selectOption('crest');
  await expect(preview.locator('[data-shape-id="petal-0"]')).toHaveCount(1);
  await page.getByLabel('魔法陣のスタイル').selectOption('star');
  await page.getByLabel('同心円の数').fill('8');
  await page.getByLabel('対称数').fill('12');
  await page.locator('#magic-complexity').fill('100');
  await page.locator('#magic-ornaments').fill('100');
  await page.getByLabel('円環の装飾').selectOption('dots');
  await expect(preview.locator('[data-shape-id^="stamp-dot"]')).not.toHaveCount(0);
  expect(await preview.locator('[data-shape-id]').count()).toBeGreaterThan(initial);
  await page.getByLabel('背景なしでプレビュー').check();
  await expect(preview).toHaveAttribute('data-transparent','true');
  await expect(preview.locator('[data-testid="background"]')).toHaveCount(0);
});
test('transparent PNG preserves zero-alpha padding and visible spell strokes',async({page})=>{
  await magic(page);
  await page.getByLabel('魔法陣だけを透過PNG / SVGで書き出す').check();
  await category(page,'書き出し');
  await page.getByLabel('幅 (px)',{exact:true}).fill('600');
  await page.getByLabel('高さ (px)',{exact:true}).fill('600');
  const buf=await exportFile(page,'PNGを書き出す');
  expect(buf.subarray(1,4).toString()).toBe('PNG');
  const result=await page.evaluate(async(base64)=>{
    const image=new Image(); image.src='data:image/png;base64,'+base64;await image.decode();
    const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;
    const ctx=canvas.getContext('2d')!;ctx.drawImage(image,0,0);
    const pixels=ctx.getImageData(0,0,image.width,image.height).data;
    let visible=0;
    for(let i=3;i<pixels.length;i+=4)if(pixels[i]>40)visible++;
    return {width:image.width,height:image.height,corner:pixels[3],visible};
  },buf.toString('base64'));
  expect(result).toMatchObject({width:600,height:600,corner:0});
  expect(result.visible).toBeGreaterThan(250);
  const svg=(await exportFile(page,'SVGを書き出す')).toString('utf8');
  expect(svg).toContain('data-algorithm="2d-magic-v1"');
  expect(svg).not.toMatch(/<rect\b[^>]*data-testid="background"/);
  expect(svg).not.toMatch(/<rect\b[^>]*width="600"[^>]*fill=/);
  expect(svg).toContain('data-shape-id="ward-outer"');
});
test('magic colors are independent of ordinary 2D; reroll, preset and custom work',async({page})=>{
  await magic(page);
  await category(page,'カラー');
  await expect(page.getByTestId('magic-colors')).toBeVisible();
  const first=await page.getByTestId('magic-auto-palette').textContent();
  const strokeBefore=await page.getByTestId('preview').locator('[data-shape-id="ward-outer"]').getAttribute('stroke');
  await page.getByRole('button',{name:'魔法の色を再抽選'}).click();
  expect(await page.getByTestId('magic-auto-palette').textContent()).not.toBe(first);
  expect(await page.getByTestId('preview').locator('[data-shape-id="ward-outer"]').getAttribute('stroke')).not.toBe(strokeBefore);
  await page.getByLabel('魔法陣の配色モード').selectOption('preset');
  await page.getByLabel('魔法陣パレット',{exact:true}).selectOption('golden-sigil');
  await expect(page.getByTestId('preview').locator('[data-shape-id="ward-outer"]')).toHaveAttribute('stroke','#fff4cf');
  await page.getByLabel('魔法陣の配色モード').selectOption('custom');
  await page.getByLabel('魔法陣主線').fill('#ff00ff');
  await expect(page.getByTestId('preview').locator('[data-shape-id="ward-outer"]')).toHaveAttribute('stroke','#ff00ff');
  await category(page,'図形');
  await page.getByLabel('生成アルゴリズム').selectOption('2d-v5');
  await category(page,'カラー');
  await expect(page.getByLabel('主役色 HEX')).not.toHaveValue('#ff00ff');
  await expect(page.getByTestId('magic-colors')).toHaveCount(0);
});

test('magic rings keep turning after growth finishes, independent of summon playback',async({page})=>{
  await magic(page,'no-preference');
  const ring=page.getByTestId('preview').locator('[data-shape-id="tick-0"]');
  const first=await ring.getAttribute('transform');
  await expect.poll(()=>ring.getAttribute('transform'),{timeout:4000}).not.toBe(first);
  await page.waitForTimeout(6400);
  await expect(page.getByTestId('playback-position')).toContainText('100%');
  const afterFinish=await ring.getAttribute('transform');
  await expect.poll(()=>ring.getAttribute('transform'),{timeout:4000}).not.toBe(afterFinish);
  await category(page,'アニメーション');
  await page.getByLabel('アニメーションを有効化').uncheck();
  const disabledGrowth=await ring.getAttribute('transform');
  await expect.poll(()=>ring.getAttribute('transform'),{timeout:4000}).not.toBe(disabledGrowth);
  await category(page,'図形');
  await page.getByLabel('円環の回転速度').fill('0');
  await expect(ring).toHaveAttribute('transform',/translate/);
});

test('background-on PNG, safe JSON roundtrip and v4/v5 selection',async({page})=>{
  await magic(page);
  await page.getByLabel('魔法陣のスタイル').selectOption('crest');
  await page.getByLabel('同心円の数').fill('7');
  await page.getByLabel('魔法陣だけを透過PNG / SVGで書き出す').check();
  await category(page,'書き出し');
  const json=await exportFile(page,'作品の設定を保存');
  const settings=JSON.parse(json.toString('utf8'));
  expect(settings.algorithmVersion).toBe('2d-magic-v1');
  expect(settings.magicCircle.style).toBe('crest');
  expect(settings.magicCircle.ringCount).toBe(7);
  expect(settings.magicCircle.transparentExport).toBe(true);
  await category(page,'図形');
  await page.getByLabel('生成アルゴリズム').selectOption('2d-v4');
  await expect(page.getByTestId('preview')).toHaveAttribute('data-algorithm','2d-v4');
  await page.getByLabel('生成アルゴリズム').selectOption('2d-v5');
  await expect(page.getByTestId('preview')).toHaveAttribute('data-algorithm','2d-v5');
  await category(page,'書き出し');
  await page.locator('input[aria-label="保存した設定ファイル"]').setInputFiles({name:'magic.json',mimeType:'application/json',buffer:json});
  await expect(page.getByTestId('preview')).toHaveAttribute('data-algorithm','2d-magic-v1');
  await category(page,'図形');
  await expect(page.getByLabel('魔法陣のスタイル')).toHaveValue('crest');
  await expect(page.getByLabel('同心円の数')).toHaveValue('7');
  await expect(page.getByLabel('魔法陣だけを透過PNG / SVGで書き出す')).toBeChecked();
});

test('infinite generator changes the actual seed-derived geometry and keeps classic untouched',async({page})=>{
  await magic(page);
  const preview=page.getByTestId('preview');
  await page.getByLabel('魔法陣の生成方式').selectOption('infinite');
  await expect(page.getByTestId('magic-infinite-controls')).toBeVisible();
  await expect(preview.locator('[data-shape-id^="infinite-core"]')).not.toHaveCount(0);
  await page.getByLabel('構造のランダム度').fill('100');
  const first=await page.getByTestId('shapes').innerHTML();
  await page.getByRole('button',{name:'同じシードから別の魔法陣を生成'}).click();
  await expect(page.getByTestId('magic-variation')).toContainText('派生番号：1');
  const changed=await page.getByTestId('shapes').innerHTML();
  expect(changed).not.toEqual(first);
  await expect(page.getByTestId('magic-blueprint-summary')).toContainText('設計図');
  await page.getByLabel('レアな特殊紋様を生成する').uncheck();
  await page.getByLabel('魔法陣の生成方式').selectOption('classic');
  await expect(preview.locator('[data-shape-id="ward-outer"]')).toHaveCount(1);
  await expect(preview.locator('[data-shape-id^="infinite-core"]')).toHaveCount(0);
  await page.getByLabel('魔法陣の生成方式').selectOption('infinite');
  await expect(preview.locator('[data-shape-id^="infinite-core"]')).not.toHaveCount(0);
});
test('infinite mode JSON restores seed variations and alpha SVG export',async({page})=>{
  await magic(page);
  await page.getByLabel('魔法陣の生成方式').selectOption('infinite');
  await page.getByLabel('構造のランダム度').fill('90');
  await page.getByRole('button',{name:'同じシードから別の魔法陣を生成'}).click();
  await page.getByRole('button',{name:'同じシードから別の魔法陣を生成'}).click();
  await page.getByLabel('魔法陣だけを透過PNG / SVGで書き出す').check();
  const blueprint=await page.getByTestId('shapes').innerHTML();
  await category(page,'書き出し');
  const saved=await exportFile(page,'作品の設定を保存');
  const json=JSON.parse(saved.toString('utf8'));
  expect(json.magicCircle).toMatchObject({generationMode:'infinite',variation:2,chaos:90,rareEffects:true,transparentExport:true});
  const svg=(await exportFile(page,'SVGを書き出す')).toString('utf8');
  expect(svg).toContain('data-shape-id="infinite-outer"');
  expect(svg).not.toContain('data-testid="background"');
  await category(page,'図形');
  await page.getByLabel('魔法陣の生成方式').selectOption('classic');
  await category(page,'書き出し');
  await page.locator('input[aria-label="保存した設定ファイル"]').setInputFiles({
    name:'infinite.json',mimeType:'application/json',buffer:saved
  });
  await category(page,'図形');
  await expect(page.getByLabel('魔法陣の生成方式')).toHaveValue('infinite');
  await expect(page.getByTestId('magic-variation')).toContainText('派生番号：2');
  // Scene state and the playback clock settle on separate React renders after importing JSON.
  await expect.poll(()=>page.getByTestId('shapes').innerHTML(),{timeout:7000}).toBe(blueprint);
});
