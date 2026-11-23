import { useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { useT } from '../../i18n/useT';
import { carcassDims, computeDoors, itemExtent, itemsOverlap, layoutSections, LIMITS, snap } from '../../lib/geometry';
import { sameRef, useActiveWardrobe, useWardrobe } from '../../store/wardrobeStore';
import type { EntityRef, SectionItem, SectionLayout } from '../../types/wardrobe';
import { DimensionInput } from '../controls/DimensionInput';
import { readDragKind } from '../panels/dragKinds';
import { dropOnModel } from '../viewer3d/Scene';
import { clientToSvg, Dimension, svgToContainer, type InlineEditState } from './Dimension';

type Drag =
  | { type: 'item'; sectionId: string; itemId: string; grab: number; moved: boolean; overlap: boolean }
  | { type: 'divider'; index: number; moved: boolean };

const SEL = 'fill-blue-500/25 stroke-blue-600 dark:stroke-blue-400';
const BOARD = 'fill-amber-50 stroke-slate-500 dark:fill-slate-700 dark:stroke-slate-400';
const BAD = 'fill-red-500/30 stroke-red-600';

/**
 * Интерактивный вид спереди (без фасадов): выбор деталей, перетаскивание
 * полок/ящиков по вертикали и перегородок по горизонтали с привязкой 10 мм,
 * размерные цепочки с прямым вводом, приём drag & drop из каталога.
 */
export function FrontEditor() {
  const t = useT();
  const w = useActiveWardrobe();
  const hasWing = useWardrobe((s) => s.wardrobe.type === 'corner' && !!s.wardrobe.corner);
  const wingMode = useWardrobe((s) => s.wing);
  const setWing = useWardrobe((s) => s.setWing);
  const isWing = hasWing && wingMode === 'corner';
  const divRef = (index: number): EntityRef => (isWing ? { type: 'divider', index, wing: true } : { type: 'divider', index });
  const selection = useWardrobe((s) => s.selection);
  const showDoors = useWardrobe((s) => s.showDoors);
  const select = useWardrobe((s) => s.select);
  const beginGesture = useWardrobe((s) => s.beginGesture);
  const updateItem = useWardrobe((s) => s.updateItem);
  const moveDivider = useWardrobe((s) => s.moveDivider);
  const setSectionWidth = useWardrobe((s) => s.setSectionWidth);
  const patch = useWardrobe((s) => s.patchActive);

  const svgRef = useRef<SVGSVGElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [edit, setEdit] = useState<InlineEditState | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const d = useMemo(() => carcassDims(w), [w]);
  const layout = useMemo(() => layoutSections(w), [w]);
  const doors = useMemo(() => computeDoors(w), [w]);

  const W = w.width;
  const H = w.height;
  const fs = Math.max(W, H) * 0.022;
  const margin = fs * 5;
  const Y = (mm: number) => H - mm; // мм от пола → координата SVG
  const { t: th, innerBottom, innerHeight } = d;

  const selSectionId =
    selection?.type === 'section' ? selection.sectionId : selection?.type === 'item' ? selection.sectionId : null;

  const toMm = (clientX: number, clientY: number) => {
    const svg = svgRef.current;
    if (!svg) return null;
    const p = clientToSvg(svg, clientX, clientY);
    return p ? { x: p.x, y: H - p.y } : null;
  };

  const openEdit = (label: string, value: number, min: number, max: number, x: number, y: number, commit: (v: number) => void) => {
    const svg = svgRef.current;
    const box = boxRef.current;
    if (!svg || !box) return;
    const pos = svgToContainer(svg, box, x, y);
    if (!pos) return;
    setEdit({ label, value, min, max, left: pos.left, top: pos.top, commit });
  };

  /* ---------------- перетаскивание ---------------- */

  const startItemDrag = (e: ReactPointerEvent<SVGElement>, sectionId: string, item: SectionItem) => {
    e.stopPropagation();
    select({ type: 'item', sectionId, itemId: item.id });
    const p = toMm(e.clientX, e.clientY);
    if (!p) return;
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    setDrag({ type: 'item', sectionId, itemId: item.id, grab: p.y - innerBottom - item.y, moved: false, overlap: false });
  };

  const startDividerDrag = (e: ReactPointerEvent<SVGElement>, index: number) => {
    e.stopPropagation();
    select(divRef(index));
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    setDrag({ type: 'divider', index, moved: false });
  };

  const onPointerMove = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (!drag) return;
    const p = toMm(e.clientX, e.clientY);
    if (!p) return;
    if (!drag.moved) beginGesture();
    if (drag.type === 'item') {
      const raw = p.y - innerBottom - drag.grab;
      const y = e.altKey ? Math.round(raw) : snap(raw);
      updateItem(drag.sectionId, drag.itemId, { y }, false);
      const cur = useWardrobe.getState().wardrobe;
      const sec = cur.sections.find((s) => s.id === drag.sectionId);
      const it = sec?.items.find((i) => i.id === drag.itemId);
      const overlap = !!(sec && it && sec.items.some((o) => o.id !== it.id && itemsOverlap(it, o, cur.boardThickness)));
      setDrag({ ...drag, moved: true, overlap });
    } else {
      const left = layout[drag.index];
      if (!left) return;
      const raw = p.x - th / 2 - left.x;
      moveDivider(drag.index, e.altKey ? Math.round(raw) : snap(raw), false);
      if (!drag.moved) setDrag({ ...drag, moved: true });
    }
  };

  const endDrag = () => setDrag(null);

  /* ---------------- отрисовка наполнения ---------------- */

  const renderItem = (sl: SectionLayout, sectionId: string, item: SectionItem, items: SectionItem[]) => {
    const ref: EntityRef = { type: 'item', sectionId, itemId: item.id };
    const selected = sameRef(selection, ref);
    const overlap = items.some((o) => o.id !== item.id && itemsOverlap(item, o, th));
    const cls = overlap ? BAD : selected ? SEL : BOARD;
    const y0 = innerBottom + item.y;
    const x = sl.x;
    const sw = sl.width;
    const common = {
      onPointerDown: (e: ReactPointerEvent<SVGElement>) => startItemDrag(e, sectionId, item),
      className: 'cursor-ns-resize',
      role: 'button',
      'aria-label': `${t(`item.${item.kind}`)} ${item.y} ${t('mm')}`,
      tabIndex: -1,
    } as const;
    switch (item.kind) {
      case 'shelf':
        return (
          <g key={item.id} {...common}>
            <rect x={x + 1} y={Y(y0 + th)} width={sw - 2} height={th} className={cls} vectorEffect="non-scaling-stroke" />
            {/* расширенная зона захвата */}
            <rect x={x} y={Y(y0 + th) - 20} width={sw} height={th + 40} fill="transparent" />
          </g>
        );
      case 'drawer': {
        const h = item.height - 4;
        return (
          <g key={item.id} {...common}>
            <rect x={x + 2} y={Y(y0 + h)} width={sw - 4} height={h} className={cls} vectorEffect="non-scaling-stroke" />
            <line
              x1={x + sw / 2 - Math.min(64, sw / 4)}
              x2={x + sw / 2 + Math.min(64, sw / 4)}
              y1={Y(y0 + h - Math.min(40, h / 3))}
              y2={Y(y0 + h - Math.min(40, h / 3))}
              className="stroke-slate-600 dark:stroke-slate-300"
              strokeWidth={2}
              vectorEffect="non-scaling-stroke"
            />
          </g>
        );
      }
      case 'basket':
        return (
          <g key={item.id} {...common}>
            <rect
              x={x + 13}
              y={Y(y0 + item.height)}
              width={sw - 26}
              height={item.height}
              fill="url(#fe-hatch)"
              className={overlap ? 'stroke-red-600' : selected ? 'stroke-blue-600' : 'stroke-slate-500 dark:stroke-slate-400'}
              vectorEffect="non-scaling-stroke"
            />
          </g>
        );
      case 'rod': {
        const cls2 = selected ? 'stroke-blue-600 fill-blue-600' : 'stroke-slate-500 fill-slate-500 dark:stroke-slate-300 dark:fill-slate-300';
        return (
          <g key={item.id} {...common}>
            <line x1={x + 8} x2={x + sw - 8} y1={Y(y0)} y2={Y(y0)} className={cls2} strokeWidth={3} vectorEffect="non-scaling-stroke" />
            <circle cx={x + 8} cy={Y(y0)} r={8} className={cls2} />
            <circle cx={x + sw - 8} cy={Y(y0)} r={8} className={cls2} />
            <rect x={x} y={Y(y0) - 30} width={sw} height={60} fill="transparent" />
          </g>
        );
      }
      case 'pantograph': {
        const cls2 = selected ? 'stroke-blue-600' : 'stroke-slate-500 dark:stroke-slate-300';
        return (
          <g key={item.id} {...common}>
            <line x1={x + 10} x2={x + sw - 10} y1={Y(y0)} y2={Y(y0)} className={cls2} strokeWidth={3} vectorEffect="non-scaling-stroke" />
            <line x1={x + 4} x2={x + 10} y1={Y(y0 + 40)} y2={Y(y0)} className={cls2} strokeWidth={2} vectorEffect="non-scaling-stroke" />
            <line x1={x + sw - 4} x2={x + sw - 10} y1={Y(y0 + 40)} y2={Y(y0)} className={cls2} strokeWidth={2} vectorEffect="non-scaling-stroke" />
            <line x1={x + 4} x2={x + 4} y1={Y(y0 + 40)} y2={Y(y0 - 60)} className={cls2} strokeDasharray="6 6" vectorEffect="non-scaling-stroke" />
            <rect x={x} y={Y(y0 + 40)} width={sw} height={100} fill="transparent" />
          </g>
        );
      }
    }
  };

  /* ---------------- размерные цепочки секции ---------------- */

  const renderSectionChain = (sl: SectionLayout) => {
    const section = w.sections[sl.index];
    const items = [...section.items].sort((a, b) => a.y - b.y);
    const marks = items.map((it) => ({ item: it, y: it.y }));
    const pts = [0, ...marks.map((m) => m.y), innerHeight];
    const xr = sl.x + sl.width;
    return (
      <g key={`chain-${sl.id}`}>
        {pts.slice(0, -1).map((y, i) => {
          const y2 = pts[i + 1];
          if (y2 - y < 1) return null;
          const target = marks[i]?.item; // элемент на верхнем конце отрезка
          const value = Math.round(y2 - y);
          const onClick = target
            ? () =>
                openEdit(`${t(`item.${target.kind}`)}`, value, 0, innerHeight, xr - fs * 2.5, Y(innerBottom + (y + y2) / 2), (v) =>
                  updateItem(section.id, target.id, { y: Math.round(y + v) }),
                )
            : undefined;
          return (
            <Dimension
              key={i}
              x1={xr}
              y1={Y(innerBottom + y)}
              x2={xr}
              y2={Y(innerBottom + y2)}
              offset={-fs * 1.2}
              text={String(value)}
              fontSize={fs * 0.8}
              onClick={onClick}
              ariaLabel={target ? `${t(`item.${target.kind}`)}: ${value} ${t('mm')}` : undefined}
            />
          );
        })}
      </g>
    );
  };

  const dragged = drag?.type === 'item' ? w.sections.find((s) => s.id === drag.sectionId)?.items.find((i) => i.id === drag.itemId) : null;
  const draggedSection = drag?.type === 'item' ? layout.find((l) => l.id === drag.sectionId) : null;
  const dividerX = drag?.type === 'divider' && layout[drag.index] ? layout[drag.index].x + layout[drag.index].width + th / 2 : null;

  return (
    <div ref={boxRef} className={`relative flex h-full w-full flex-col ${dragOver ? 'ring-4 ring-inset ring-blue-400' : ''}`}>
      {hasWing && (
        <div className="absolute left-3 top-3 z-10 seg bg-white/90 dark:bg-slate-800/90" role="group" aria-label={t('corner.title')}>
          <button type="button" aria-pressed={!isWing} onClick={() => setWing('main')}>
            {t('view.mainWing')}
          </button>
          <button type="button" aria-pressed={isWing} onClick={() => setWing('corner')}>
            {t('view.cornerWing')}
          </button>
        </div>
      )}
      <svg
        ref={svgRef}
        viewBox={`${-margin * 1.4} ${-margin} ${W + margin * 2.4} ${H + margin * 2.2}`}
        preserveAspectRatio="xMidYMid meet"
        className="min-h-0 flex-1 touch-none select-none text-slate-700 dark:text-slate-200 [--dim-halo:#eef1f5] dark:[--dim-halo:#0f172a]"
        role="img"
        aria-label={t('view.front')}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onPointerDown={() => select(null)}
        onDragOver={(e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'copy';
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          const kind = readDragKind(e.dataTransfer);
          const p = toMm(e.clientX, e.clientY);
          if (kind && p) dropOnModel(kind, p.x, p.y);
        }}
      >
        <defs>
          <pattern id="fe-grid" width={10} height={10} patternUnits="userSpaceOnUse" x={0} y={H % 10}>
            <path d="M10 0H0V10" fill="none" className="stroke-slate-300/40 dark:stroke-slate-600/30" strokeWidth={0.5} />
          </pattern>
          <pattern id="fe-grid100" width={100} height={100} patternUnits="userSpaceOnUse" x={0} y={H % 100}>
            <rect width={100} height={100} fill="url(#fe-grid)" />
            <path d="M100 0H0V100" fill="none" className="stroke-slate-400/40 dark:stroke-slate-500/40" strokeWidth={1} />
          </pattern>
          <pattern id="fe-hatch" width={30} height={30} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line x1={0} y1={0} x2={0} y2={30} className="stroke-slate-400 dark:stroke-slate-500" strokeWidth={3} />
          </pattern>
        </defs>

        {/* сетка 10 мм */}
        <rect x={-margin * 1.4} y={-margin} width={W + margin * 2.4} height={H + margin * 2.2} fill="url(#fe-grid100)" pointerEvents="none" />
        {/* пол */}
        <line x1={-margin} x2={W + margin} y1={H} y2={H} className="stroke-slate-400" vectorEffect="non-scaling-stroke" strokeDasharray="8 6" />

        {/* задняя стенка — фон, клик по пустой секции выбирает её */}
        <rect x={0} y={0} width={W} height={H} className="fill-slate-100 dark:fill-slate-800/60" pointerEvents="none" />
        {layout.map((sl) => {
          const ref: EntityRef = { type: 'section', sectionId: sl.id };
          return (
            <rect
              key={`area-${sl.id}`}
              x={sl.x}
              y={Y(innerBottom + innerHeight)}
              width={sl.width}
              height={innerHeight}
              className={sameRef(selection, ref) ? 'fill-blue-500/10' : selSectionId === sl.id ? 'fill-blue-500/5' : 'fill-transparent hover:fill-blue-500/5'}
              role="button"
              aria-label={t('right.section', { n: sl.index + 1 })}
              onPointerDown={(e) => {
                e.stopPropagation();
                select(ref);
              }}
            />
          );
        })}

        {/* корпус */}
        <g
          onPointerDown={(e) => {
            e.stopPropagation();
            select({ type: 'carcass' });
          }}
          className={selection?.type === 'carcass' ? SEL : BOARD}
          role="button"
          aria-label={t('right.carcass')}
        >
          <rect x={0} y={0} width={th} height={H} vectorEffect="non-scaling-stroke" />
          <rect x={W - th} y={0} width={th} height={H} vectorEffect="non-scaling-stroke" />
          <rect x={th} y={0} width={W - 2 * th} height={th} vectorEffect="non-scaling-stroke" />
          <rect x={th} y={Y(d.plinthH + th)} width={W - 2 * th} height={th} vectorEffect="non-scaling-stroke" />
          {w.plinth.enabled && <rect x={th} y={Y(d.plinthH)} width={W - 2 * th} height={d.plinthH} vectorEffect="non-scaling-stroke" />}
        </g>

        {/* оси при перетаскивании */}
        {draggedSection && dragged && (
          <g pointerEvents="none" className="stroke-blue-500" strokeDasharray="10 8">
            <line x1={draggedSection.x + draggedSection.width / 2} x2={draggedSection.x + draggedSection.width / 2} y1={0} y2={H} vectorEffect="non-scaling-stroke" />
            <line x1={-margin} x2={W + margin} y1={Y(innerBottom + dragged.y)} y2={Y(innerBottom + dragged.y)} vectorEffect="non-scaling-stroke" />
          </g>
        )}
        {dividerX !== null && (
          <line x1={dividerX} x2={dividerX} y1={-margin} y2={H + margin} className="stroke-blue-500" strokeDasharray="10 8" vectorEffect="non-scaling-stroke" pointerEvents="none" />
        )}

        {/* перегородки */}
        {layout.slice(0, -1).map((sl, i) => {
          const ref: EntityRef = divRef(i);
          return (
            <g key={`div-${i}`} onPointerDown={(e) => startDividerDrag(e, i)} className="cursor-ew-resize" role="button" aria-label={t('right.divider', { n: i + 1 })}>
              <rect
                x={sl.x + sl.width}
                y={Y(innerBottom + innerHeight)}
                width={th}
                height={innerHeight}
                className={sameRef(selection, ref) ? SEL : BOARD}
                vectorEffect="non-scaling-stroke"
              />
              <rect x={sl.x + sl.width - 20} y={Y(innerBottom + innerHeight)} width={th + 40} height={innerHeight} fill="transparent" />
            </g>
          );
        })}

        {/* наполнение */}
        {layout.map((sl) => {
          const section = w.sections[sl.index];
          return <g key={`items-${sl.id}`}>{section.items.map((it) => renderItem(sl, section.id, it, section.items))}</g>;
        })}

        {/* контуры фасадов */}
        {showDoors &&
          doors.map((door) => (
            <rect
              key={`door-${door.index}`}
              x={door.x}
              y={Y(door.y + door.height)}
              width={door.width}
              height={door.height}
              className="fill-sky-400/5 stroke-sky-500/60"
              strokeDasharray="14 8"
              vectorEffect="non-scaling-stroke"
              pointerEvents="none"
            />
          ))}

        {/* живая подпись при перетаскивании */}
        {dragged && draggedSection && (
          <text
            x={draggedSection.x + draggedSection.width / 2}
            y={Y(innerBottom + itemExtent(dragged, th).top) - fs * 0.4}
            fontSize={fs}
            textAnchor="middle"
            className={drag?.type === 'item' && drag.overlap ? 'fill-red-600' : 'fill-blue-600 dark:fill-blue-400'}
            pointerEvents="none"
            style={{ paintOrder: 'stroke' }}
            stroke="var(--dim-halo)"
            strokeWidth={fs * 0.3}
          >
            {dragged.y} {t('mm')}
          </text>
        )}

        {/* габариты */}
        <Dimension
          x1={0}
          y1={0}
          x2={W}
          y2={0}
          offset={-fs * 2.2}
          text={String(W)}
          fontSize={fs}
          ariaLabel={`${t('right.width')}: ${W} ${t('mm')}`}
          onClick={() => openEdit(t('right.width'), W, LIMITS.width.min, LIMITS.width.max, W / 2, -fs * 2.6, (v) => patch({ width: Math.round(v) }))}
        />
        <Dimension
          x1={0}
          y1={H}
          x2={0}
          y2={0}
          offset={-fs * 3.4}
          text={String(H)}
          fontSize={fs}
          ariaLabel={`${t('right.height')}: ${H} ${t('mm')}`}
          onClick={() => openEdit(t('right.height'), H, LIMITS.height.min, LIMITS.height.max, -fs * 3.6, H / 2, (v) => patch({ height: Math.round(v) }))}
        />
        {/* ширины секций */}
        {layout.map((sl) => (
          <Dimension
            key={`sw-${sl.id}`}
            x1={sl.x}
            y1={H}
            x2={sl.x + sl.width}
            y2={H}
            offset={fs * 1.4}
            text={String(sl.width)}
            fontSize={fs * 0.9}
            ariaLabel={`${t('right.section', { n: sl.index + 1 })}: ${sl.width} ${t('mm')}`}
            onClick={
              layout.length > 1
                ? () =>
                    openEdit(
                      t('right.section', { n: sl.index + 1 }),
                      sl.width,
                      LIMITS.sectionWidth.min,
                      LIMITS.sectionWidth.max,
                      sl.x + sl.width / 2,
                      H + fs * 2,
                      (v) => setSectionWidth(sl.id, Math.round(v)),
                    )
                : undefined
            }
          />
        ))}
        {/* цепочка по выбранной секции */}
        {layout.filter((sl) => sl.id === selSectionId).map(renderSectionChain)}
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

      <p className="shrink-0 px-3 pb-2 text-center text-xs text-slate-500 dark:text-slate-400">{t('view.editHint')}</p>
      {dragOver && (
        <div className="pointer-events-none absolute inset-x-0 bottom-10 text-center">
          <span className="rounded bg-blue-600 px-3 py-1 text-sm text-white shadow">{t('view.dropHint')}</span>
        </div>
      )}
    </div>
  );
}
