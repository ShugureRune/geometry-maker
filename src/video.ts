import { ambientVideoSeconds } from './ambient';
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
export async function exportVideo(input: VideoArtwork, requested: VideoSettings, signal: AbortSignal, onProgress: (progress: number) => void): Promise<Blob> {
  const settings = videoSettings(requested);
  const snapshot = structuredClone(input);
  const { exportVideoWidth: width, exportVideoHeight: height, exportVideoFps: fps, exportVideoFormat: format } = settings;
  const codec = await videoCodec(settings);
  signal.throwIfAborted();
  if (!codec) throw new Error(`${format.toUpperCase()}のエンコードにこのブラウザ・解像度は対応していません。PCの最新Chrome/Edge、または別の形式・解像度をお試しください。`);
  const { Output, BufferTarget, WebMOutputFormat, Mp4OutputFormat, CanvasSource, Quality } = await import('mediabunny');
  const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('動画描画用Canvasを作成できません。');
  const target = new BufferTarget();
  const output = new Output({ target, format: format === 'webm' ? new WebMOutputFormat() : new Mp4OutputFormat() });
  let bytes = 0;
  const source = new CanvasSource(canvas, { codec, quality: new Quality({ bitrate: videoBitrate(width, height, fps), bitrateMode: 'variable' }), latencyMode: 'quality', hardwareAcceleration: 'prefer-software', keyFrameInterval: 2, onEncodedPacket: packet => { bytes += packet.data.byteLength; } });
  output.addVideoTrack(source, { frameRate: fps });
  output.setMetadataTags({ creationTime: null });
  const render = createVideoRenderer(snapshot);
  const isAmbient=snapshot.ambient?.settings.enabled;
  const seconds=isAmbient?ambientVideoSeconds(snapshot.ambient!.settings):0;
  const ambientFrames=Math.max(1,Math.round(seconds*fps));
  const timeline = isAmbient?{frameCount:ambientFrames,timeAt:(i:number)=>i*seconds/ambientFrames}:videoTimeline(snapshot.animation.animationDuration, snapshot.animation.playbackSpeed, fps);
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
      if (bytes > 256 * 1024 * 1024) throw new Error('動画が256MBを超えました。解像度・FPS・成長時間を下げてください。');
      onProgress((i + 1) / (timeline.frameCount + 1));
      await new Promise(resolve => setTimeout(resolve, 0));
    }
    source.close();
    await output.finalize(); signal.throwIfAborted();
    if (!target.buffer || target.buffer.byteLength > 256 * 1024 * 1024) throw new Error('動画の保存に失敗したか、256MBを超えました。');
    onProgress(1);
    return new Blob([target.buffer], { type: format === 'webm' ? 'video/webm' : 'video/mp4' });
  } catch (error) {
    if (output.state !== 'finalized' && output.state !== 'canceled') await output.cancel();
    signal.throwIfAborted(); throw error;
  } finally { signal.removeEventListener('abort', cancel); canvas.width = 0; canvas.height = 0; }
}
