/** Decorative 2D background grid. No random state: never affects seeded figure placement. */
export type GridAnimationSettings = {
  enabled: boolean;
  mode: 'scroll' | 'rotate' | 'pulse';
  duration: number;
  direction: 'right' | 'left' | 'up' | 'down' | 'diagonal';
  reverse: boolean;
};
export const gridAnimationDefaults: GridAnimationSettings = {
  enabled: false,
  mode: 'scroll',
  duration: 8,
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
  return {enabled:a.enabled,mode:a.mode as GridAnimationSettings['mode'],
    duration:a.duration,direction:a.direction as GridAnimationSettings['direction'],reverse:a.reverse};
}

/** Pure clock-based loop; same timestamp and settings always produce identical frames. */
export function gridAnimationFrame(grid:GridBackgroundSettings,seconds=0){
  const animation=grid.animation??gridAnimationDefaults;
  const safeSeconds=Number.isFinite(seconds)?Math.max(0,seconds):0;
  const phase=animation.enabled?(safeSeconds%animation.duration)/animation.duration:0;
  let moveX=0,moveY=0,rotation=grid.rotation,opacityMultiplier=1;
  if(animation.enabled&&animation.mode==='scroll'){
    const delta=phase*grid.spacing;
    switch(animation.direction){
      case 'left':moveX=-delta;break;
      case 'up':moveY=-delta;break;
      case 'down':moveY=delta;break;
      case 'diagonal':moveX=delta;moveY=delta;break;
      default:moveX=delta;
    }
  }else if(animation.enabled&&animation.mode==='rotate'){
    rotation+=(animation.reverse?-1:1)*phase*360;
  }else if(animation.enabled&&animation.mode==='pulse'){
    opacityMultiplier=.35+.65*(1-Math.cos(2*Math.PI*phase))/2;
  }
  return {moveX,moveY,rotation,opacityMultiplier};
}

/** Ensures regular video exports include at least one complete animated grid cycle. */
export function gridAnimationSeconds(grid?:GridBackgroundSettings):number {
  return grid?.enabled&&grid.animation?.enabled?grid.animation.duration:0;
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
