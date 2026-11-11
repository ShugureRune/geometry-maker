import {test,expect} from '@playwright/test';
import {readFile,mkdir} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';

test.setTimeout(150_000);

test('3D WebM exports a playable, animated frame-exact video and restores live preview',async({page})=>{
  const errors:string[]=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto('./');
  await page.getByRole('button',{name:'3Dモード',exact:true}).click();
  await expect(page.getByTestId('three-preview').locator('canvas')).toBeVisible();
  await page.getByRole('navigation',{name:'設定カテゴリー'})
    .getByRole('button',{name:'書き出し',exact:true}).click();
  await page.locator('.three-video-panel > summary').click();
  await page.getByLabel('動画の形式').selectOption('webm');
  await page.getByLabel('動画の幅 (px)').fill('256');
  await page.getByLabel('動画の高さ (px)').fill('256');
  await page.getByLabel('動画のなめらかさ').selectOption('24');
  await page.getByLabel('動画の長さ').fill('1');
  const start=page.getByRole('button',{name:'3D動画を保存',exact:true});
  await expect(start).toBeEnabled({timeout:30_000});
  await expect(page.locator('.three-video-stats')).toHaveText('24 フレームを順番に作成');
  const pending=page.waitForEvent('download',{timeout:120_000});
  await start.click();
  await expect(page.getByRole('button',{name:'キャンセル'})).toBeVisible();
  const result=await pending;
  expect(result.suggestedFilename()).toMatch(/_256x256_24fps_1s.webm$/);
  await mkdir('test-results/3d-video',{recursive:true});
  const filename='test-results/3d-video/animated.webm';
  await result.saveAs(filename);
  const probe=JSON.parse(execFileSync('ffprobe',
    ['-v','quiet','-count_frames','-show_streams','-of','json',filename],
    {encoding:'utf8'}));
  expect(probe.streams[0].width).toBe(256);
  expect(probe.streams[0].height).toBe(256);
  expect(probe.streams[0].nb_read_frames).toBe('24');
  const checksums=execFileSync('ffmpeg',['-v','error','-i',filename,'-f','framemd5','-'],
    {encoding:'utf8'}).split('\n').filter(line=>line.length>0&&!line.startsWith('#'));
  expect(checksums.length).toBe(24);
  expect(checksums[0]).not.toBe(checksums[23]);
  expect((await readFile(filename)).length).toBeGreaterThan(1000);
  await expect(start).toBeEnabled();
  await expect(page.getByText('3D動画の保存を開始しました。')).toBeVisible();
  expect(errors).toEqual([]);
});

test('3D video UI rejects unsupported encoder, validates resolution, and stays usable',async({page})=>{
  await page.addInitScript(()=>{
    Object.defineProperty(window,'VideoEncoder',{configurable:true,value:undefined});
  });
  await page.goto('./');
  await page.getByRole('button',{name:'3Dモード',exact:true}).click();
  await expect(page.getByTestId('three-preview')).toBeVisible();
  await page.getByRole('navigation',{name:'設定カテゴリー'})
    .getByRole('button',{name:'書き出し',exact:true}).click();
  await page.locator('.three-video-panel > summary').click();
  await expect(page.getByText(/WebCodecsに対応していません/)).toBeVisible();
  await expect(page.getByRole('button',{name:'3D動画を保存',exact:true})).toBeDisabled();
  await page.getByLabel('動画の幅 (px)').fill('257');
  await expect(page.getByText(/偶数で指定してください/)).toBeVisible();
  await expect(page.getByRole('button',{name:'3D PNGを書き出す',exact:true})).toBeEnabled();
});
