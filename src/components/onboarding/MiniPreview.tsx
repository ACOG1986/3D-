import { useMemo } from 'react';
import { carcassDims, computeDoors, itemExtent, layoutSections, wingWardrobe } from '../../lib/geometry';
import { getMaterial } from '../../lib/materials';
import type { Wardrobe } from '../../types/wardrobe';

/** Упрощённый вид спереди: корпус, наполнение и контуры дверей. Для мастера и подсказок. */
export function MiniPreview({ w, className }: { w: Wardrobe; className?: string }) {
  const data = useMemo(() => {
    const d = carcassDims(w);
    return { d, layout: layoutSections(w), doors: computeDoors(w), wing: wingWardrobe(w) };
  }, [w]);
  const { d, layout, doors, wing } = data;
  const body = getMaterial(w.bodyMaterial).color;
  const front = getMaterial(w.doors.material).color;
  const left = w.corner?.side !== 'right';
  // Боковое крыло показываем «развёрнутым» рядом, в перспективе-полоске
  const wingW = wing ? Math.min(wing.width, w.depth) * 0.9 : 0;
  const pad = 60;
  const totalW = w.width + (wing ? wingW + 40 : 0);
  const ox = wing && left ? wingW + 40 : 0;
  const Y = (y: number) => w.height - y;
  const stroke = '#475569';

  return (
    <svg
      viewBox={`${-pad} ${-pad} ${totalW + pad * 2} ${w.height + pad * 2}`}
      className={className}
      role="img"
      aria-label={`${w.width}×${w.height}×${w.depth}`}
    >
      <g transform={`translate(${ox} 0)`}>
        <rect x={0} y={0} width={w.width} height={w.height} fill={body} stroke={stroke} strokeWidth={8} />
        <rect
          x={d.t}
          y={Y(d.innerBottom + d.innerHeight)}
          width={d.innerWidth}
          height={d.innerHeight}
          fill="#ffffff"
          fillOpacity={0.55}
          stroke={stroke}
          strokeWidth={4}
        />
        {layout.slice(0, -1).map((s) => (
          <rect
            key={s.id}
            x={s.x + s.width}
            y={Y(d.innerBottom + d.innerHeight)}
            width={d.t}
            height={d.innerHeight}
            fill={body}
            stroke={stroke}
            strokeWidth={4}
          />
        ))}
        {layout.map((s) =>
          w.sections[s.index].items.map((it) => {
            const y0 = d.innerBottom + it.y;
            const e = itemExtent(it, d.t);
            if (it.kind === 'shelf')
              return (
                <rect
                  key={it.id}
                  x={s.x}
                  y={Y(y0 + d.t)}
                  width={s.width}
                  height={Math.max(d.t, 14)}
                  fill={body}
                  stroke={stroke}
                  strokeWidth={3}
                />
              );
            if (it.kind === 'rod' || it.kind === 'pantograph')
              return (
                <g key={it.id}>
                  <line
                    x1={s.x + 10}
                    x2={s.x + s.width - 10}
                    y1={Y(y0)}
                    y2={Y(y0)}
                    stroke="#64748b"
                    strokeWidth={14}
                    strokeLinecap="round"
                  />
                  {[0.25, 0.5, 0.75].map((k) => (
                    <path key={k} d={`M ${s.x + s.width * k} ${Y(y0)} l -70 120 h 140 z`} fill="none" stroke="#94a3b8" strokeWidth={6} />
                  ))}
                </g>
              );
            const h = e.top - e.bottom;
            return (
              <g key={it.id}>
                <rect
                  x={s.x + 4}
                  y={Y(d.innerBottom + e.top) + 4}
                  width={s.width - 8}
                  height={h - 8}
                  fill={it.kind === 'drawer' ? body : '#cbd5e1'}
                  stroke={stroke}
                  strokeWidth={4}
                />
                {it.kind === 'drawer' && (
                  <line
                    x1={s.x + s.width / 2 - 60}
                    x2={s.x + s.width / 2 + 60}
                    y1={Y(d.innerBottom + e.top) + h / 2}
                    y2={Y(d.innerBottom + e.top) + h / 2}
                    stroke={stroke}
                    strokeWidth={10}
                    strokeLinecap="round"
                  />
                )}
              </g>
            );
          }),
        )}
        {doors.map((door) => (
          <rect
            key={door.index}
            x={door.x}
            y={Y(door.y + door.height)}
            width={door.width}
            height={door.height}
            fill={front}
            fillOpacity={0.22}
            stroke="#334155"
            strokeOpacity={0.7}
            strokeWidth={8}
            strokeDasharray="36 22"
          />
        ))}
      </g>
      {wing && (
        <g transform={`translate(${left ? 0 : w.width + 40} 0)`}>
          <polygon
            points={
              left
                ? `0,${-w.height * 0.06} ${wingW},0 ${wingW},${w.height} 0,${w.height * 1.06}`
                : `0,0 ${wingW},${-w.height * 0.06} ${wingW},${w.height * 1.06} 0,${w.height}`
            }
            fill={front}
            fillOpacity={0.55}
            stroke={stroke}
            strokeWidth={6}
          />
        </g>
      )}
    </svg>
  );
}
