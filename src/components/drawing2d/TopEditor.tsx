import { useMemo, useRef, useState } from 'react';
import { useT } from '../../i18n/useT';
import { carcassDims, computeDoors, doorZ, layoutSections, LIMITS, SLIDING_ZONE } from '../../lib/geometry';
import { sameRef, useWardrobe } from '../../store/wardrobeStore';
import type { EntityRef } from '../../types/wardrobe';
import { DimensionInput } from '../controls/DimensionInput';
import { Dimension, svgToContainer, type InlineEditState } from './Dimension';

const SEL = 'fill-blue-500/25 stroke-blue-600 dark:stroke-blue-400';
const BOARD = 'fill-amber-50 stroke-slate-500 dark:fill-slate-700 dark:stroke-slate-400';

/**
 * Вид сверху (план под крышей): боковины, задняя стенка, перегородки,
 * зона фасадов (дуги открывания распашных дверей / направляющие купе).
 * Клик по габаритам — прямой ввод ширины и глубины.
 */
export function TopEditor() {
  const t = useT();
  const w = useWardrobe((s) => s.wardrobe);
  const selection = useWardrobe((s) => s.selection);
  const select = useWardrobe((s) => s.select);
  const patch = useWardrobe((s) => s.patch);
  const showDoors = useWardrobe((s) => s.showDoors);

  const svgRef = useRef<SVGSVGElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const [edit, setEdit] = useState<InlineEditState | null>(null);

  const d = useMemo(() => carcassDims(w), [w]);
  const layout = useMemo(() => layoutSections(w), [w]);
  const doors = useMemo(() => computeDoors(w), [w]);

  const W = w.width;
  const D = w.depth;
  const th = d.t;
  // Стена (z = 0) сверху, фасад внизу: координата SVG = z. Распашные двери открываются вниз.
  const swingReach = doors.length && doors[0].kind !== 'sliding' ? Math.max(...doors.map((x) => x.width)) : 0;
  const fs = Math.max(W, D + swingReach) * 0.022;
  const margin = fs * 5;
  const Z = (z: number) => z;

  const openEdit = (label: string, value: number, min: number, max: number, x: number, y: number, commit: (v: number) => void) => {
    const svg = svgRef.current;
    const box = boxRef.current;
    if (!svg || !box) return;
    const pos = svgToContainer(svg, box, x, y);
    if (pos) setEdit({ label, value, min, max, left: pos.left, top: pos.top, commit });
  };

  const carcassSel = selection?.type === 'carcass';
  const pick = (ref: EntityRef) => (e: React.PointerEvent) => {
    e.stopPropagation();
    select(ref);
  };

  return (
    <div ref={boxRef} className="relative flex h-full w-full flex-col">
      <svg
        ref={svgRef}
        viewBox={`${-margin * 1.2} ${-margin} ${W + margin * 2.6} ${D + swingReach + margin * 2.4}`}
        preserveAspectRatio="xMidYMid meet"
        className="min-h-0 flex-1 select-none text-slate-700 dark:text-slate-200 [--dim-halo:#eef1f5] dark:[--dim-halo:#0f172a]"
        role="img"
        aria-label={t('view.top')}
        onPointerDown={() => select(null)}
      >
        <defs>
          <pattern id="te-grid" width={100} height={100} patternUnits="userSpaceOnUse">
            <path d="M100 0H0V100" fill="none" className="stroke-slate-300/50 dark:stroke-slate-600/40" strokeWidth={1} />
          </pattern>
        </defs>
        <rect x={-margin * 1.2} y={-margin} width={W + margin * 2.6} height={D + swingReach + margin * 2.4} fill="url(#te-grid)" pointerEvents="none" />
        {/* стена */}
        <line x1={-margin} x2={W + margin} y1={Z(0)} y2={Z(0)} className="stroke-slate-400" strokeWidth={3} vectorEffect="non-scaling-stroke" />

        {/* секции (клик — выбор секции) */}
        {layout.map((sl) => {
          const ref: EntityRef = { type: 'section', sectionId: sl.id };
          return (
            <rect
              key={sl.id}
              x={sl.x}
              y={Z(d.bt)}
              width={sl.width}
              height={d.interiorDepth}
              className={sameRef(selection, ref) ? 'fill-blue-500/15' : 'fill-slate-100 hover:fill-blue-500/5 dark:fill-slate-800/60'}
              role="button"
              aria-label={t('right.section', { n: sl.index + 1 })}
              onPointerDown={pick(ref)}
            />
          );
        })}

        {/* корпус */}
        <g className={carcassSel ? SEL : BOARD} onPointerDown={pick({ type: 'carcass' })} role="button" aria-label={t('right.carcass')}>
          {d.hasBack && <rect x={2} y={Z(0)} width={W - 4} height={d.bt} vectorEffect="non-scaling-stroke" />}
          <rect x={0} y={Z(d.bt)} width={th} height={d.panelDepth} vectorEffect="non-scaling-stroke" />
          <rect x={W - th} y={Z(d.bt)} width={th} height={d.panelDepth} vectorEffect="non-scaling-stroke" />
        </g>
        {/* контур крыши */}
        <rect
          x={0}
          y={Z(0)}
          width={W}
          height={d.carcassDepth}
          fill="none"
          className="stroke-slate-400"
          strokeDasharray="12 8"
          vectorEffect="non-scaling-stroke"
          pointerEvents="none"
        />

        {/* перегородки */}
        {layout.slice(0, -1).map((sl, i) => {
          const ref: EntityRef = { type: 'divider', index: i };
          return (
            <rect
              key={`div-${i}`}
              x={sl.x + sl.width}
              y={Z(d.bt)}
              width={th}
              height={d.interiorDepth}
              className={`${sameRef(selection, ref) ? SEL : BOARD} cursor-pointer`}
              vectorEffect="non-scaling-stroke"
              role="button"
              aria-label={t('right.divider', { n: i + 1 })}
              onPointerDown={pick(ref)}
            />
          );
        })}

        {/* направляющие купе */}
        {d.slidingDoors && (
          <g pointerEvents="none" className="stroke-slate-400" strokeDasharray="4 6">
            {[0, 1].map((track) => {
              const z = d.carcassDepth - SLIDING_ZONE + 20 + track * 40 + 10;
              return <line key={track} x1={th} x2={W - th} y1={Z(z)} y2={Z(z)} vectorEffect="non-scaling-stroke" />;
            })}
          </g>
        )}

        {/* фасады */}
        {showDoors &&
          doors.map((door) => {
            const ref: EntityRef = { type: 'door', index: door.index };
            const z = doorZ(w, door);
            const sel = sameRef(selection, ref);
            const cls = sel ? SEL : 'fill-sky-100 stroke-sky-600 dark:fill-sky-900/60 dark:stroke-sky-400';
            const front = Z(z + door.thickness);
            const top = Z(z);
            let arc: string | null = null;
            if (door.kind === 'swing') {
              const r = door.width;
              const hx = door.hingeSide === 'left' ? door.x : door.x + door.width;
              const ex = door.hingeSide === 'left' ? door.x + r : door.x;
              const sweep = door.hingeSide === 'left' ? 1 : 0;
              arc = `M ${ex} ${front} A ${r} ${r} 0 0 ${sweep} ${hx} ${front + r} L ${hx} ${front}`;
            }
            return (
              <g key={door.index} role="button" aria-label={t('right.door', { n: door.index + 1 })} onPointerDown={pick(ref)} className="cursor-pointer">
                {arc && <path d={arc} fill="none" className="stroke-sky-500/60" strokeDasharray="10 8" vectorEffect="non-scaling-stroke" />}
                <rect x={door.x} y={top} width={door.width} height={door.thickness} className={cls} vectorEffect="non-scaling-stroke" />
              </g>
            );
          })}

        {/* габариты */}
        <Dimension
          x1={0}
          y1={Z(0)}
          x2={W}
          y2={Z(0)}
          offset={-fs * 2}
          text={String(W)}
          fontSize={fs}
          ariaLabel={`${t('right.width')}: ${W} ${t('mm')}`}
          onClick={() => openEdit(t('right.width'), W, LIMITS.width.min, LIMITS.width.max, W / 2, -fs * 2.4, (v) => patch({ width: Math.round(v) }))}
        />
        <Dimension
          x1={W}
          y1={Z(0)}
          x2={W}
          y2={Z(D)}
          offset={-fs * 2.2}
          text={String(D)}
          fontSize={fs}
          ariaLabel={`${t('right.depth')}: ${D} ${t('mm')}`}
          onClick={() => openEdit(t('right.depth'), D, LIMITS.depth.min, LIMITS.depth.max, W + fs * 2.6, D / 2, (v) => patch({ depth: Math.round(v) }))}
        />
        {/* ширины секций */}
        {layout.map((sl) => (
          <Dimension
            key={`sw-${sl.id}`}
            x1={sl.x}
            y1={Z(d.bt + d.interiorDepth)}
            x2={sl.x + sl.width}
            y2={Z(d.bt + d.interiorDepth)}
            offset={-fs * 0.2}
            text={String(sl.width)}
            fontSize={fs * 0.8}
            className="text-slate-500 dark:text-slate-400"
          />
        ))}
      </svg>

      {edit && (
        <div
          className="absolute z-10 w-32 -translate-x-1/2 -translate-y-1/2 rounded-md bg-white p-1 shadow-lg ring-1 ring-slate-200 dark:bg-slate-800 dark:ring-slate-700"
          style={{ left: edit.left, top: edit.top }}
        >
          <DimensionInput
            label={edit.label}
            hideLabel
            autoFocus
            value={edit.value}
            min={edit.min}
            max={edit.max}
            unit={t('mm')}
            onCommit={(v) => {
              edit.commit(v);
              setEdit(null);
            }}
            onCancel={() => setEdit(null)}
          />
        </div>
      )}
    </div>
  );
}
