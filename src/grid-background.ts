/** Decorative 2D background grid. No random state: never affects seeded figure placement. */
export type GridAnimationSettings = {
  enabled: boolean;
  mode: 'scroll' | 'rotate' | 'pulse';
  duration: number;
  /** Optional for backward compatibility with older grid JSON. */
  speed?: number;
  direction: 'right' | 'left' | 'up' | 'down' | 'diagonal';
  reverse: boolean;
};
export const gridAnimationDefaults: GridAnimationSettings = {
  enabled: false,
  mode: 'scroll',
  duration: 8,
  speed: 1,
  direction: 'right',
  reverse: false,
};

export type GridBackgroundSettings = {
  animation?: GridAnimationSettings;
  enabled: boolean;
  type: 'line' | 'dot';
  colorMode: 'auto' | 'custom';
  color: string;
  opacity: number;
  spacing: number;
  thickness: number;
  glow: number;
  rotation: number;
};

export const gridBackgroundDefaults: GridBackgroundSettings = {
  enabled: false,
  type: 'line',
  colorMode: 'auto',
  color: '#ffffff',
  opacity: 24,
  spacing: 48,
  thickness: 1,
  glow: 0,
  rotation: 0,
  animation: {...gridAnimationDefaults},
};

export function validateGridAnimation(value: unknown): GridAnimationSettings {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('グリッドアニメーション設定が不正です。');
  const a=value as Record<string,unknown>;
  if(typeof a.enabled!=='boolean'||!['scroll','rotate','pulse'].includes(String(a.mode))||
     typeof a.duration!=='number'||!Number.isFinite(a.duration)||a.duration<2||a.duration>30||
     !['right','left','up','down','diagonal'].includes(String(a.direction))||typeof a.reverse!=='boolean')
    throw new Error('グリッドアニメーションの設定が不正です。');
  if(a.speed!==undefined&&(!Number.isFinite(a.speed)||typeof a.speed!=='number'||a.speed<.1||a.speed>10))
    throw new Error('グリッドのスクロール速度は0.1〜10倍で指定してください。');
  return {enabled:a.enabled,mode:a.mode as GridAnimationSettings['mode'],
    duration:a.duration,direction:a.direction as GridAnimationSettings['direction'],reverse:a.reverse,
    ...(a.speed===undefined?{}:{speed:a.speed as number})};
}

/** Pure timestamp-based motion. Modulo happens in pattern-local coordinates,
 * so grid movement remains continuous at every lattice boundary, including arbitrary
 * figure angles and rotated patterns. No per-frame SVG animations or timers. */
export function gridAnimationFrame(grid:GridBackgroundSettings,seconds=0,figureAngle?:number){
  const animation=grid.animation??gridAnimationDefaults;
  const safeSeconds=Number.isFinite(seconds)?Math.max(0,seconds):0;
  const phase=animation.enabled?(safeSeconds%animation.duration)/animation.duration:0;
  let moveX=0,moveY=0,rotation=grid.rotation,opacityMultiplier=1;
  if(animation.enabled&&animation.mode==='scroll'){
    const travel=safeSeconds*(animation.speed??1)*grid.spacing/animation.duration;
    let dx=0,dy=0;
    if(figureAngle!==undefined){
      const angle=figureAngle*Math.PI/180;
      dx=travel*Math.cos(angle);dy=travel*Math.sin(angle);
    }else{
      // Legacy settings remain reproducible for older callers.
      switch(animation.direction){
        case 'left':dx=-travel;break;
        case 'up':dy=-travel;break;
        case 'down':dy=travel;break;
        case 'diagonal':dx=travel;dy=travel;break;
        default:dx=travel;
      }
    }
    const r=grid.rotation*Math.PI/180,c=Math.cos(r),sn=Math.sin(r);
    const wrap=(n:number)=>{const x=n%grid.spacing;return Math.abs(x)<1e-10?0:+x.toFixed(9);};
    moveX=wrap(dx*c+dy*sn);
    moveY=wrap(-dx*sn+dy*c);
  }else if(animation.enabled&&animation.mode==='rotate'){
    rotation+=(animation.reverse?-1:1)*phase*360;
  }else if(animation.enabled&&animation.mode==='pulse'){
    opacityMultiplier=.35+.65*(1-Math.cos(2*Math.PI*phase))/2;
  }
  return {moveX,moveY,rotation,opacityMultiplier};
}

/** Ensures regular video exports capture a full loop even with slower grid speed. */
export function gridAnimationSeconds(grid?:GridBackgroundSettings):number {
  const a=grid?.animation;
  return grid?.enabled&&a?.enabled?a.mode==='scroll'?a.duration/(a.speed??1):a.duration:0;
}

/** Other grid settings remain backward-compatible when animation is absent. */
export function validateGridBackground(value: unknown): GridBackgroundSettings {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('グリッド背景設定が不正です。');
  const g = value as Record<string, unknown>;
  if (typeof g.enabled !== 'boolean' || (g.type !== 'line' && g.type !== 'dot') ||
      (g.colorMode !== 'auto' && g.colorMode !== 'custom') ||
      typeof g.color !== 'string' || !/^#[0-9a-f]{6}$/i.test(g.color))
    throw new Error('グリッド背景の種類・色設定が不正です。');
  for (const [key,min,max] of [['opacity',0,100],['spacing',16,200],['thickness',0.5,8],['glow',0,100],['rotation',-180,180]] as const) {
    if (typeof g[key] !== 'number' || !Number.isFinite(g[key]) || g[key] < min || g[key] > max)
      throw new Error(`グリッド背景の${key}が範囲外です。`);
  }
  return {
    enabled: g.enabled, type: g.type, colorMode: g.colorMode, color: g.color,
    opacity: g.opacity as number, spacing: g.spacing as number,
    thickness: g.thickness as number, glow: g.glow as number, rotation: g.rotation as number,
    ...(g.animation===undefined?{}:{animation:validateGridAnimation(g.animation)}),
  };
}
