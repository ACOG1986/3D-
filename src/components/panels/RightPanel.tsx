import { useMemo } from 'react';
import { useT } from '../../i18n/useT';
import type { MessageKey } from '../../i18n';
import { activeWardrobe, allDoors, carcassDims, layoutSections, LIMITS, sectionWing, sortItems } from '../../lib/geometry';
import { backMaterials, bodyMaterials, facadeMaterials } from '../../lib/materials';
import { findSelectedItem, useWardrobe } from '../../store/wardrobeStore';
import type { DoorKind, HandleType, HingeType, SectionItem, SlideType, Wardrobe, WardrobeType } from '../../types/wardrobe';
import { DimensionInput } from '../controls/DimensionInput';
import { MaterialPicker } from '../controls/MaterialPicker';
import { Segmented, Select } from '../controls/Select';

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="flex flex-col gap-3 border-t border-slate-200 pt-3 first:border-t-0 first:pt-0 dark:border-slate-800">
      <legend className="panel-title float-left w-full">{title}</legend>
      {children}
    </fieldset>
  );
}

function CarcassProps() {
  const t = useT();
  const w = useWardrobe((s) => s.wardrobe);
  const patch = useWardrobe((s) => s.patch);
  const setDoors = useWardrobe((s) => s.setDoors);
  const addSection = useWardrobe((s) => s.addSection);
  const mm = t('mm');
  const types: WardrobeType[] = ['swing', 'sliding', 'combined', 'built-in', 'corner'];
  const applyTemplate = useWardrobe((s) => s.applyTemplate);
  const setCorner = useWardrobe((s) => s.setCorner);
  const setWing = useWardrobe((s) => s.setWing);
  const setView = useWardrobe((s) => s.setView);
  const doorKinds: DoorKind[] = ['swing', 'sliding', 'lift', 'none'];

  return (
    <div className="flex flex-col gap-4">
      <Group title={t('right.dims')}>
        <div className="grid grid-cols-3 gap-2">
          {(['width', 'height', 'depth'] as const).map((k) => (
            <DimensionInput
              key={k}
              label={t(`right.${k}`)}
              value={w[k]}
              min={LIMITS[k].min}
              max={LIMITS[k].max}
              step={10}
              unit={mm}
              help={k === 'depth' ? t('help.depth') : undefined}
              onCommit={(v) => patch({ [k]: Math.round(v) } as Partial<Wardrobe>)}
            />
          ))}
        </div>
        <Select label={t('right.type')} value={w.type} options={types.map((v) => ({ value: v, label: t(`type.${v}`) }))} onChange={(type) => (type === 'corner' && !w.corner ? applyTemplate('corner') : patch({ type }))} />
        <div className="grid grid-cols-2 gap-2">
          <Segmented label={t('right.board')} help={t('help.board')} value={w.boardThickness} options={[16, 18, 22].map((v) => ({ value: v as 16 | 18 | 22, label: String(v) }))} onChange={(v) => patch({ boardThickness: v })} />
          <Segmented label={t('right.backT')} help={t('help.back')} value={w.backThickness} options={[3, 4].map((v) => ({ value: v as 3 | 4, label: String(v) }))} onChange={(v) => patch({ backThickness: v })} />
        </div>
        <div className="grid grid-cols-2 items-end gap-2">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" className="h-4 w-4 accent-blue-600" checked={w.plinth.enabled} onChange={(e) => patch({ plinth: { ...w.plinth, enabled: e.target.checked } })} />
            {t('right.plinth')}
          </label>
          <DimensionInput
            label={t('right.plinthH')}
            help={t('help.plinth')}
            value={w.plinth.height}
            min={LIMITS.plinth.min}
            max={LIMITS.plinth.max}
            unit={mm}
            disabled={!w.plinth.enabled}
            onCommit={(v) => patch({ plinth: { ...w.plinth, height: Math.round(v) } })}
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Select
            label={`${t('right.edge')}: ${t('right.edgeVisible')}`}
            help={t('help.edge')}
            value={w.edge.visible}
            options={[2, 0.4, 0].map((v) => ({ value: v as 0 | 0.4 | 2, label: v ? `${v} ${mm}` : t('edge.0') }))}
            onChange={(v) => patch({ edge: { ...w.edge, visible: v } })}
          />
          <Select
            label={t('right.edgeHidden')}
            value={w.edge.hidden}
            options={[0.4, 2, 0].map((v) => ({ value: v as 0 | 0.4 | 2, label: v ? `${v} ${mm}` : t('edge.0') }))}
            onChange={(v) => patch({ edge: { ...w.edge, hidden: v } })}
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Select<HingeType> label={t('right.hinge')} help={t('help.hinge')} value={w.hinge} options={(['overlay', 'half-overlay', 'inset'] as const).map((v) => ({ value: v, label: t(`hinge.${v}`) }))} onChange={(hinge) => patch({ hinge })} />
          <Select<SlideType>
            label={t('right.slide')}
            help={t('help.slide')}
            value={w.defaultSlide}
            options={(['roller', 'ball', 'tandem'] as const).map((v) => ({ value: v, label: t(`slide.${v}`) }))}
            onChange={(defaultSlide) => patch({ defaultSlide })}
          />
        </div>
        <MaterialPicker label={t('right.bodyMat')} value={w.bodyMaterial} materials={bodyMaterials()} onChange={(id) => patch({ bodyMaterial: id })} />
        {w.type !== 'built-in' && (
          <MaterialPicker label={t('right.backMat')} value={w.backMaterial} materials={backMaterials()} onChange={(id) => patch({ backMaterial: id })} />
        )}
        <button type="button" className="btn" onClick={addSection}>
          + {t('right.addSection')}
        </button>
      </Group>

      {w.type === 'corner' && w.corner && (
        <Group title={t('corner.title')}>
          <Segmented
            label={t('corner.side')}
            value={w.corner.side}
            options={(['left', 'right'] as const).map((v) => ({ value: v, label: t(`corner.${v}`) }))}
            onChange={(side) => setCorner({ side })}
          />
          <div className="grid grid-cols-2 gap-2">
            <DimensionInput
              label={t('corner.width')}
              value={w.corner.width}
              min={w.depth + 300}
              max={LIMITS.width.max}
              step={10}
              unit={mm}
              onCommit={(v) => setCorner({ width: Math.round(v) })}
            />
            {w.doors.kind !== 'none' && (
              <DimensionInput
                label={t('corner.doors')}
                value={w.corner.doorCount}
                min={w.doors.kind === 'sliding' ? 2 : 1}
                max={w.doors.kind === 'sliding' ? 3 : 8}
                unit=""
                onCommit={(v) => setCorner({ doorCount: Math.round(v) })}
              />
            )}
          </div>
          <button
            type="button"
            className="btn"
            onClick={() => {
              setWing('corner');
              setView('front');
            }}
          >
            ✎ {t('corner.edit')}
          </button>
        </Group>
      )}

      <Group title={t('right.doors')}>
        <Select<DoorKind>
          label={t('right.doorKind')}
          help={t('help.sliding')}
          value={w.doors.kind}
          options={doorKinds.map((v) => ({ value: v, label: t(`door.${v}`) }))}
          onChange={(kind) => setDoors({ kind, count: kind === 'sliding' ? Math.min(3, Math.max(2, w.doors.count)) : w.doors.count })}
        />
        {w.doors.kind !== 'none' && (
          <>
            {w.doors.kind === 'sliding' ? (
              <Segmented label={t('right.doorCount')} value={w.doors.count} options={[2, 3].map((v) => ({ value: v, label: String(v) }))} onChange={(count) => setDoors({ count })} />
            ) : (
              <DimensionInput label={t('right.doorCount')} value={w.doors.count} min={1} max={10} unit="" onCommit={(v) => setDoors({ count: Math.round(v) })} />
            )}
            {w.doors.kind !== 'sliding' && (
              <div className="grid grid-cols-2 gap-2">
                <DimensionInput label={t('right.gap')} help={t('help.gap')} value={w.doors.gap} min={LIMITS.gap.min} max={LIMITS.gap.max} step={0.5} unit={mm} onCommit={(gap) => setDoors({ gap })} />
                <Select<HandleType>
                  label={t('right.handle')}
                  help={t('help.push')}
                  value={w.doors.handle}
                  options={(['bar', 'knob', 'push'] as const).map((v) => ({ value: v, label: t(`handle.${v}`) }))}
                  onChange={(handle) => setDoors({ handle })}
                />
              </div>
            )}
            <MaterialPicker label={t('right.doorMat')} value={w.doors.material} materials={facadeMaterials()} onChange={(id) => setDoors({ material: id, overrides: [] })} />
          </>
        )}
      </Group>
    </div>
  );
}

const KIND_KEY: Record<SectionItem['kind'], MessageKey> = {
  shelf: 'item.shelf',
  drawer: 'item.drawer',
  rod: 'item.rod',
  basket: 'item.basket',
  pantograph: 'item.pantograph',
};

function ItemProps({ sectionId, item }: { sectionId: string; item: SectionItem }) {
  const t = useT();
  const w = useWardrobe((s) => s.wardrobe);
  const updateItem = useWardrobe((s) => s.updateItem);
  const removeItem = useWardrobe((s) => s.removeItem);
  const duplicateItem = useWardrobe((s) => s.duplicateItem);
  const inner = carcassDims(w).innerHeight;
  const mm = t('mm');
  return (
    <div className="flex flex-col gap-3">
      <DimensionInput label={t('right.itemY')} value={item.y} min={0} max={inner} step={10} unit={mm} onCommit={(y) => updateItem(sectionId, item.id, { y })} />
      {(item.kind === 'drawer' || item.kind === 'basket') && (
        <DimensionInput label={t('right.itemH')} value={item.height} min={80} max={600} step={10} unit={mm} onCommit={(height) => updateItem(sectionId, item.id, { height })} />
      )}
      {item.kind === 'drawer' && (
        <Select<SlideType>
          label={t('right.slide')}
          value={item.slide}
          options={(['roller', 'ball', 'tandem'] as const).map((v) => ({ value: v, label: t(`slide.${v}`) }))}
          onChange={(slide) => updateItem(sectionId, item.id, { slide })}
        />
      )}
      {item.kind === 'shelf' && (
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" className="h-4 w-4 accent-blue-600" checked={!!item.fixed} onChange={(e) => updateItem(sectionId, item.id, { fixed: e.target.checked })} />
          {t('right.fixed')}
        </label>
      )}
      <div className="flex gap-2">
        <button type="button" className="btn flex-1" onClick={() => duplicateItem(sectionId, item.id)}>
          {t('right.duplicate')} <kbd className="kbd">Ctrl+D</kbd>
        </button>
        <button type="button" className="btn btn-danger flex-1" onClick={() => removeItem(sectionId, item.id)}>
          {t('right.delete')} <kbd className="kbd">Del</kbd>
        </button>
      </div>
    </div>
  );
}

function SectionProps({ sectionId }: { sectionId: string }) {
  const t = useT();
  const w = useWardrobe((s) => s.wardrobe);
  const select = useWardrobe((s) => s.select);
  const addItem = useWardrobe((s) => s.addItem);
  const setSectionWidth = useWardrobe((s) => s.setSectionWidth);
  const splitSection = useWardrobe((s) => s.splitSection);
  const removeSection = useWardrobe((s) => s.removeSection);
  const wing = sectionWing(w, sectionId) ?? 'main';
  const owner = useMemo(() => activeWardrobe(w, wing), [w, wing]);
  const section = owner.sections.find((s) => s.id === sectionId);
  const layout = useMemo(() => layoutSections(owner), [owner]);
  if (!section) return null;
  const sl = layout.find((l) => l.id === sectionId)!;
  const kinds: (SectionItem['kind'] | 'fixedShelf')[] = ['shelf', 'fixedShelf', 'drawer', 'rod', 'basket', 'pantograph'];
  return (
    <div className="flex flex-col gap-3">
      <DimensionInput
        label={t('right.sectionWidth')}
        value={sl.width}
        min={LIMITS.sectionWidth.min}
        max={LIMITS.sectionWidth.max}
        step={10}
        unit={t('mm')}
        disabled={owner.sections.length < 2}
        onCommit={(v) => setSectionWidth(sectionId, v)}
      />
      <div>
        <div className="mb-1 text-xs text-slate-500 dark:text-slate-400">{t('right.items')}</div>
        {section.items.length === 0 ? (
          <p className="text-xs text-slate-500">{t('right.empty')}</p>
        ) : (
          <ul className="flex flex-col divide-y divide-slate-100 rounded-md border border-slate-200 text-sm dark:divide-slate-800 dark:border-slate-700">
            {sortItems(section.items)
              .reverse()
              .map((it) => (
                <li key={it.id}>
                  <button
                    type="button"
                    className="flex w-full justify-between px-2 py-1 text-left hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:hover:bg-slate-800"
                    onClick={() => select({ type: 'item', sectionId, itemId: it.id })}
                  >
                    <span>{it.kind === 'shelf' && it.fixed ? t('item.fixedShelf') : t(KIND_KEY[it.kind])}</span>
                    <span className="tabular-nums text-slate-500">{it.y}</span>
                  </button>
                </li>
              ))}
          </ul>
        )}
      </div>
      <div className="flex flex-wrap gap-1">
        {kinds.map((k) => (
          <button key={k} type="button" className="chip" onClick={() => addItem(sectionId, k)}>
            + {t(k === 'fixedShelf' ? 'item.fixedShelf' : KIND_KEY[k])}
          </button>
        ))}
      </div>
      <div className="flex gap-2">
        <button type="button" className="btn flex-1" onClick={() => splitSection(sectionId)}>
          {t('right.split')}
        </button>
        <button type="button" className="btn btn-danger flex-1" disabled={owner.sections.length < 2} onClick={() => removeSection(sectionId)}>
          {t('right.removeSection')}
        </button>
      </div>
    </div>
  );
}

function DoorProps({ index }: { index: number }) {
  const t = useT();
  const w = useWardrobe((s) => s.wardrobe);
  const setDoors = useWardrobe((s) => s.setDoors);
  const door = allDoors(w)[index];
  if (!door) return null;
  const override = w.doors.overrides[index] ?? null;
  const setOverride = (id: string | null) => {
    const overrides = [...w.doors.overrides];
    while (overrides.length <= index) overrides.push(null);
    overrides[index] = id;
    setDoors({ overrides });
  };
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm tabular-nums text-slate-600 dark:text-slate-300">
        {door.width} × {door.height} × {door.thickness} {t('mm')}
      </p>
      <MaterialPicker
        label={t('right.doorOwnMat')}
        value={override ?? w.doors.material}
        materials={facadeMaterials()}
        onChange={(id) => setOverride(id)}
        allowNone={{ label: t('right.sameAsAll'), selected: override === null, onSelect: () => setOverride(null) }}
      />
    </div>
  );
}

function DividerProps({ index, wing }: { index: number; wing: boolean }) {
  const t = useT();
  const w = useWardrobe((s) => s.wardrobe);
  const moveDivider = useWardrobe((s) => s.moveDivider);
  const s = (wing ? (w.corner?.sections ?? []) : w.sections)[index];
  if (!s) return null;
  return (
    <DimensionInput
      label={t('right.dividerPos')}
      value={s.width}
      min={LIMITS.sectionWidth.min}
      step={10}
      unit={t('mm')}
      onCommit={(v) => moveDivider(index, v, true, wing ? 'corner' : 'main')}
    />
  );
}

export function RightPanel() {
  const t = useT();
  const w = useWardrobe((s) => s.wardrobe);
  const sel = useWardrobe((s) => s.selection);
  const select = useWardrobe((s) => s.select);
  const found = findSelectedItem(w, sel);

  let title = t('right.carcass');
  let body: React.ReactNode = <CarcassProps />;
  if (found) {
    const it = found.item;
    title = `${found.wing ? `${t('corner.wingShort')} · ` : ''}${t('right.section', { n: found.index + 1 })} · ${it.kind === 'shelf' && it.fixed ? t('item.fixedShelf') : t(KIND_KEY[it.kind])}`;
    body = <ItemProps sectionId={found.section.id} item={it} />;
  } else if (sel?.type === 'section') {
    const inWing = sectionWing(w, sel.sectionId) === 'corner';
    const list = inWing ? (w.corner?.sections ?? []) : w.sections;
    const idx = list.findIndex((s) => s.id === sel.sectionId);
    if (idx >= 0) {
      title = `${inWing ? `${t('corner.wingShort')} · ` : ''}${t('right.section', { n: idx + 1 })}`;
      body = <SectionProps sectionId={sel.sectionId} />;
    }
  } else if (sel?.type === 'door') {
    title = t('right.door', { n: sel.index + 1 });
    body = <DoorProps index={sel.index} />;
  } else if (sel?.type === 'divider') {
    title = t('right.divider', { n: sel.index + 1 });
    body = <DividerProps index={sel.index} wing={!!sel.wing} />;
    if (sel.wing) title = `${t('corner.wingShort')} · ${title}`;
  }
  const nested = sel && sel.type !== 'carcass';
  const parentSection = found ? found.section.id : null;

  return (
    <aside className="flex h-full flex-col overflow-y-auto border-l border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900" aria-label={t('right.title')}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">{title}</h2>
        {nested && (
          <div className="flex gap-1">
            {parentSection && (
              <button type="button" className="chip" onClick={() => select({ type: 'section', sectionId: parentSection })}>
                ↑ {t('item.section')}
              </button>
            )}
            <button type="button" className="chip" onClick={() => select(null)}>
              {t('right.back')}
            </button>
          </div>
        )}
      </div>
      {!nested && <p className="mb-3 text-[11px] text-slate-500 dark:text-slate-400">{t('right.selectHint')}</p>}
      {body}
    </aside>
  );
}
