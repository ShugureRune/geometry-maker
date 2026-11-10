import {describe,expect,it} from 'vitest';
import {movedTextPosition} from './PreviewTextEditor';
import {generateScene} from './scene';
import {textOverlayDefaults} from './text-overlay';
import {parseSettings,settingsText} from './settings';

describe('preview text drag in SVG viewBox space',()=>{
 it('converts pointer movement into normalized positions for any canvas ratio',()=>{
  expect(movedTextPosition({x:50,y:50},{x:800,y:450},{x:960,y:360},{width:1600,height:900}))
   .toEqual({x:60,y:40});
  expect(movedTextPosition({x:50,y:50},{x:450,y:800},{x:540,y:960},{width:900,height:1600}))
   .toEqual({x:60,y:60});
  expect(movedTextPosition({x:50,y:50},{x:600,y:600},{x:720,y:540},{width:1200,height:1200}))
   .toEqual({x:60,y:45});
 });
 it('clamps off-canvas drags and preserves sub-percent precision',()=>{
  expect(movedTextPosition({x:99,y:1},{x:0,y:0},{x:800,y:-100},{width:800,height:600}))
   .toEqual({x:100,y:0});
  expect(movedTextPosition({x:50,y:50},{x:0,y:0},{x:7,y:11},{width:1600,height:900}))
   .toEqual({x:50.4,y:51.2});
 });
 it('editing only the title position does not alter seed composition or JSON validation',()=>{
  const before=generateScene('preview-title-positions','16:9','2d-v5');
  const moved={...textOverlayDefaults,enabled:true,text:'直接編集',x:61.8,y:27.4,color:'#ab56cd'};
  const project={schemaVersion:1 as const,algorithmVersion:'2d-v5',seed:'preview-title-positions',aspectRatio:'16:9' as const,
   backgroundMode:'solid' as const,solidColor:'#111526',gradientColors:['#111526','#223344','#556677'] as [string,string,string],
   gradientAngle:135,exportWidth:1920,exportHeight:1080,textOverlay:moved};
  expect(parseSettings(settingsText(project)).textOverlay).toEqual(moved);
  expect(generateScene(project.seed,project.aspectRatio,'2d-v5')).toEqual(before);
 });
});
