import type { KeyboardEvent, MouseEvent } from 'react';

export interface DimensionProps {
  /** Начальная и конечная точки измеряемого отрезка (координаты SVG). */
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  /** Смещение размерной линии по нормали к отрезку (знак задаёт сторону). */
  offset: number;
  text: string;
  /** Высота шрифта в единицах SVG. */
  fontSize: number;
  onClick?: (e: MouseEvent<SVGElement> | KeyboardEvent<SVGElement>) => void;
  ariaLabel?: string;
  className?: string;
}

/**
 * Размерная линия: выносные линии, засечки под 45°, текст по центру.
 * Вертикальные размеры подписываются повёрнутым текстом.
 */
export function Dimension({ x1, y1, x2, y2, offset, text, fontSize, onClick, ariaLabel, className }: DimensionProps) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  // нормаль
  const nx = -uy;
  const ny = ux;
  const ext = Math.sign(offset || 1) * fontSize * 0.4;
  const a = { x: x1 + nx * offset, y: y1 + ny * offset };
  const b = { x: x2 + nx * offset, y: y2 + ny * offset };
  const tick = fontSize * 0.35;
  const tx = (ux + nx) * tick * 0.7;
  const ty = (uy + ny) * tick * 0.7;
  const mx = (a.x + b.x) / 2 + nx * fontSize * 0.25 * Math.sign(offset || 1);
  const my = (a.y + b.y) / 2 + ny * fontSize * 0.25 * Math.sign(offset || 1);
  const vertical = Math.abs(uy) > Math.abs(ux);
  // сторона, в которую вынесен текст (в экранных координатах)
  const side = Math.sign(offset || 1);
  const towardNegative = vertical ? nx * side < 0 : ny * side < 0;
  const interactive = !!onClick;

  return (
    <g className={className ?? 'text-blue-600 dark:text-blue-400'}>
      <g stroke="currentColor" strokeWidth={1} vectorEffect="non-scaling-stroke" fill="none" pointerEvents="none">
        <line x1={x1} y1={y1} x2={a.x + nx * ext} y2={a.y + ny * ext} vectorEffect="non-scaling-stroke" opacity={0.55} />
        <line x1={x2} y1={y2} x2={b.x + nx * ext} y2={b.y + ny * ext} vectorEffect="non-scaling-stroke" opacity={0.55} />
        <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} vectorEffect="non-scaling-stroke" />
        <line x1={a.x - tx} y1={a.y - ty} x2={a.x + tx} y2={a.y + ty} vectorEffect="non-scaling-stroke" strokeWidth={1.6} />
        <line x1={b.x - tx} y1={b.y - ty} x2={b.x + tx} y2={b.y + ty} vectorEffect="non-scaling-stroke" strokeWidth={1.6} />
      </g>
      <text
        x={mx}
        y={my}
        fontSize={fontSize}
        fill="currentColor"
        textAnchor="middle"
        dominantBaseline={towardNegative ? 'auto' : 'hanging'}
        transform={vertical ? `rotate(-90 ${mx} ${my})` : undefined}
        role={interactive ? 'button' : undefined}
        tabIndex={interactive ? 0 : undefined}
        aria-label={interactive ? (ariaLabel ?? text) : undefined}
        className={interactive ? 'cursor-pointer font-medium outline-none hover:underline focus-visible:underline' : undefined}
        style={{ paintOrder: 'stroke', fontVariantNumeric: 'tabular-nums' }}
        stroke="var(--dim-halo, transparent)"
        strokeWidth={fontSize * 0.25}
        onClick={onClick}
        onPointerDown={interactive ? (e) => e.stopPropagation() : undefined}
        onKeyDown={
          interactive
            ? (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onClick?.(e);
                }
              }
            : undefined
        }
      >
        {text}
      </text>
    </g>
  );
}

/* ------------------------------------------------------------------ */
/* Общие хелперы редакторов                                            */
/* ------------------------------------------------------------------ */

/** Состояние открытого поля прямого ввода размера. */
export interface InlineEditState {
  label: string;
  value: number;
  min: number;
  max: number;
  left: number;
  top: number;
  commit: (v: number) => void;
}
