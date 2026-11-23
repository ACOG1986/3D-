import { useT } from '../../i18n/useT';
import type { MessageKey } from '../../i18n';
import { bodyMaterials, facadeMaterials } from '../../lib/materials';
import { useWardrobe } from '../../store/wardrobeStore';
import type { WardrobeType } from '../../types/wardrobe';
import { MaterialPicker } from '../controls/MaterialPicker';
import { HelpTip } from '../onboarding/HelpTip';
import { CATALOG, DRAG_MIME, type DragKind } from './dragKinds';

const TYPES: { type: WardrobeType; icon: string; soon?: boolean }[] = [
  { type: 'swing', icon: 'M4 3h16v18H4zM12 3v18M9 11v2M15 11v2' },
  { type: 'sliding', icon: 'M3 3h18v18H3zM3 3h10v18M11 3h10v18' },
  { type: 'combined', icon: 'M4 3h16v18H4zM12 3v18M12 13h8M12 17h8' },
  { type: 'built-in', icon: 'M2 2v20M22 2v20M2 2h20M5 4h14v18H5zM12 4v18' },
  { type: 'corner', icon: 'M3 3h18v8H11v10H3z' },
];

const ITEM_ICON: Record<DragKind, string> = {
  section: 'M4 3h16v18H4zM12 3v18',
  shelf: 'M3 11h18v2H3z',
  fixedShelf: 'M3 6h18v2H3zM3 3v5M21 3v5',
  drawer: 'M3 6h18v12H3zM9 12h6',
  rod: 'M3 9h18M5 9v-2M19 9v-2M10 9l-3 7h10l-3-7',
  basket: 'M3 8h18l-2 10H5zM8 8v10M12 8v10M16 8v10',
  pantograph: 'M4 5h16M6 5l6 8 6-8M12 13v6M8 19h8',
};

const ITEM_KEY: Record<DragKind, MessageKey> = {
  section: 'item.section',
  shelf: 'item.shelf',
  fixedShelf: 'item.fixedShelf',
  drawer: 'item.drawer',
  rod: 'item.rod',
  basket: 'item.basket',
  pantograph: 'item.pantograph',
};

const ITEM_HELP: Partial<Record<DragKind, MessageKey>> = {
  section: 'help.section',
  fixedShelf: 'help.fill',
  pantograph: 'help.pantograph',
};

function Icon({ d }: { d: string }) {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinejoin="round" aria-hidden>
      <path d={d} />
    </svg>
  );
}

export function LeftPanel() {
  const t = useT();
  const w = useWardrobe((s) => s.wardrobe);
  const selection = useWardrobe((s) => s.selection);
  const applyTemplate = useWardrobe((s) => s.applyTemplate);
  const addItem = useWardrobe((s) => s.addItem);
  const splitSection = useWardrobe((s) => s.splitSection);
  const addSection = useWardrobe((s) => s.addSection);
  const patch = useWardrobe((s) => s.patch);
  const setDoors = useWardrobe((s) => s.setDoors);

  /** Клик по элементу каталога — добавить в выбранную секцию (или первую). */
  const addByClick = (kind: DragKind) => {
    const sectionId =
      selection?.type === 'section' || selection?.type === 'item' ? selection.sectionId : w.sections[0]?.id;
    if (kind === 'section') {
      if (sectionId && (selection?.type === 'section' || selection?.type === 'item')) splitSection(sectionId);
      else addSection();
      return;
    }
    if (sectionId) addItem(sectionId, kind);
  };

  return (
    <aside className="flex h-full flex-col gap-5 overflow-y-auto border-r border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900" aria-label={t('left.types')}>
      <section>
        <h2 className="panel-title flex items-center gap-1.5">
          {t('left.types')} <HelpTip term={t('left.types')} text={t('help.types')} />
        </h2>
        <div className="grid grid-cols-2 gap-1.5">
          {TYPES.map(({ type, icon, soon }) => (
            <button
              key={type}
              type="button"
              title={soon ? t('v.cornerTodo') : `${t(`wiz.type.${type}`)} ${t('left.typeHint')}`}
              onClick={() => applyTemplate(type)}
              aria-pressed={w.type === type}
              className={`flex min-w-0 items-center gap-1.5 rounded-md border px-1.5 py-2 text-left text-[11px] font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                w.type === type
                  ? 'border-blue-600 bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300'
                  : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800'
              }`}
            >
              <Icon d={icon} />
              <span className="min-w-0 break-words leading-tight [hyphens:auto]">
                {t(`type.${type}`)}
                {soon && <span className="block text-[10px] font-normal text-slate-400">{t('left.soon')}</span>}
              </span>
            </button>
          ))}
        </div>
      </section>

      <section>
        <h2 className="panel-title flex items-center gap-1.5">
          {t('left.fill')} <HelpTip term={t('left.fill')} text={t('help.fill')} />
        </h2>
        <p className="mb-2 text-[11px] leading-snug text-slate-500 dark:text-slate-400">{t('left.fillHint')}</p>
        <ul className="flex flex-col gap-1">
          {CATALOG.map((kind) => (
            <li key={kind} className="flex items-center gap-1.5">
              <button
                type="button"
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData(DRAG_MIME, kind);
                  e.dataTransfer.setData('text/plain', kind);
                  e.dataTransfer.effectAllowed = 'copy';
                }}
                onClick={() => addByClick(kind)}
                className="flex min-w-0 flex-1 cursor-grab items-center gap-2 rounded-md border border-dashed border-slate-300 bg-slate-50 px-2 py-1.5 text-sm hover:border-blue-500 hover:bg-blue-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 active:cursor-grabbing dark:border-slate-700 dark:bg-slate-800/60 dark:hover:bg-slate-800"
              >
                <Icon d={ITEM_ICON[kind]} />
                {t(ITEM_KEY[kind])}
                <span aria-hidden className="ml-auto text-slate-300 dark:text-slate-600">⠿</span>
              </button>
              {ITEM_HELP[kind] && <HelpTip term={t(ITEM_KEY[kind])} text={t(ITEM_HELP[kind]!)} align="right" />}
            </li>
          ))}
        </ul>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="panel-title flex items-center gap-1.5">
          {t('left.materials')} <HelpTip term={t('left.materials')} text={t('help.ldsp')} />
        </h2>
        <MaterialPicker label={t('left.body')} value={w.bodyMaterial} materials={bodyMaterials()} onChange={(id) => patch({ bodyMaterial: id })} />
        <MaterialPicker
          label={t('left.facades')}
          value={w.doors.material}
          materials={facadeMaterials()}
          onChange={(id) => setDoors({ material: id, overrides: [] })}
        />
      </section>
    </aside>
  );
}
