// Development-only comparison capture. Does not deploy or add an export feature.
import { chromium } from '@playwright/test';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const output = resolve('docs/composition');
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const seeds = ['undefined-heartbeat', 'neon-city', 'aurora-42', '未定義の心音'];
const ratios = ['16:9', '9:16', '1:1'];
const entries = [];
try {
  const page = await browser.newPage({ viewport: { width: 1600, height: 1100 }, deviceScaleFactor: 1 });
  for (const [version, url] of [
    ['before', process.env.BASELINE_URL || 'https://shugurerune.github.io/geometry-maker/'],
    ['after', process.env.PREVIEW_URL || 'http://127.0.0.1:5173/'],
  ]) {
    await page.goto(url);
    const art = page.getByTestId('preview');
    await art.waitFor();
    const expected = version === 'before' ? '2d-v1' : '2d-v2';
    if (await art.getAttribute('data-algorithm') !== expected) throw new Error(`Expected ${expected} at ${url}`);
    for (let i = 0; i < seeds.length; i++) {
      await page.getByLabel('シード値', { exact: true }).fill(seeds[i]);
      for (const ratio of ratios) {
        await page.getByLabel('キャンバスの比率').selectOption(ratio);
        const name = `${version}-${i}-${ratio.replace(':', 'x')}.png`;
        await art.screenshot({ path: resolve(output, name) });
        const centralInkPercent = await art.evaluate(async element => {
          const original = element;
          const { width, height } = original.viewBox.baseVal;
          const render = async (geometry) => {
            const clone = original.cloneNode(true);
            clone.setAttribute('width', String(width));
            clone.setAttribute('height', String(height));
            if (!geometry) clone.querySelector('[data-testid="shapes"]').remove();
            const url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(clone)], { type: 'image/svg+xml' }));
            try {
              const image = new Image(); image.src = url; await image.decode();
              const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
              const context = canvas.getContext('2d'); context.drawImage(image, 0, 0);
              return context.getImageData(0, 0, width, height).data;
            } finally { URL.revokeObjectURL(url); }
          };
          const ink = await render(true), background = await render(false);
          let total = 0, changed = 0;
          for (let y = Math.ceil(height * 0.35); y < height * 0.65; y += 2) {
            for (let x = Math.ceil(width * 0.35); x < width * 0.65; x += 2) {
              const offset = (y * width + x) * 4;
              total++;
              if (Math.max(...[0, 1, 2].map(c => Math.abs(ink[offset + c] - background[offset + c]))) >= 8) changed++;
            }
          }
          return Math.round(changed / total * 10000) / 100;
        });
        if (version === 'after' && centralInkPercent > 0.1) throw new Error(`Central clear-space regression: ${seeds[i]} ${ratio} ${centralInkPercent}%`);
        entries.push({ version, seed: seeds[i], ratio, name, centralInkPercent });
      }
    }
  }
  const style = `body{margin:0;background:#10131d;color:#e9e5ff;font-family:system-ui,sans-serif;padding:32px}h1{font-size:25px;margin:0 0 8px}p{font-size:13px;color:#b5b3c9}.grid{display:grid;grid-template-columns:1fr 1fr;gap:18px}.cell{background:#171c29;padding:14px;border:1px solid #343b4c;border-radius:8px}img{display:block;width:100%;height:auto}h2{font-size:13px;margin:0 0 12px}code{color:#b8a7ff}h3{margin:28px 0 12px;font-size:16px}a{color:#cbbaff}`;
  const image = async (entry, inline) => inline ? `data:image/png;base64,${(await readFile(resolve(output, entry.name))).toString('base64')}` : entry.name;
  async function cards(ratio, inline) {
    let html = '';
    for (const seed of seeds) for (const version of ['before', 'after']) {
      const entry = entries.find(e => e.seed === seed && e.ratio === ratio && e.version === version);
      html += `<section class="cell"><h2>${version === 'before' ? 'BEFORE · 2d-v1' : 'AFTER · 2d-v2'} / ${seed}</h2><img src="${await image(entry, inline)}" alt="${version} ${seed} ${ratio}"></section>`;
    }
    return html;
  }
  const head = `<h1>幾何学メーカー / 構図比較</h1><p>同じシード・背景設定。左：公開mainの2d-v1 / 右：開発ブランチの2d-v2。主役・補助・装飾と中央の余白を比較。</p>`;
  let gallery = '';
  for (const ratio of ratios) gallery += `<h3>${ratio}</h3><div class="grid">${await cards(ratio, false)}</div>`;
  await writeFile(resolve(output, 'index.html'), `<!doctype html><html lang="ja"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>構図比較 · 2d-v1 / 2d-v2</title><style>${style}</style>${head}${gallery}</html>`);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.setContent(`<style>${style}</style>${head}<div class="grid">${await cards('16:9', true)}</div>`);
  await page.locator('img').evaluateAll(images => Promise.all(images.map(image => image.decode())));
  await page.screenshot({ path: resolve(output, 'comparison-landscape.png'), fullPage: true });
  await writeFile(resolve(output, 'manifest.json'), JSON.stringify({
    baseline: '196b1779db3eec5227dffc3b1681fa87bca347ef',
    beforeVersion: '2d-v1', afterVersion: '2d-v2', seeds, ratios,
    background: { mode: 'gradient', colors: ['#101b2d', '#241938', '#102a30'], angle: 135 },
    images: entries,
  }, null, 2) + '\n');
  console.log(`Captured ${entries.length} artwork images and landscape comparison to ${output}`);
  console.log(entries.map(({version, seed, ratio, centralInkPercent}) => ({version, seed, ratio, centralInkPercent})));
} finally { await browser.close(); }
