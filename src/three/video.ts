import {videoCodec} from '../video';
import {videoBitrate,videoResolutionError,videoSettings,type VideoSettings} from '../video-settings';
import type {ThreePreviewHandle} from './settings';

export type ThreeVideoOptions=VideoSettings & {durationSeconds:number};
export const threeVideoDefaults:ThreeVideoOptions={
  exportVideoFormat:'mp4',exportVideoWidth:1280,exportVideoHeight:720,
  exportVideoFps:30,durationSeconds:6,
};
const MAX_THREE_VIDEO_BYTES=128*1024*1024;

/** Check constraints before loading the expensive video encoder on mobile. */
export function validateThreeVideoOptions(input:ThreeVideoOptions):ThreeVideoOptions{
  const base=videoSettings(input);
  if(!Number.isFinite(input.durationSeconds)||input.durationSeconds<1||
    input.durationSeconds>30||Math.round(input.durationSeconds*10)!==input.durationSeconds*10)
    throw new Error('3D動画は1〜30秒（0.1秒単位）で指定してください。');
  const error=videoResolutionError(base.exportVideoWidth,base.exportVideoHeight);
  if(error)throw new Error(error);
  return {...base,durationSeconds:input.durationSeconds};
}

export const threeVideoFrameCount=(durationSeconds:number,fps:number)=>
  Math.max(1,Math.ceil(durationSeconds*fps));

/** Renders on an exact frame clock; unlike captureStream, slow GPUs do not
 * change the resulting video frame rate or duration. */
export async function exportThreeVideo(
  preview:ThreePreviewHandle,requested:ThreeVideoOptions,
  signal:AbortSignal,onProgress:(value:number)=>void,
):Promise<Blob>{
  const settings=validateThreeVideoOptions(requested);
  const {exportVideoWidth:width,exportVideoHeight:height,
    exportVideoFps:fps,exportVideoFormat:format,durationSeconds}=settings;
  signal.throwIfAborted();
  const codec=await videoCodec(settings);
  if(!codec)throw new Error(format==='mp4'?
    'このブラウザではMP4動画を作成できません。WebMに変更するか、対応するブラウザでお試しください。':
    'このブラウザではWebM動画を作成できません。MP4に変更するか、対応するブラウザでお試しください。');
  const {Output,BufferTarget,Mp4OutputFormat,WebMOutputFormat,
    CanvasSource,Quality}=await import('mediabunny');
  const canvas=document.createElement('canvas');
  canvas.width=width;canvas.height=height;
  const target=new BufferTarget();
  const output=new Output({target,
    format:format==='mp4'?new Mp4OutputFormat():new WebMOutputFormat()});
  let bytes=0;
  const source=new CanvasSource(canvas,{
    codec,quality:new Quality({bitrate:videoBitrate(width,height,fps),bitrateMode:'variable'}),
    latencyMode:'quality',hardwareAcceleration:'prefer-software',keyFrameInterval:2,
    onEncodedPacket:packet=>{bytes+=packet.data.byteLength;},
  });
  output.addVideoTrack(source,{frameRate:fps});
  output.setMetadataTags({creationTime:null});
  const cancel=()=>{void output.cancel().catch(()=>{});};
  signal.addEventListener('abort',cancel,{once:true});
  let started=false,previewStarted=false;
  try{
    await output.start();
    started=true;
    signal.throwIfAborted();
    preview.beginVideoExport();previewStarted=true;
    const count=threeVideoFrameCount(durationSeconds,fps);
    for(let index=0;index<count;index++){
      signal.throwIfAborted();
      await preview.captureVideoFrame(index/fps,width,height,canvas,signal);
      signal.throwIfAborted();
      await source.add(index/fps,1/fps,{keyFrame:index===0||index===count-1});
      signal.throwIfAborted();
      if(bytes>MAX_THREE_VIDEO_BYTES)
        throw new Error('動画が128MBを超えました。時間・FPS・解像度を下げてください。');
      onProgress((index+1)/(count+1));
      // Yield to UI input, cancellation and WebKit GPU scheduling.
      if(index%2===0)await new Promise(resolve=>setTimeout(resolve,0));
    }
    source.close();
    await output.finalize();
    signal.throwIfAborted();
    if(!target.buffer||target.buffer.byteLength>MAX_THREE_VIDEO_BYTES)
      throw new Error('動画の保存に失敗したか128MBを超えました。');
    onProgress(1);
    return new Blob([target.buffer],{type:format==='mp4'?'video/mp4':'video/webm'});
  }catch(error){
    if(started&&output.state!=='finalized'&&output.state!=='canceled')
      await output.cancel().catch(()=>{});
    signal.throwIfAborted();
    throw error;
  }finally{
    if(previewStarted)preview.endVideoExport();
    signal.removeEventListener('abort',cancel);
    canvas.width=0;canvas.height=0;
  }
}
