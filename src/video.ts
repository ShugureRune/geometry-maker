import { ambientVideoSeconds } from './ambient';
import {textEntranceEnd} from './text-entrance';
import {gridAnimationSeconds} from './grid-background';
import { createVideoRenderer, drawVideoFrame, type VideoArtwork } from './video-frame';
import { videoBitrate, videoSettings, videoTimeline, type VideoSettings } from './video-settings';
export const videoAvailable = () => typeof VideoEncoder !== 'undefined' && typeof VideoFrame !== 'undefined';
export async function videoCodec(settings: VideoSettings) {
  if (!videoAvailable()) return null;
  const { getFirstEncodableVideoCodec } = await import('mediabunny');
  return getFirstEncodableVideoCodec(settings.exportVideoFormat === 'webm' ? ['vp9', 'vp8'] : ['avc'], {
    width: settings.exportVideoWidth, height: settings.exportVideoHeight, frameRate: settings.exportVideoFps,
  });
}
export type VideoDestination={write:(chunk:{type:'write';data:Uint8Array<ArrayBuffer>;position:number})=>Promise<void>;close:()=>Promise<void>;abort:()=>Promise<void>};
export function exportVideo(input:VideoArtwork,requested:VideoSettings,signal:AbortSignal,onProgress:(progress:number)=>void):Promise<Blob>;
export function exportVideo(input:VideoArtwork,requested:VideoSettings,signal:AbortSignal,onProgress:(progress:number)=>void,destination:VideoDestination):Promise<null>;
export async function exportVideo(input:VideoArtwork,requested:VideoSettings,signal:AbortSignal,onProgress:(progress:number)=>void,destination?:VideoDestination):Promise<Blob|null>{
 try{return await encodeVideo(input,requested,signal,onProgress,destination);}catch(error){await destination?.abort().catch(()=>{});throw error;}
}
async function encodeVideo(input:VideoArtwork,requested:VideoSettings,signal:AbortSignal,onProgress:(progress:number)=>void,destination?:VideoDestination):Promise<Blob|null>{
  const settings = videoSettings(requested);
  const snapshot = structuredClone(input);
  const { exportVideoWidth: width, exportVideoHeight: height, exportVideoFps: fps, exportVideoFormat: format } = settings;
  const ambientSeconds=snapshot.ambient?.settings.enabled?ambientVideoSeconds(snapshot.ambient.settings):0;
  if(ambientSeconds>30&&!destination)throw new Error('30秒を超える待機動画は、対応PCで「ファイルへ逐次保存」を選択してください。非対応環境では時間を短くしてください。');
  const maxBytes=snapshot.ambient?.settings.enabled?64*1024*1024:256*1024*1024;
  const codec = await videoCodec(settings);
  signal.throwIfAborted();
  if (!codec) throw new Error(`${format.toUpperCase()}のエンコードにこのブラウザ・解像度は対応していません。PCの最新Chrome/Edge、または別の形式・解像度をお試しください。`);
  const { Output, BufferTarget, StreamTarget, WebMOutputFormat, Mp4OutputFormat, CanvasSource, Quality } = await import('mediabunny');
  const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('動画描画用Canvasを作成できません。');
  const target = destination?new StreamTarget(new WritableStream({write:chunk=>destination.write(chunk)}),{chunked:true,chunkSize:64*1024}):new BufferTarget();
  const output = new Output({ target, format: format === 'webm' ? new WebMOutputFormat() : new Mp4OutputFormat(destination?{fastStart:false}:undefined) });
  let bytes = 0;
  const source = new CanvasSource(canvas, { codec, quality: new Quality({ bitrate: videoBitrate(width, height, fps), bitrateMode: 'variable' }), latencyMode: 'quality', hardwareAcceleration: 'prefer-software', keyFrameInterval: 2, onEncodedPacket: packet => { bytes += packet.data.byteLength; } });
  output.addVideoTrack(source, { frameRate: fps });
  output.setMetadataTags({ creationTime: null });
  const render = createVideoRenderer(snapshot);
  const isAmbient=snapshot.ambient?.settings.enabled;
  const seconds=isAmbient?ambientVideoSeconds(snapshot.ambient!.settings):0;
  const ambientFrames=Math.max(1,Math.round(seconds*fps));
  const timeline = isAmbient?{frameCount:ambientFrames,timeAt:(i:number)=>i*seconds/ambientFrames}:videoTimeline(Math.max(snapshot.animation.animationDuration/snapshot.animation.playbackSpeed,textEntranceEnd(snapshot.textOverlay),gridAnimationSeconds(snapshot.background.grid)), 1, fps);
  // Cancel immediately, including while awaiting encoder backpressure.
  const cancel = () => { void output.cancel().catch(() => {}); };
  signal.addEventListener('abort', cancel, { once: true });
  try {
    await output.start();
    for (let i = 0; i < timeline.frameCount; i++) {
      signal.throwIfAborted();
      await drawVideoFrame(context, render(timeline.timeAt(i), width, height), signal);
      await source.add(i / fps, 1 / fps, { keyFrame: i === 0 || i === timeline.frameCount - 1 });
      signal.throwIfAborted();
      if (!destination&&bytes>maxBytes) throw new Error(`動画が${maxBytes/1024/1024}MBを超えました。逐次保存を使うか、解像度・FPS・時間を下げてください。`);
      onProgress((i + 1) / (timeline.frameCount + 1));
      await new Promise(resolve => setTimeout(resolve, 0));
    }
    source.close();
    await output.finalize(); signal.throwIfAborted();
    if(destination){await destination.close();onProgress(1);return null;}
    if (!(target instanceof BufferTarget)||!target.buffer || target.buffer.byteLength > maxBytes) throw new Error(`動画の保存に失敗したか、${maxBytes/1024/1024}MBを超えました。`);
    onProgress(1);
    return new Blob([target.buffer], { type: format === 'webm' ? 'video/webm' : 'video/mp4' });
  } catch (error) {
    if (output.state !== 'finalized' && output.state !== 'canceled') await output.cancel();
    signal.throwIfAborted(); throw error;
  } finally { signal.removeEventListener('abort', cancel); canvas.width = 0; canvas.height = 0; }
}
