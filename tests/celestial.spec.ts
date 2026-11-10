import {test, expect, type Page} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';

test.setTimeout(90_000);
async function category(page: Page, name: string) {
  const button = page.getByRole('navigation', {name: '設定カテゴリー'}).getByRole('button', {name, exact: true});
  if (await button.getAttribute('aria-expanded') !== 'true') await button.click();
}
async function start(page: Page) {
  await page.emulateMedia({reducedMotion: 'reduce'});
  await page.goto('./');
  await page.getByRole('button', {name: '3Dモード', exact: true}).click();
  await expect(page.getByTestId('three-preview').locator('canvas')).toBeVisible();
  await category(page, '図形');
}
async function png(page: Page) {
  await category(page, '書き出し');
  await page.getByLabel('3D 幅 (px)').fill('512');
  await page.getByLabel('3D 高さ (px)').fill('512');
  const waiting = page.waitForEvent('download');
  await page.getByRole('button', {name: '3D PNGを書き出す', exact: true}).click();
  const download = await waiting;
  expect(await download.failure()).toBeNull();
  return readFile((await download.path())!);
}
const hash = (data: Buffer) => createHash('sha256').update(data).digest('hex');

test('celestial-only preset draws six bodies, updates PNG and keeps the original solids intact', async ({page}) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await start(page);
  const preview = page.getByTestId('three-preview');
  await expect(preview).toHaveAttribute('data-celestial-count', '0');
  const original = await png(page);
  await category(page, '図形');
  await page.getByRole('button', {name: '天体のみ表示'}).click();
  await expect(preview).toHaveAttribute('data-object-count', '0');
  await expect(preview).toHaveAttribute('data-celestial-count', '6');
  const withStars = await png(page);
  expect(hash(withStars)).not.toBe(hash(original));
  await category(page, '図形');
  await page.getByLabel('ブラックホールを生成').uncheck();
  await expect(preview).toHaveAttribute('data-celestial-count', '5');
  expect(hash(await png(page))).not.toBe(hash(withStars));
  await category(page, '図形');
  await page.getByRole('button', {name: '図形＋天体'}).click();
  expect(Number(await preview.getAttribute('data-object-count'))).toBeGreaterThan(0);
  await expect(preview).toHaveAttribute('data-celestial-count', '6');
  await page.getByRole('button', {name: '2Dモード', exact: true}).click();
  await expect(page.getByTestId('preview')).toBeVisible();
  expect(errors).toEqual([]);
});

test('celestial settings are saved, restored and render identically while paused', async ({page}) => {
  await start(page);
  await page.getByRole('button', {name: '天体のみ表示'}).click();
  await category(page, 'アニメーション');
  await page.getByLabel('3Dアニメーションを有効化').uncheck();
  const before = await png(page);
  expect(hash(await png(page))).toBe(hash(before));
  const waiting = page.waitForEvent('download');
  await page.getByRole('button', {name: '3D設定JSONを保存'}).click();
  const download = await waiting;
  const bytes = await readFile((await download.path())!);
  const saved = JSON.parse(bytes.toString());
  expect(saved.settings.celestial.enabled).toBe(true);
  expect(saved.settings.celestial.kinds).toHaveLength(6);
  await category(page, '図形');
  await page.getByLabel('3D天体を表示').uncheck();
  await expect(page.getByTestId('three-preview')).toHaveAttribute('data-celestial-count', '0');
  await category(page, '書き出し');
  await page.getByLabel('3D設定JSONファイル').setInputFiles({name: 'celestial.json', mimeType: 'application/json', buffer: bytes});
  await expect(page.getByTestId('three-preview')).toHaveAttribute('data-celestial-count', '6');
  expect(hash(await png(page))).toBe(hash(before));
});
