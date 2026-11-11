/** World-building features. Optional so every older Geometry Maker 3D JSON remains valid. */
export const WEATHER_TYPES=['clear','rain','snow','storm'] as const;
export type WeatherType=typeof WEATHER_TYPES[number];
export type WorldSettings={
  timeOfDay:number;sunStrength:number;
  natureDensity:number;cloudAmount:number;
  weather:WeatherType;weatherStrength:number;
  waterReflection:number;waterWaves:number;
  explore:boolean;exploreSpeed:number;
};
export const worldDefaults:WorldSettings={
  timeOfDay:12,sunStrength:100,natureDensity:100,cloudAmount:100,
  weather:'clear',weatherStrength:100,
  waterReflection:100,waterWaves:100,
  explore:false,exploreSpeed:8,
};
export function validateWorld(value:unknown):WorldSettings{
  if(!value||typeof value!=='object'||Array.isArray(value))
    throw new Error('3Dワールド設定が不正です。');
  const v=value as Record<string,unknown>,out:{[key:string]:unknown}={};
  for(const [name,min,max] of [
    ['timeOfDay',0,24],['sunStrength',0,200],['natureDensity',0,200],
    ['cloudAmount',0,200],['weatherStrength',0,200],
    ['waterReflection',0,200],['waterWaves',0,200],['exploreSpeed',1,20],
  ] as const){
    const n=v[name];
    if(typeof n!=='number'||!Number.isFinite(n)||n<min||n>max)
      throw new Error('3Dワールド設定 '+name+' が範囲外です。');
    out[name]=n;
  }
  if(typeof v.explore!=='boolean')throw new Error('探索モードの設定が不正です。');
  if(typeof v.weather!=='string'||!WEATHER_TYPES.includes(v.weather as WeatherType))
    throw new Error('天候の種類が不正です。');
  return {...out,explore:v.explore,weather:v.weather} as WorldSettings;
}
/** Golden-hour/sunrise shifts are continuous across midnight. */
export function sunlightAtHour(hour:number):{strength:number;altitude:number;azimuth:number}{
  const phase=(hour-6)/12*Math.PI;
  const elevation=Math.sin(phase);
  const strength=Math.max(.045,Math.pow(Math.max(0,elevation),.7));
  const azimuth=(hour/24)*Math.PI*2;
  return {strength,altitude:elevation,azimuth};
}
export function natureInstanceCount(density:number,low:boolean,base:number):number{
  return Math.max(0,Math.round(base*density/100*(low?.3:1)));
}
export function weatherParticleCount(weather:WeatherType,strength:number,low:boolean):number{
  return weather==='clear'?0:natureInstanceCount(strength,low,weather==='storm'?1800:weather==='rain'?1200:600);
}
