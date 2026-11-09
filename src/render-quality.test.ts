import { expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import { Preview } from './Preview';
import { generateScene, type Background } from './scene';
const background:Background={mode:'solid',solid:'#101020',colors:['#101020','#101020','#101020'],angle:0,glowIntensity:100};
it('uses scene-space strokes for every role in both algorithms and during growth',()=>{
  for(const version of ['2d-v4','2d-v5'] as const)for(const seed of ['neon-city','undefined-heartbeat','design-6']){
    const scene=generateScene(seed,'16:9',version);
    for(const progress of [.5,.9,.95,.99,1]){
      const svg=renderToStaticMarkup(createElement(Preview,{scene,background,growth:Object.fromEntries(scene.shapes.map(s=>[s.id,progress]))}));
      expect(svg).not.toContain('non-scaling-stroke');
      for(const shape of scene.shapes)expect(svg).toContain(`stroke-width="${shape.strokeWidth}"`);
    }
  }
});
