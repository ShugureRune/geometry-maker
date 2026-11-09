import { describe, expect, it } from 'vitest';
import { videoBitrate, videoDefaults, videoResolutionError, videoSettings, videoTimeline } from './video-settings';
import { parseSettings, settingsText, type ProjectSettings } from './settings';
describe('deterministic video settings and frame clock', () => {
  it.each([24,30,60])('uses exact frame times and includes both endpoints at %i fps', fps => {
    for (const [duration,speed] of [[1,4],[8,1],[30,.25],[7,1.5]]) {
      const clock=videoTimeline(duration,speed,fps);
      expect(clock.timeAt(0)).toBe(0);
      expect(clock.timeAt(clock.frameCount-1)).toBe(duration/speed);
      expect(clock.timeAt(1)).toBeCloseTo(1/fps);
      expect(clock.encodedSeconds).toBeGreaterThan(duration/speed);
      expect(clock.encodedSeconds-duration/speed).toBeLessThanOrEqual(2/fps);
    }
  });
  it('validates memory bounds and encoding dimensions',()=>{
    expect(videoSettings({})).toEqual(videoDefaults);
    for(const pair of [[1280,720],[1920,1080],[1080,1920],[1080,1350],[2048,2048],[3840,2160]]) expect(videoResolutionError(...pair as [number,number])).toBeNull();
    for(const pair of [[255,256],[257,256],[8192,256],[4096,4096],[NaN,256]]) expect(videoResolutionError(...pair as [number,number])).not.toBeNull();
    for(const bad of [{exportVideoFps:25},{exportVideoFormat:'gif'},{exportVideoWidth:'1280'}]) expect(()=>videoSettings(bad)).toThrow();
  });
  it('round trips video settings while leaving legacy JSON optional',()=>{
    const old:ProjectSettings={schemaVersion:1,algorithmVersion:'2d-v5',seed:'video',aspectRatio:'16:9',backgroundMode:'solid',solidColor:'#112233',gradientColors:['#112233','#334455','#556677'],gradientAngle:135,exportWidth:1920,exportHeight:1080};
    expect(parseSettings(settingsText(old)).exportVideoFormat).toBeUndefined();
    expect(parseSettings(settingsText({...old,...videoDefaults}))).toEqual({...old,...videoDefaults,density:50});
    expect(()=>parseSettings(JSON.stringify({...old,exportVideoFps:25}))).toThrow();
  });
});

it('uses integer codec bitrates for all export presets and frame rates',()=>{
 for(const [width,height] of [[1280,720],[1920,1080],[3840,2160],[1080,1920],[2048,2048]])for(const fps of [24,30,60]){const bitrate=videoBitrate(width,height,fps);expect(Number.isInteger(bitrate)).toBe(true);expect(bitrate).toBeGreaterThanOrEqual(2_000_000);expect(bitrate).toBeLessThanOrEqual(24_000_000);}
 expect(videoBitrate(2048,2048,24)).toBe(20_132_659);
});
