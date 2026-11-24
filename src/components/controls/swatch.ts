import type { CSSProperties } from 'react';
import type { Material } from '../../lib/materials';

/** CSS-образец декора для палитры. */
export function swatchStyle(m: Material): CSSProperties {
  if (m.kind === 'mirror') return { background: 'linear-gradient(135deg,#f8fafc,#94a3b8 50%,#e2e8f0)' };
  if (m.kind === 'glass') return { background: m.color, opacity: 0.75 };
  if (m.grain)
    return {
      background: `repeating-linear-gradient(90deg, ${m.color} 0 3px, color-mix(in srgb, ${m.color} 85%, black) 3px 4px)`,
    };
  return { background: m.color };
}
