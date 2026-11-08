import { test, expect, type Locator } from '@playwright/test';
import { createHash } from 'node:crypto';
import { RATIOS } from '../src/scene';

// React can insert identical SVG attributes in different orders when recycling
// nodes between shape kinds. Compare geometry, not attribute insertion order or
// React's per-instance gradient/filter IDs. Rendered pixels are checked below.
async function geometryHash(shapes: Locator) {
  const geometry = await shapes.evaluate(element => {
    function record(node: Element): unknown {
      const attributes = [...node.attributes].map(a => [a.name,
        a.value.replace(/url\(#.*?-(hero-\d+|glow)\)/g, 'url(#$1)')]).sort((a, b) => a[0].localeCompare(b[0]));
      return [node.tagName, attributes, [...node.children].map(record)];
    }
    return JSON.stringify(record(element));
  });
  return createHash('sha256').update(geometry).digest('hex');
}

// Rasterize at native scene coordinates: page scrolling and fractional CSS
// positioning must not affect an artwork's pixel comparison.
async function renderedHash(svg: Locator) {
  const pixels = await svg.evaluate(async element => {
    const source = element as SVGSVGElement;
    const clone = source.cloneNode(true) as SVGSVGElement;
    const { width, height } = source.viewBox.baseVal;
    clone.setAttribute('width', String(width));
    clone.setAttribute('height', String(height));
    const url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(clone)], { type: 'image/svg+xml' }));
    try {
      const image = new Image();
      image.src = url;
      await image.decode();
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      canvas.getContext('2d')!.drawImage(image, 0, 0);
      return canvas.toDataURL();
    } finally { URL.revokeObjectURL(url); }
  });
  return createHash('sha256').update(pixels).digest('hex');
}

test('all stage-one controls and deterministic browser rendering', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('./');
  const svg = page.getByTestId('preview');
  const shapes = page.getByTestId('shapes');
  const seed = page.getByLabel('シード値', { exact: true });
  await expect(svg).toBeVisible();
  await expect(shapes.locator(':scope > g')).toHaveCount(76);
  await expect(shapes.locator(':scope > [data-layer="hero"]')).toHaveCount(5);
  await expect(shapes.locator(':scope > [data-layer="support"]')).toHaveCount(27);
  await expect(shapes.locator(':scope > [data-layer="decoration"]')).toHaveCount(44);
  await seed.fill('心音🌱-001');
  await expect(page.getByTestId('current-seed')).toHaveText('心音🌱-001');
  const reference = await geometryHash(shapes);
  const pixels = await renderedHash(svg);
  await page.getByRole('button', { name: '同じ設定で再生成' }).click();
  await expect(page.getByRole('status').filter({ hasText: '再生成しました' })).toBeVisible();
  expect(await geometryHash(shapes)).toBe(reference);
  expect(await renderedHash(svg)).toBe(pixels);

  await page.getByRole('button', { name: 'ランダムシードを生成' }).click();
  expect(await seed.inputValue()).toMatch(/^[0-9a-f]{24}$/);
  expect(await geometryHash(shapes)).not.toBe(reference);
  const randomSeed = await seed.inputValue();
  await page.getByRole('button', { name: 'ランダムシードを生成' }).click();
  expect(await seed.inputValue()).not.toBe(randomSeed);
  await seed.fill('心音🌱-001');
  expect(await geometryHash(shapes)).toBe(reference);
  expect(await renderedHash(svg)).toBe(pixels);

  await page.getByRole('button', { name: '単色', exact: true }).click();
  await expect(svg.getByTestId('background-gradient')).toHaveCount(0);
  await page.getByLabel('背景色', { exact: true }).fill('#326495');
  await expect(page.getByTestId('background')).toHaveAttribute('fill', '#326495');
  expect(await geometryHash(shapes)).toBe(reference);
  await page.getByRole('button', { name: 'グラデーション', exact: true }).click();
  for (let i = 1; i <= 3; i++) {
    const color = ['#112233', '#334455', '#556677'][i - 1];
    await page.getByLabel(`グラデーション色${i}`).fill(color);
    await expect(svg.locator('stop').nth(i - 1)).toHaveAttribute('stop-color', color);
  }
  await page.getByLabel('方向').fill('270');
  await expect(svg.getByTestId('background-gradient')).toHaveAttribute('y1', '100%');
  expect(await geometryHash(shapes)).toBe(reference);
  const configuredPixels = await renderedHash(svg);
  for (const [ratio, [w, h]] of Object.entries(RATIOS)) {
    await page.getByLabel('キャンバスの比率').selectOption(ratio);
    await expect(svg).toHaveAttribute('viewBox', `0 0 ${w} ${h}`);
    const bounds = await svg.boundingBox();
    expect(bounds!.width / bounds!.height).toBeCloseTo(w / h, 2);
  }
  await page.getByLabel('キャンバスの比率').selectOption('16:9');
  expect(await renderedHash(svg)).toBe(configuredPixels);
  await page.reload();
  await seed.fill('心音🌱-001');
  expect(await geometryHash(shapes)).toBe(reference);
  expect(await renderedHash(svg)).toBe(pixels);
  await seed.fill('');
  await expect(page.getByTestId('current-seed')).toHaveText('（空文字）');
  const emptyScene = await geometryHash(shapes);
  await seed.fill('other');
  await seed.fill('');
  expect(await geometryHash(shapes)).toBe(emptyScene);
  expect(errors).toEqual([]);
});

test('desktop and narrow layouts remain usable with portrait previews', async ({ page }) => {
  await page.goto('./');
  for (const width of [1440, 1024, 390]) {
    await page.setViewportSize({ width, height: 900 });
    for (const ratio of ['16:9', '9:16']) {
      await page.getByLabel('キャンバスの比率').selectOption(ratio);
      await expect(page.getByTestId('preview')).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      const bounds = await page.getByTestId('preview').boundingBox();
      expect(bounds!.width).toBeGreaterThan(100);
      expect(bounds!.x).toBeGreaterThanOrEqual(0);
      expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width + 1);
    }
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByLabel('キャンバスの比率').selectOption('16:9');
  await page.screenshot({ path: 'test-results/desktop.png', fullPage: true });
});
