import { create } from 'zustand';
import type { Lang } from '../i18n';
import {
  addSection as addSectionFn,
  clampItemY,
  createItem,
  createWardrobe,
  findFreeY,
  moveDivider as moveDividerFn,
  normalizeWardrobe,
  removeSection as removeSectionFn,
  setSectionWidth as setSectionWidthFn,
  sectionWing,
  splitSection as splitSectionFn,
  uid,
  updateWing,
  wingWardrobe,
} from '../lib/geometry';
import { saveProject } from '../lib/projects';
import type { CornerConfig, DoorsConfig, EntityRef, Section, SectionItem, SectionItemKind, Wardrobe, WardrobeType } from '../types/wardrobe';

export type ViewMode = '3d' | 'front' | 'top' | 'drawing';
export type CameraPreset = 'iso' | 'front' | 'top';
export type Theme = 'light' | 'dark';

const HISTORY_LIMIT = 100;
const PREFS_KEY = 'wardrobe.prefs.v1';

interface Prefs {
  theme: Theme;
  lang: Lang;
}

function loadPrefs(): Prefs {
  const fallbackLang: Lang =
    typeof navigator !== 'undefined' && navigator.language?.startsWith('lt')
      ? 'lt'
      : typeof navigator !== 'undefined' && navigator.language?.startsWith('en')
        ? 'en'
        : 'ru';
  const fallback: Prefs = {
    theme: typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light',
    lang: fallbackLang,
  };
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (!raw) return fallback;
    const p = JSON.parse(raw) as Partial<Prefs>;
    return {
      theme: p.theme === 'dark' || p.theme === 'light' ? p.theme : fallback.theme,
      lang: p.lang === 'ru' || p.lang === 'lt' || p.lang === 'en' ? p.lang : fallback.lang,
    };
  } catch {
    return fallback;
  }
}

function savePrefs(p: Prefs) {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(p));
  } catch {
    /* приватный режим — не критично */
  }
}

export interface WardrobeState {
  wardrobe: Wardrobe;
  past: Wardrobe[];
  future: Wardrobe[];
  saveState: 'saved' | 'saving' | 'error';
  savedAt: number | null;

  view: ViewMode;
  selection: EntityRef | null;
  explode: boolean;
  showDoors: boolean;
  showDims: boolean;
  camera: { preset: CameraPreset; nonce: number };
  sheet: number;
  /** Какое крыло углового шкафа редактируется в 2D. */
  wing: 'main' | 'corner';
  theme: Theme;
  lang: Lang;

  load: (w: Wardrobe) => void;
  /** Изменение модели. history=false — без записи в историю (для жестов перетаскивания). */
  update: (fn: (w: Wardrobe) => Wardrobe, opts?: { history?: boolean }) => void;
  /** Начало жеста: один снимок в историю, дальше update(..., {history:false}). */
  beginGesture: () => void;
  undo: () => void;
  redo: () => void;

  patch: (p: Partial<Wardrobe>) => void;
  setDoors: (p: Partial<DoorsConfig>) => void;
  setCorner: (p: Partial<CornerConfig>) => void;
  /** Изменение габаритов активного крыла (ширина бокового крыла пишется в corner). */
  patchActive: (p: Partial<Pick<Wardrobe, 'width' | 'height' | 'depth'>>) => void;
  setWing: (wing: 'main' | 'corner') => void;
  applyTemplate: (type: WardrobeType) => void;
  addSection: () => void;
  splitSection: (id: string) => void;
  removeSection: (id: string) => void;
  setSectionWidth: (id: string, width: number) => void;
  moveDivider: (index: number, leftWidth: number, history?: boolean, wing?: 'main' | 'corner') => void;
  addItem: (sectionId: string, kind: SectionItemKind | 'fixedShelf', y?: number) => string | null;
  updateItem: (sectionId: string, itemId: string, p: Partial<SectionItem>, history?: boolean) => void;
  removeItem: (sectionId: string, itemId: string) => void;
  duplicateItem: (sectionId: string, itemId: string) => void;
  removeSelected: () => void;

  select: (ref: EntityRef | null) => void;
  setView: (v: ViewMode) => void;
  setCamera: (preset: CameraPreset) => void;
  toggle: (k: 'explode' | 'showDoors' | 'showDims') => void;
  setSheet: (n: number) => void;
  setTheme: (t: Theme) => void;
  setLang: (l: Lang) => void;
  markSaved: (ok: boolean) => void;
}

const prefs = loadPrefs();

function mapSection(w: Wardrobe, id: string, fn: (s: Section) => Section): Wardrobe {
  const map = (list: Section[]) => list.map((s) => (s.id === id ? fn(s) : s));
  return { ...w, sections: map(w.sections), corner: w.corner ? { ...w.corner, sections: map(w.corner.sections) } : w.corner };
}

function findSection(w: Wardrobe, id: string): Section | undefined {
  return w.sections.find((s) => s.id === id) ?? w.corner?.sections.find((s) => s.id === id);
}

/** Применяет операцию к тому крылу, где находится секция. */
function onSectionWing(w: Wardrobe, sectionId: string, fn: (x: Wardrobe) => Wardrobe): Wardrobe {
  return sectionWing(w, sectionId) === 'corner' ? updateWing(w, fn) : fn(w);
}

export const useWardrobe = create<WardrobeState>((set, get) => ({
  wardrobe: createWardrobe('swing'),
  past: [],
  future: [],
  saveState: 'saved',
  savedAt: null,

  view: '3d',
  selection: null,
  explode: false,
  showDoors: true,
  showDims: true,
  camera: { preset: 'iso', nonce: 0 },
  sheet: 1,
  wing: 'main',
  theme: prefs.theme,
  lang: prefs.lang,

  load: (w) => set({ wardrobe: normalizeWardrobe(w), past: [], future: [], selection: null, wing: 'main', saveState: 'saved', savedAt: w.updatedAt }),

  update: (fn, opts) => {
    const cur = get().wardrobe;
    const next = normalizeWardrobe(fn(cur));
    if (next === cur) return;
    next.updatedAt = Date.now();
    if (opts?.history === false) set({ wardrobe: next, saveState: 'saving' });
    else set({ wardrobe: next, past: [...get().past, cur].slice(-HISTORY_LIMIT), future: [], saveState: 'saving' });
  },

  beginGesture: () => set({ past: [...get().past, get().wardrobe].slice(-HISTORY_LIMIT), future: [] }),

  undo: () => {
    const { past, wardrobe, future } = get();
    const prev = past[past.length - 1];
    if (!prev) return;
    set({ wardrobe: prev, past: past.slice(0, -1), future: [wardrobe, ...future], saveState: 'saving' });
  },

  redo: () => {
    const { past, wardrobe, future } = get();
    const next = future[0];
    if (!next) return;
    set({ wardrobe: next, past: [...past, wardrobe], future: future.slice(1), saveState: 'saving' });
  },

  patch: (p) => get().update((w) => ({ ...w, ...p })),
  setDoors: (p) => get().update((w) => ({ ...w, doors: { ...w.doors, ...p } })),
  setCorner: (p) => get().update((w) => (w.corner ? { ...w, corner: { ...w.corner, ...p } } : w)),
  patchActive: (p) => {
    if (get().wing === 'corner' && get().wardrobe.corner) {
      get().update((w) => updateWing(w, (x) => ({ ...x, ...p })));
    } else get().patch(p);
  },
  setWing: (wing) => set({ wing }),

  applyTemplate: (type) =>
    get().update((w) => {
      const tpl = createWardrobe(type, w.name);
      return { ...tpl, id: w.id, name: w.name, createdAt: w.createdAt, bodyMaterial: w.bodyMaterial };
    }),

  addSection: () => get().update((w) => addSectionFn(w)),
  splitSection: (id) => get().update((w) => onSectionWing(w, id, (x) => splitSectionFn(x, id))),
  removeSection: (id) => {
    get().update((w) => onSectionWing(w, id, (x) => removeSectionFn(x, id)));
    set({ selection: { type: 'carcass' } });
  },
  setSectionWidth: (id, width) => get().update((w) => onSectionWing(w, id, (x) => setSectionWidthFn(x, id, width))),
  moveDivider: (index, leftWidth, history = true, wing = get().wing) =>
    get().update((w) => (wing === 'corner' && w.corner ? updateWing(w, (x) => moveDividerFn(x, index, leftWidth)) : moveDividerFn(w, index, leftWidth)), {
      history,
    }),

  addItem: (sectionId, kind, y) => {
    const w = get().wardrobe;
    const section = findSection(w, sectionId);
    if (!section) return null;
    const realKind: SectionItemKind = kind === 'fixedShelf' ? 'shelf' : kind;
    const base = createItem(realKind, 0, w.defaultSlide);
    if (kind === 'fixedShelf' && base.kind === 'shelf') base.fixed = true;
    const desired = y ?? defaultY(w, realKind);
    const item = { ...base, y: findFreeY(w, section, base, desired) } as SectionItem;
    get().update((m) => mapSection(m, sectionId, (s) => ({ ...s, items: [...s.items, item] })));
    set({ selection: { type: 'item', sectionId, itemId: item.id } });
    return item.id;
  },

  updateItem: (sectionId, itemId, p, history = true) =>
    get().update(
      (w) =>
        mapSection(w, sectionId, (s) => ({
          ...s,
          items: s.items.map((it) => {
            if (it.id !== itemId) return it;
            const merged = { ...it, ...p } as SectionItem;
            if (p.y !== undefined) merged.y = clampItemY(w, merged, p.y, false);
            return merged;
          }),
        })),
      { history },
    ),

  removeItem: (sectionId, itemId) => {
    get().update((w) => mapSection(w, sectionId, (s) => ({ ...s, items: s.items.filter((i) => i.id !== itemId) })));
    set({ selection: { type: 'section', sectionId } });
  },

  duplicateItem: (sectionId, itemId) => {
    const w = get().wardrobe;
    const section = findSection(w, sectionId);
    const item = section?.items.find((i) => i.id === itemId);
    if (!section || !item) return;
    const copy = { ...item, id: uid(item.kind) } as SectionItem;
    copy.y = findFreeY(w, section, copy, item.y + 300);
    get().update((m) => mapSection(m, sectionId, (s) => ({ ...s, items: [...s.items, copy] })));
    set({ selection: { type: 'item', sectionId, itemId: copy.id } });
  },

  removeSelected: () => {
    const sel = get().selection;
    if (!sel) return;
    if (sel.type === 'item') get().removeItem(sel.sectionId, sel.itemId);
    else if (sel.type === 'section') get().removeSection(sel.sectionId);
    else if (sel.type === 'divider') {
      const w = get().wardrobe;
      const list = sel.wing ? (w.corner?.sections ?? []) : w.sections;
      const s = list[sel.index + 1];
      if (s) get().removeSection(s.id);
    }
  },

  select: (ref) => set({ selection: ref }),
  setView: (v) => set({ view: v }),
  setCamera: (preset) => set({ camera: { preset, nonce: get().camera.nonce + 1 } }),
  toggle: (k) => set({ [k]: !get()[k] } as Pick<WardrobeState, typeof k>),
  setSheet: (n) => set({ sheet: n }),
  setTheme: (theme) => {
    set({ theme });
    savePrefs({ theme, lang: get().lang });
  },
  setLang: (lang) => {
    set({ lang });
    savePrefs({ theme: get().theme, lang });
  },
  markSaved: (ok) => set({ saveState: ok ? 'saved' : 'error', savedAt: ok ? Date.now() : get().savedAt }),
}));

function defaultY(w: Wardrobe, kind: SectionItemKind): number {
  const inner = w.height - (w.plinth.enabled ? w.plinth.height : 0) - 2 * w.boardThickness;
  switch (kind) {
    case 'drawer':
    case 'basket':
      return 0;
    case 'rod':
      return inner - 400;
    case 'pantograph':
      return inner - 150;
    case 'shelf':
      return Math.round(inner / 2);
  }
}

/* Автосохранение: дебаунс 600 мс после изменения модели. */
let saveTimer: ReturnType<typeof setTimeout> | undefined;
useWardrobe.subscribe((state, prev) => {
  if (state.wardrobe === prev.wardrobe) return;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    const ok = saveProject(useWardrobe.getState().wardrobe);
    useWardrobe.getState().markSaved(ok);
  }, 600);
});

/* Селекторы-хелперы */
export function findSelectedItem(
  w: Wardrobe,
  sel: EntityRef | null,
): { section: Section; item: SectionItem; index: number; wing: boolean } | null {
  if (!sel || sel.type !== 'item') return null;
  for (const [list, wing] of [
    [w.sections, false],
    [w.corner?.sections ?? [], true],
  ] as const) {
    const index = list.findIndex((s) => s.id === sel.sectionId);
    const section = list[index];
    const item = section?.items.find((i) => i.id === sel.itemId);
    if (section && item) return { section, item, index, wing };
  }
  return null;
}

/** Модель активного крыла для 2D-редактора (мемоизируется по модели и крылу). */
let activeCache: { w: Wardrobe; wing: string; out: Wardrobe } | null = null;
export function useActiveWardrobe(): Wardrobe {
  const w = useWardrobe((s) => s.wardrobe);
  const wing = useWardrobe((s) => s.wing);
  if (activeCache && activeCache.w === w && activeCache.wing === wing) return activeCache.out;
  const out = wing === 'corner' ? (wingWardrobe(w) ?? w) : w;
  activeCache = { w, wing, out };
  return out;
}

export function sameRef(a: EntityRef | null, b: EntityRef | null): boolean {
  if (!a || !b) return false;
  return JSON.stringify(a) === JSON.stringify(b);
}
