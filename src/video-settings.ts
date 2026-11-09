export type VideoSettings = {
  exportVideoFormat: 'webm' | 'mp4';
  exportVideoWidth: number;
  exportVideoHeight: number;
  exportVideoFps: 24 | 30 | 60;
};
export const videoDefaults: VideoSettings = { exportVideoFormat: 'webm', exportVideoWidth: 1280, exportVideoHeight: 720, exportVideoFps: 30 };
export function videoResolutionError(width: number, height: number): string | null {
  if (![width, height].every(n => Number.isInteger(n) && n >= 256 && n <= 4096 && n % 2 === 0)) return '動画の幅・高さは256〜4096pxの偶数で指定してください。';
  return width * height <= 8_388_608 ? null : '動画は合計8,388,608画素以下にしてください。';
}
export function videoSettings(data: Record<string, unknown>): VideoSettings {
  const v = { ...videoDefaults, ...Object.fromEntries(Object.keys(videoDefaults).filter(k => data[k] !== undefined).map(k => [k, data[k]])) };
  if (!['webm', 'mp4'].includes(v.exportVideoFormat) || ![24, 30, 60].includes(v.exportVideoFps) || typeof v.exportVideoWidth !== 'number' || typeof v.exportVideoHeight !== 'number' || videoResolutionError(v.exportVideoWidth, v.exportVideoHeight)) throw new Error('動画設定が不正です。形式・FPS・解像度を確認してください。');
  return v;
}
/** Include a complete final frame without changing the time-to-progress mapping. */
export function videoTimeline(duration: number, speed: number, fps: number) {
  const seconds = duration / speed;
  const frameCount = Math.ceil(seconds * fps) + 1;
  return { seconds, frameCount, encodedSeconds: frameCount / fps, timeAt: (index: number) => Math.min(index / fps, seconds) };
}

// WebCodecs bitrate must be an integer, including square resolutions at 24fps.
export const videoBitrate = (width: number, height: number, fps: number) => Math.round(Math.min(24_000_000, Math.max(2_000_000, width * height * fps * .2)));
