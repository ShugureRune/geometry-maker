// Development-only browser evidence, not a product export or deployment feature.
import { chromium } from '@playwright/test';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { generateScene } from '../src/scene.ts';

const output = resolve('docs/design-quality-v3');
const seeds = ['design-6', '未定義の心音', 'neon-city', 'undefined-heartbeat', '001', 'design-31'];
const ratios = ['16:9', '9:16', '1:1'];
const names = { central: '中央集中型', diagonal: '斜め流動型', corners: 'コーナー集中型', asymmetric: '非対称型', frame: 'フレーム型' };
const themes = ['dark', 'light'];
const urls = { before: process.env.BASELINE_URL || 'https://shugurerune.github.io/geometry-maker/', after: process.env.PREVIEW_URL || 'http://127.0.0.1:5173/' };
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const entries = [];
await mkdir(output, { recursive: true });
if (process.env.SHEETS_ONLY === '1') entries.push(...JSON.parse(await readFile(resolve(output, 'manifest.json'), 'utf8')).images);
try {
  const page = await browser.newPage({ viewport: { width: 1600, height: 1100 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  if (process.env.SHEETS_ONLY !== '1') for (const version of ['before', 'after']) {
    await page.goto(urls[version]);
    const art = page.getByTestId('preview');
    await art.waitFor();
    const expected = version === 'before' ? '2d-v2' : '2d-v3';
    if (await art.getAttribute('data-algorithm') !== expected) throw new Error(`Expected ${expected} at ${urls[version]}`);
    for (const theme of themes) {
      await page.getByRole('button', { name: theme === 'dark' ? 'グラデーション' : '単色', exact: true }).click();
      if (theme === 'light') await page.getByLabel('背景色', { exact: true }).fill('#faf8ff');
      for (const [i, seed] of seeds.entries()) {
        await page.getByLabel('シード値', { exact: true }).fill(seed);
        for (const ratio of ratios) {
          await page.getByLabel('キャンバスの比率').selectOption(ratio);
          const scene = generateScene(seed, ratio);
          const name = `${version}-${theme}-${i}-${ratio.replace(':', 'x')}.png`;
          await art.screenshot({ path: resolve(output, name) });
          const metrics = await art.evaluate(async (element, quiet) => {
            const { width, height } = element.viewBox.baseVal;
            const render = async geometry => {
              const clone = element.cloneNode(true);
              clone.setAttribute('width', width); clone.setAttribute('height', height);
              if (!geometry) clone.querySelector('[data-testid="shapes"]').remove();
              const url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(clone)], { type: 'image/svg+xml' }));
              try {
                const image = new Image(); image.src = url; await image.decode();
                const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
                const context = canvas.getContext('2d'); context.drawImage(image, 0, 0);
                return context.getImageData(0, 0, width, height).data;
              } finally { URL.revokeObjectURL(url); }
            };
            const full = await render(true), empty = await render(false);
            let total = 0, ink = 0, quietTotal = 0, quietInk = 0;
            for (let y = 0; y < height; y += 3) for (let x = 0; x < width; x += 3) {
              const offset = (y * width + x) * 4;
              const changed = Math.max(...[0, 1, 2].map(c => Math.abs(full[offset + c] - empty[offset + c]))) >= 8;
              total++; if (changed) ink++;
              if (x > quiet.x && x < quiet.x + quiet.width && y > quiet.y && y < quiet.y + quiet.height) {
                quietTotal++; if (changed) quietInk++;
              }
            }
            return { inkPercent: Math.round(ink / total * 10000) / 100,
              quietInkPercent: Math.round(quietInk / quietTotal * 10000) / 100 };
          }, scene.composition.quiet);
          const shapes = page.getByTestId('shapes');
          const count = await shapes.locator(':scope > g').count();
          const glowCount = await shapes.locator(':scope > g > g[filter]').count();
          if (version === 'after') {
            if (metrics.quietInkPercent > 0.2) throw new Error(`Quiet area filled: ${seed} ${ratio} ${theme}: ${metrics.quietInkPercent}`);
            const heroes = await shapes.locator(':scope > [data-role="hero"]').count();
            if (heroes < 1 || heroes > 2 || glowCount > 2) throw new Error('Visual hierarchy regression');
            if (theme === 'light' && glowCount) throw new Error('Unexpected glow on light background');
          }
          entries.push({ version, theme, seed, ratio, name, type: version === 'after' ? scene.composition.type : null, count, glowCount, ...metrics, quiet: scene.composition.quiet });
        }
      }
    }
  }
  if (errors.length) throw new Error(errors.join('\n'));
  const css = `*{box-sizing:border-box}body{margin:0;background:#10131d;color:#e9e5ff;font-family:system-ui,sans-serif;padding:28px}h1{font-size:24px;margin:0 0 10px}p{font-size:13px;color:#b6b3ca;line-height:1.7}.grid{display:grid;grid-template-columns:1fr 1fr;gap:16px}.cell{padding:12px;background:#191e2b;border:1px solid #343b4c;border-radius:8px}img{display:block;width:100%;height:auto}h2{font-size:12px;margin:0 0 10px}h3{margin:28px 0 12px;font-size:18px}.portrait img{max-height:480px;width:auto;max-width:100%;margin:auto}@media(max-width:600px){.grid{grid-template-columns:1fr}body{padding:12px}}`;
  const heading = `<h1>幾何学メーカー / デザイン品質比較</h1><p>左：公開中の2d-v2 / 右：開発候補2d-v3。同じシード・比率・背景設定。1〜2個の主役、構図の違い、奥行き、自然な余白を比較。</p>`;
  async function cards(theme, ratio, inline = false) {
    let html = '';
    for (const seed of seeds) for (const version of ['before', 'after']) {
      const entry = entries.find(e => e.version === version && e.theme === theme && e.ratio === ratio && e.seed === seed);
      const src = inline ? `data:image/png;base64,${(await readFile(resolve(output, entry.name))).toString('base64')}` : entry.name;
      html += `<section class="cell"><h2>${version === 'before' ? 'BEFORE · 2d-v2' : `AFTER · 2d-v3 / ${names[entry.type]}`} / ${seed}</h2><img src="${src}" alt="${seed} ${ratio} ${version}"></section>`;
    }
    return html;
  }
  let gallery = '';
  for (const theme of themes) for (const ratio of ratios) gallery += `<h3>${theme === 'dark' ? '暗いグラデーション' : '明るい単色'} / ${ratio}</h3><div class="grid ${ratio === '9:16' ? 'portrait' : ''}">${await cards(theme, ratio)}</div>`;
  await writeFile(resolve(output, 'index.html'), `<!doctype html><html lang="ja"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>デザイン品質比較 v2 / v3</title><style>${css}</style>${heading}${gallery}</html>`);
  async function sheet(html, name) {
    const sheetPage = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    try {
      await sheetPage.setContent(`<!doctype html><html lang="ja"><meta charset="utf-8"><style>${css}</style><body>${html}</body></html>`);
      await sheetPage.locator('img').evaluateAll(images => Promise.all(images.map(image => image.decode())));
      await sheetPage.evaluate(() => document.fonts.ready);
      await sheetPage.screenshot({ path: resolve(output, name), fullPage: true, animations: 'disabled' });
    } finally { await sheetPage.close(); }
  }
  for (const theme of themes) {
    await sheet(`${heading}<h3>${theme === 'dark' ? '暗い背景' : '明るい背景'} / 16:9</h3><div class="grid">${await cards(theme, '16:9', true)}</div>`, `comparison-${theme}.png`);
    let overview = '';
    for (const seed of seeds) for (const ratio of ratios) {
      const entry = entries.find(e => e.version === 'after' && e.theme === theme && e.seed === seed && e.ratio === ratio);
      const source = `data:image/png;base64,${(await readFile(resolve(output, entry.name))).toString('base64')}`;
      overview += `<section class="cell"><h2>${seed} / ${names[entry.type]} / ${ratio}</h2><img src="${source}"></section>`;
    }
    await sheet(`<style>.grid{grid-template-columns:repeat(3,1fr)}img{height:340px;object-fit:contain}</style><h1>新版2d-v3 / 6シード × 全3比率 / ${theme}</h1><div class="grid">${overview}</div>`, `overview-${theme}.png`);
  }
  await writeFile(resolve(output, 'manifest.json'), JSON.stringify({
    baselineCommit: '407e5814625dfe1cb666dfe2c69a5207ad6cc1c4', beforeVersion: '2d-v2', afterVersion: '2d-v3', seeds, ratios,
    themes: { dark: { mode: 'gradient', colors: ['#101b2d', '#241938', '#102a30'], angle: 135 }, light: { mode: 'solid', color: '#faf8ff' } },
    images: entries,
  }, null, 2) + '\n');
  console.log(`Captured ${entries.length} previews, 2 comparison sheets, 2 aspect-ratio overviews, and gallery.`);
  console.log(JSON.stringify(entries.filter(e => e.version === 'after').map(({seed,theme,ratio,type,count,glowCount,quietInkPercent})=>({seed,theme,ratio,type,count,glowCount,quietInkPercent}))));
} finally { await browser.close(); }
