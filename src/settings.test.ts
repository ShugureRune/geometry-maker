import { describe, expect, it } from 'vitest';
import { ALGORITHM_VERSION } from './scene';
import { fileStem, parseSettings, resolutionError, settingsText, type ProjectSettings } from './settings';
const valid: ProjectSettings = { schemaVersion: 1, algorithmVersion: ALGORITHM_VERSION, seed: '心音-001', aspectRatio: '16:9', backgroundMode: 'gradient', solidColor: '#111526', gradientColors: ['#112233', '#334455', '#556677'], gradientAngle: 135, exportWidth: 1920, exportHeight: 1080 };
describe('portable, versioned settings', () => {
 it('round-trips all settings including empty and Unicode seeds', () => {
  for(const seed of ['', '心音🌱', ' 001 ']) expect(parseSettings(settingsText({...valid, seed}))).toEqual({...valid, seed});
 });
 it.each([
  ['schemaVersion', 2], ['algorithmVersion', '2d-v3'], ['seed', 123], ['aspectRatio', '__proto__'],
  ['backgroundMode', 'texture'], ['solidColor', 'red'], ['gradientColors', ['#112233']],
  ['gradientAngle', 361], ['exportWidth', 255], ['exportHeight', 8193], ['exportWidth', 1024.5],
 ])('rejects invalid %s without accepting partial settings', (key, value) => {
  expect(() => parseSettings(JSON.stringify({...valid, [key]: value}))).toThrow();
 });
 it('rejects every missing required field, malformed and oversized files', () => {
  for(const key of Object.keys(valid)) {const copy: Record<string,unknown> = {...valid};delete copy[key]; expect(()=>parseSettings(JSON.stringify(copy))).toThrow();}
  for(const text of ['{','null','[]',' '.repeat(65537)]) expect(()=>parseSettings(text)).toThrow();
 });
 it('keeps resolutions bounded and filenames safe', () => {
  expect(resolutionError(256,8192)).toBeNull();expect(resolutionError(NaN,256)).not.toBeNull();
  expect(fileStem('../a/b:*?')).not.toMatch(/[/:*?]/);expect(fileStem('')).toContain('seed-empty');
 });
});
