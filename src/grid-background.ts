/** Decorative 2D background grid. No random state: never affects seeded figure placement. */
export type GridBackgroundSettings = {
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
};

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
  };
}
