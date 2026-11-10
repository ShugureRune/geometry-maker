import {EASINGS,type Easing} from './animation';
/** Deterministic, SVG-native title layer. It never changes the seeded geometry. */
export type TextOverlaySettings={
 enabled:boolean;
 text:string;
 fontFamily:'sans-serif'|'serif'|'monospace';
 colorMode:'solid'|'primary'|'support'|'accent'|'gradient';
 fillMode:'solid'|'transparent';
 fontSize:number;
 bold:boolean;
 color:string;
 opacity:number;
 x:number;
 y:number;
 align:'left'|'center'|'right';
 rotation:number;
 strokeEnabled:boolean;
 strokeColorMode:'custom'|'text';
 strokeColor:string;
 strokeWidth:number;
 shadowEnabled:boolean;
 shadowColor:string;
 shadowBlur:number;
 glowEnabled:boolean;
 glowTarget:'fill'|'outline'|'both';
 glowColorMode:'text'|'custom';
 glowColor:string;
 glowStrength:number;
 glowBlur:number;
 entrance:'none'|'fade'|'slide-up'|'slide-left'|'zoom'|'typewriter';
 entranceDelay:number;
 entranceDuration:number;
 entranceEasing:Easing;
 layer:'front'|'back';
};
export const textOverlayDefaults:TextOverlaySettings={
 enabled:false,text:'タイトル',fontFamily:'sans-serif',colorMode:'solid',fillMode:'solid',fontSize:100,bold:true,
 color:'#ffffff',opacity:100,x:50,y:50,align:'center',rotation:0,
 strokeEnabled:false,strokeColorMode:'custom',strokeColor:'#171527',strokeWidth:6,
 shadowEnabled:false,shadowColor:'#000000',shadowBlur:8,
 glowEnabled:false,glowTarget:'fill',glowColorMode:'text',glowColor:'#bba0ff',glowStrength:100,glowBlur:10,
 entrance:'none',entranceDelay:0,entranceDuration:1.2,entranceEasing:'ease-out',layer:'front'
};
export function validateTextOverlay(value:unknown):TextOverlaySettings{
 if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('文字設定が不正です。');
 const data=value as Record<string,unknown>;
 const result={...textOverlayDefaults,...data};
 const choice=(v:unknown,options:readonly string[])=>typeof v==='string'&&options.includes(v);
 const number=(v:unknown,min:number,max:number)=>typeof v==='number'&&Number.isFinite(v)&&v>=min&&v<=max;
 const color=(v:unknown)=>typeof v==='string'&&/^#[0-9a-f]{6}$/i.test(v);
 if(typeof result.enabled!=='boolean'||typeof result.bold!=='boolean'||typeof result.strokeEnabled!=='boolean'||typeof result.shadowEnabled!=='boolean'
 ||typeof result.glowEnabled!=='boolean'
 ||typeof result.text!=='string'||result.text.length>2000||result.text.split('\n').length>12
 ||!choice(result.entrance,['none','fade','slide-up','slide-left','zoom','typewriter'])
 ||!EASINGS.includes(result.entranceEasing as Easing)
 ||!choice(result.fontFamily,['sans-serif','serif','monospace'])
 ||!choice(result.colorMode,['solid','primary','support','accent','gradient'])
 ||!choice(result.fillMode,['solid','transparent'])
 ||!choice(result.strokeColorMode,['custom','text'])
 ||!choice(result.glowTarget,['fill','outline','both'])
 ||!choice(result.glowColorMode,['text','custom'])
 ||!choice(result.align,['left','center','right'])||!choice(result.layer,['front','back'])
 ||!number(result.fontSize,12,250)||!number(result.opacity,0,100)
 ||!number(result.x,0,100)||!number(result.y,0,100)||!number(result.rotation,-180,180)
 ||!number(result.strokeWidth,0,30)||!number(result.shadowBlur,0,40)
 ||!number(result.glowStrength,0,200)||!number(result.glowBlur,0,40)
 ||!number(result.entranceDelay,0,10)||!number(result.entranceDuration,.2,8)
 ||!color(result.color)||!color(result.strokeColor)||!color(result.shadowColor)||!color(result.glowColor))
  throw new Error('文字設定の入力値が範囲外です。');
 // Copy only supported keys, never import arbitrary fields from a JSON file.
 return Object.fromEntries(Object.keys(textOverlayDefaults).map(key=>[key,result[key as keyof TextOverlaySettings]])) as TextOverlaySettings;
}
