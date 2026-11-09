import { test, expect } from './ui-test';
import { readFile, mkdir } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
test('deterministic WebM frames, FPS, ratios, glow, playback and JSON', async ({page})=>{
  test.setTimeout(180000);
  await page.goto('./');
  await page.getByLabel('アニメーションを有効化').uncheck();
  await page.getByLabel('シード値',{exact:true}).fill('video-stage4');
  await page.getByLabel('シード値',{exact:true}).press('Enter');
  await expect(page.getByTestId('current-seed')).toHaveText('video-stage4');
  await page.getByLabel('アニメーションを有効化').check();
  await page.getByLabel('成長時間（秒）').fill('1');
  await page.getByLabel('再生速度',{exact:true}).selectOption('4');
  await page.locator('summary').filter({hasText:'動画書き出し'}).click();
  await mkdir('test-results/video',{recursive:true});
  const files:string[]=[];
  for(const [fps,ratio,width,height,glow] of [[24,'16:9',512,288,0],[30,'9:16',288,512,100],[60,'1:1',256,256,200]] as const){
    await page.getByLabel('キャンバスの比率').selectOption(ratio);
    await page.getByLabel('発光強度').fill(String(glow));
    await page.getByLabel('動画の幅 (px)').fill(String(width));
    await page.getByLabel('動画の高さ (px)').fill(String(height));
    await page.getByLabel('動画FPS').selectOption(String(fps));
    await expect(page.getByRole('button',{name:'動画を書き出す',exact:true})).toBeEnabled();
    await page.getByLabel('幅 (px)',{exact:true}).fill(String(width));
    await page.getByLabel('高さ (px)',{exact:true}).fill(String(height));
    const svgPending=page.waitForEvent('download');await page.getByRole('button',{name:'SVGを書き出す',exact:true}).click();
    const expectedSvg=await readFile((await (await svgPending).path())!,'utf8');
    for(let repeat=0;repeat<(fps===24?2:1);repeat++){
      const pending=page.waitForEvent('download');
      await page.getByRole('button',{name:'動画を書き出す',exact:true}).click();
      const download=await pending;
      expect(download.suggestedFilename()).toContain(`2d-v5_seed-video-stage4_${width}x${height}_${fps}fps.webm`);
      const path=`test-results/video/${fps}-${repeat}.webm`; await download.saveAs(path); files.push(path);
      const probe=JSON.parse(execFileSync('ffprobe',['-v','quiet','-count_frames','-show_streams','-of','json',path],{encoding:'utf8'}));
      expect(probe.streams[0].width).toBe(width); expect(probe.streams[0].height).toBe(height);
      expect(probe.streams[0].nb_read_frames).toBe(String(Math.ceil(.25*fps)+1));
      const data=(await readFile(path)).toString('base64');
      const decoded=execFileSync('ffmpeg',['-v','error','-i',path,'-f','rawvideo','-pix_fmt','rgba','-'],{maxBuffer:64*1024*1024});
      const frameSize=width*height*4;const first=decoded.subarray(0,frameSize).toString('base64'), last=decoded.subarray(-frameSize).toString('base64');
      const playback=await page.evaluate(async({data,expectedSvg,fps,first,last})=>{
        const video=document.createElement('video');video.muted=true;video.src=URL.createObjectURL(new Blob([Uint8Array.from(atob(data),c=>c.charCodeAt(0))],{type:'video/webm'}));
        document.body.append(video);
        await new Promise<void>((resolve,reject)=>{video.onloadeddata=()=>resolve();video.onerror=()=>reject(new Error('video decode failed'));});
        const canvas=document.createElement('canvas');canvas.width=video.videoWidth;canvas.height=video.videoHeight;const ctx=canvas.getContext('2d')!;
        async function difference(svg:string,frame:string){
          const actual=Uint8Array.from(atob(frame),c=>c.charCodeAt(0));
          const image=new Image();const url=URL.createObjectURL(new Blob([svg],{type:'image/svg+xml'}));image.src=url;await image.decode();ctx.clearRect(0,0,canvas.width,canvas.height);ctx.drawImage(image,0,0);URL.revokeObjectURL(url);const expected=ctx.getImageData(0,0,canvas.width,canvas.height).data;
          let error=0;for(let i=0;i<actual.length;i+=4)for(let c=0;c<3;c++)error+=Math.abs(actual[i+c]-expected[i+c]);return error/(actual.length/4*3);
        }
        const doc=new DOMParser().parseFromString(expectedSvg,'image/svg+xml');doc.querySelector('[data-testid="shapes"]')!.replaceChildren();
        const startError=await difference(new XMLSerializer().serializeToString(doc),first);
        video.currentTime=video.duration-.5/fps;await new Promise<void>(resolve=>{video.onseeked=()=>resolve();});
        const finalError=await difference(expectedSvg,last);
        await video.play();video.pause();
        const result={width:video.videoWidth,height:video.videoHeight,duration:video.duration,startError,finalError};URL.revokeObjectURL(video.src);video.remove();return result;
      },{data,expectedSvg,fps,first,last});
      expect(playback.startError).toBeLessThan(8);expect(playback.finalError).toBeLessThan(8);
      expect(playback.width).toBe(width);expect(playback.height).toBe(height);expect(playback.duration).toBeGreaterThanOrEqual(.25);
    }
  }
  // Compare decoded pixels, independently of container/codec metadata.
  const hashes=files.slice(0,2).map(path=>execFileSync('ffmpeg',['-v','error','-i',path,'-f','framemd5','-'],{encoding:'utf8'}).split('\n').filter(line=>!line.startsWith('#')).join('\n'));
  expect(hashes[0]).toBe(hashes[1]);
  const pending=page.waitForEvent('download');await page.getByRole('button',{name:'設定JSONを保存',exact:true}).click();
  const settings=JSON.parse(await readFile((await (await pending).path())!,'utf8'));
  expect(settings.exportVideoFps).toBe(60);expect(settings.exportVideoWidth).toBe(256);
  await page.getByLabel('動画FPS').selectOption('24');
  await page.getByLabel('設定JSONファイル').setInputFiles({name:'video.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(settings))});
  await expect(page.getByLabel('動画FPS')).toHaveValue('60');
  await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
test('video cancel and unsupported browser are explicit',async({page})=>{
  await page.goto('./');await page.locator('summary').filter({hasText:'動画書き出し'}).click();
  await page.getByLabel('動画の幅 (px)').fill('256');await page.getByLabel('動画の高さ (px)').fill('256');
  await page.getByRole('button',{name:'動画を書き出す',exact:true}).click();
  await page.getByRole('button',{name:'動画書き出しをキャンセル',exact:true}).click();
  await expect(page.getByText('動画書き出しをキャンセルしました。',{exact:true})).toBeVisible();
  await page.addInitScript(()=>{Object.defineProperty(window,'VideoEncoder',{value:undefined});});
  await page.reload();await page.locator('summary').filter({hasText:'動画書き出し'}).click();
  await expect(page.getByText('このブラウザはWebCodecs動画エンコードに未対応です。PCの最新Chrome/Edgeをお試しください。')).toBeVisible();
  await expect(page.getByRole('button',{name:'動画を書き出す',exact:true})).toBeDisabled();
});
test('MP4 exports when H264 is available, otherwise explains support',async({page})=>{
  await page.goto('./');await page.getByLabel('アニメーションを有効化').uncheck();
  await page.getByLabel('成長時間（秒）').fill('1');await page.getByLabel('再生速度',{exact:true}).selectOption('4');
  await page.locator('summary').filter({hasText:'動画書き出し'}).click();
  await page.getByLabel('動画の幅 (px)').fill('256');await page.getByLabel('動画の高さ (px)').fill('256');await page.getByLabel('動画形式').selectOption('mp4');
  await expect.poll(async()=>await page.getByRole('button',{name:'動画を書き出す',exact:true}).isEnabled() || await page.getByText('選択した形式・解像度のエンコードに未対応です。別の形式・解像度をお試しください。').isVisible()).toBe(true);
  if(await page.getByRole('button',{name:'動画を書き出す',exact:true}).isEnabled()){
    const pending=page.waitForEvent('download');await page.getByRole('button',{name:'動画を書き出す',exact:true}).click();const download=await pending;
    expect(download.suggestedFilename()).toMatch(/\.mp4$/);await mkdir('test-results/video',{recursive:true});await download.saveAs('test-results/video/sample.mp4');
    const probe=JSON.parse(execFileSync('ffprobe',['-v','quiet','-show_streams','-of','json','test-results/video/sample.mp4'],{encoding:'utf8'}));expect(probe.streams[0].codec_name).toBe('h264');
  }else test.info().annotations.push({type:'MP4',description:'H.264 encoder unavailable; unsupported message verified'});
});
