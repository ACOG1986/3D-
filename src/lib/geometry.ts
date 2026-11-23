/**
 * Геометрия шкафа: из модели Wardrobe рассчитываются детали (Panel[]),
 * двери, спецификация, фурнитура, раскрой и валидация.
 * Все функции чистые — их результат зависит только от входной модели.
 */
import type {
  BasketItem,
  Door,
  DrawerItem,
  EdgeThickness,
  EntityRef,
  MessageParams,
  Panel,
  PartEdges,
  PartGroup,
  PartName,
  Section,
  SectionItem,
  SectionItemKind,
  SectionLayout,
  SlideType,
  SpecRow,
  Unit,
  ValidationIssue,
  Wardrobe,
  WardrobeType,
} from '../types/wardrobe';
import { getMaterial, isSheetGoods } from './materials';

/* ------------------------------------------------------------------ */
/* Константы                                                            */
/* ------------------------------------------------------------------ */

export const SNAP_STEP = 10;
export const LIMITS = {
  width: { min: 300, max: 4000 },
  height: { min: 300, max: 2800 },
  depth: { min: 250, max: 900 },
  sectionWidth: { min: 150, max: 1200 },
  plinth: { min: 50, max: 150 },
  gap: { min: 1, max: 6 },
} as const;
/** Максимальная длина полки без опоры, мм. */
export const SHELF_MAX_UNSUPPORTED = 900;
/** Глубина зоны дверей-купе (направляющие), мм. */
export const SLIDING_ZONE = 100;
/** Перекрытие соседних дверей-купе, мм. */
export const SLIDING_OVERLAP = 30;
/** Зазор по высоте для механизма купе (верхняя+нижняя направляющие), мм. */
export const SLIDING_HEIGHT_CLEARANCE = 40;
/** Отступ съёмной полки от фасадной кромки корпуса, мм. */
export const SHELF_FRONT_SETBACK = 10;
/** Стандартные длины направляющих ящиков, мм. */
export const SLIDE_LENGTHS = [250, 300, 350, 400, 450, 500, 550, 600, 650] as const;
export const SHEET = { length: 2750, width: 1830, kerf: 4, trim: 10 } as const;

/* ------------------------------------------------------------------ */
/* Утилиты                                                              */
/* ------------------------------------------------------------------ */

let idCounter = 0;
export function uid(prefix = 'id'): string {
  idCounter += 1;
  const rnd = Math.random().toString(36).slice(2, 8);
  return `${prefix}_${Date.now().toString(36)}${idCounter.toString(36)}${rnd}`;
}

export function snap(value: number, step: number = SNAP_STEP): number {
  return Math.round(value / step) * step;
}

export function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

const round1 = (v: number) => Math.round(v * 10) / 10;

/* ------------------------------------------------------------------ */
/* Производные размеры корпуса                                          */
/* ------------------------------------------------------------------ */

export interface CarcassDims {
  t: number;
  bt: number;
  plinthH: number;
  /** Глубина корпуса без накладных фасадов. */
  carcassDepth: number;
  /** Глубина боковин, крыши, дна (без задней стенки). */
  panelDepth: number;
  /** Глубина внутреннего пространства (перегородки, полки). */
  interiorDepth: number;
  innerWidth: number;
  innerHeight: number;
  /** Отметка верха дна (низ внутреннего пространства). */
  innerBottom: number;
  hasBack: boolean;
  hasTop: boolean;
  overlayDoors: boolean;
  slidingDoors: boolean;
}

export function carcassDims(w: Wardrobe): CarcassDims {
  const t = w.boardThickness;
  const builtIn = w.type === 'built-in';
  const hasBack = !builtIn;
  const bt = hasBack ? w.backThickness : 0;
  const plinthH = w.plinth.enabled ? w.plinth.height : 0;
  const overlayDoors = w.doors.kind === 'swing' || w.doors.kind === 'lift';
  const slidingDoors = w.doors.kind === 'sliding';
  const carcassDepth = w.depth - (overlayDoors ? t + 2 : 0);
  const panelDepth = carcassDepth - bt;
  const interiorDepth = panelDepth - (slidingDoors ? SLIDING_ZONE : 0);
  return {
    t,
    bt,
    plinthH,
    carcassDepth,
    panelDepth,
    interiorDepth,
    innerWidth: w.width - 2 * t,
    innerHeight: w.height - plinthH - 2 * t,
    innerBottom: plinthH + t,
    hasBack,
    hasTop: true,
    overlayDoors,
    slidingDoors,
  };
}

/* ------------------------------------------------------------------ */
/* Секции                                                               */
/* ------------------------------------------------------------------ */

/** Суммарная ширина, доступная секциям (внутренняя ширина минус перегородки). */
export function availableSectionsWidth(w: Wardrobe, count = w.sections.length): number {
  const { innerWidth, t } = carcassDims(w);
  return innerWidth - Math.max(0, count - 1) * t;
}

/**
 * Пропорционально подгоняет ширины секций к доступной ширине.
 * Округление до 1 мм, остаток отдаётся последней секции.
 */
export function fitSectionWidths(widths: number[], available: number): number[] {
  if (widths.length === 0) return [];
  const sum = widths.reduce((a, b) => a + b, 0);
  if (Math.abs(sum - available) < 0.5) return widths.map((x) => Math.round(x));
  const k = sum > 0 ? available / sum : 0;
  const out = widths.map((x) => (sum > 0 ? Math.round(x * k) : Math.round(available / widths.length)));
  const diff = Math.round(available) - out.reduce((a, b) => a + b, 0);
  out[out.length - 1] += diff;
  return out;
}

export function layoutSections(w: Wardrobe): SectionLayout[] {
  const { t } = carcassDims(w);
  const widths = fitSectionWidths(
    w.sections.map((s) => s.width),
    availableSectionsWidth(w),
  );
  let x = t;
  return w.sections.map((s, index) => {
    const l: SectionLayout = { id: s.id, index, x, width: widths[index] };
    x += widths[index] + t;
    return l;
  });
}

/** Возвращает модель с нормализованными ширинами секций и подрезанным наполнением. */
export function normalizeWardrobe(w: Wardrobe): Wardrobe {
  const widths = fitSectionWidths(
    w.sections.map((s) => s.width),
    availableSectionsWidth(w),
  );
  const { innerHeight, t } = carcassDims(w);
  const sections = w.sections.map((s, i) => ({
    ...s,
    width: widths[i],
    items: s.items.map((it) => {
      const ext = itemExtent(it, t);
      const maxY = Math.max(0, innerHeight - (ext.top - it.y));
      const minY = it.y - ext.bottom;
      return { ...it, y: clamp(it.y, minY, maxY) };
    }),
  }));
  const doorsCount =
    w.doors.kind === 'sliding' ? clamp(Math.round(w.doors.count), 2, 3) : Math.max(1, Math.round(w.doors.count));
  return { ...w, sections, doors: { ...w.doors, count: doorsCount } };
}

/** Делит секцию на две равные части (добавляет перегородку). */
export function splitSection(w: Wardrobe, sectionId: string): Wardrobe {
  const idx = w.sections.findIndex((s) => s.id === sectionId);
  if (idx < 0) return w;
  const s = w.sections[idx];
  const t = w.boardThickness;
  const left = Math.floor((s.width - t) / 2);
  const right = s.width - t - left;
  const a: Section = { ...s, width: left };
  const b: Section = { id: uid('sec'), width: right, items: [] };
  const sections = [...w.sections];
  sections.splice(idx, 1, a, b);
  return { ...w, sections };
}

/** Добавляет секцию справа (перераспределяя ширину поровну). */
export function addSection(w: Wardrobe, atIndex = w.sections.length): Wardrobe {
  const n = w.sections.length + 1;
  const avail = availableSectionsWidth(w, n);
  const each = avail / n;
  const sections = w.sections.map((s) => ({ ...s, width: each }));
  sections.splice(atIndex, 0, { id: uid('sec'), width: each, items: [] });
  return normalizeWardrobe({ ...w, sections });
}

export function removeSection(w: Wardrobe, sectionId: string): Wardrobe {
  if (w.sections.length <= 1) return w;
  const idx = w.sections.findIndex((s) => s.id === sectionId);
  if (idx < 0) return w;
  const removed = w.sections[idx];
  const sections = w.sections.filter((s) => s.id !== sectionId);
  const neighbour = Math.min(idx, sections.length - 1);
  sections[neighbour] = {
    ...sections[neighbour],
    width: sections[neighbour].width + removed.width + w.boardThickness,
  };
  return normalizeWardrobe({ ...w, sections });
}

/**
 * Перемещает перегородку с индексом i (между секциями i и i+1).
 * delta > 0 — вправо. Секции не уже минимальной.
 */
export function moveDivider(w: Wardrobe, index: number, newLeftWidth: number): Wardrobe {
  const a = w.sections[index];
  const b = w.sections[index + 1];
  if (!a || !b) return w;
  const total = a.width + b.width;
  const min = LIMITS.sectionWidth.min;
  const left = clamp(Math.round(newLeftWidth), min, total - min);
  const sections = [...w.sections];
  sections[index] = { ...a, width: left };
  sections[index + 1] = { ...b, width: total - left };
  return { ...w, sections };
}

/** Устанавливает ширину секции, компенсируя соседней справа (или слева для последней). */
export function setSectionWidth(w: Wardrobe, sectionId: string, width: number): Wardrobe {
  const idx = w.sections.findIndex((s) => s.id === sectionId);
  if (idx < 0) return w;
  if (w.sections.length === 1) return w;
  if (idx < w.sections.length - 1) return moveDivider(w, idx, width);
  const a = w.sections[idx - 1];
  const b = w.sections[idx];
  return moveDivider(w, idx - 1, a.width + b.width - width);
}

/* ------------------------------------------------------------------ */
/* Наполнение                                                           */
/* ------------------------------------------------------------------ */

/** Вертикальные границы, занимаемые элементом (относительно низа секции). */
export function itemExtent(item: SectionItem, t: number): { bottom: number; top: number } {
  switch (item.kind) {
    case 'shelf':
      return { bottom: item.y, top: item.y + t };
    case 'drawer':
    case 'basket':
      return { bottom: item.y, top: item.y + item.height };
    case 'rod':
      return { bottom: item.y - 15, top: item.y + 15 };
    case 'pantograph':
      return { bottom: item.y - 60, top: item.y + 40 };
  }
}

export function createItem(kind: SectionItemKind, y: number, slide: SlideType = 'ball'): SectionItem {
  const id = uid(kind);
  switch (kind) {
    case 'shelf':
      return { id, kind, y };
    case 'drawer':
      return { id, kind, y, height: 180, slide } satisfies DrawerItem;
    case 'rod':
      return { id, kind, y };
    case 'basket':
      return { id, kind, y, height: 150 } satisfies BasketItem;
    case 'pantograph':
      return { id, kind, y };
  }
}

/** Ограничивает отметку элемента внутренней высотой секции и привязывает к сетке. */
export function clampItemY(w: Wardrobe, item: SectionItem, y: number, doSnap = true): number {
  const { innerHeight, t } = carcassDims(w);
  const probe = { ...item, y: 0 } as SectionItem;
  const ext = itemExtent(probe, t);
  const minY = -ext.bottom;
  const maxY = innerHeight - ext.top;
  const v = doSnap ? snap(y) : Math.round(y);
  return clamp(v, Math.ceil(minY), Math.floor(maxY)) + 0;
}

/** Пересекаются ли элементы a и b по вертикали (штанги/пантографы не учитываются). */
export function itemsOverlap(a: SectionItem, b: SectionItem, t: number): boolean {
  const soft = (k: SectionItemKind) => k === 'rod' || k === 'pantograph';
  if (soft(a.kind) || soft(b.kind)) return false;
  const ea = itemExtent(a, t);
  const eb = itemExtent(b, t);
  return ea.bottom < eb.top && eb.bottom < ea.top;
}

/** Ищет ближайшую к желаемой свободную отметку для нового элемента. */
export function findFreeY(w: Wardrobe, section: Section, item: SectionItem, desired: number): number {
  const { t } = carcassDims(w);
  const tryAt = (y: number) => {
    const probe = { ...item, y: clampItemY(w, item, y) } as SectionItem;
    return section.items.every((o) => !itemsOverlap(probe, o, t)) ? probe.y : null;
  };
  for (let d = 0; d < 3000; d += SNAP_STEP) {
    const up = tryAt(desired + d);
    if (up !== null) return up;
    const down = tryAt(desired - d);
    if (down !== null) return down;
  }
  return clampItemY(w, item, desired);
}

export function sortItems(items: SectionItem[]): SectionItem[] {
  return [...items].sort((a, b) => a.y - b.y);
}

export function drawerSlideLength(interiorDepth: number, t: number): number {
  const max = interiorDepth - t - 20;
  let best: number = SLIDE_LENGTHS[0];
  for (const l of SLIDE_LENGTHS) if (l <= max) best = l;
  return best;
}

export function drawerBoxWidth(sectionWidth: number, slide: SlideType): number {
  return sectionWidth - (slide === 'tandem' ? 42 : 26);
}

/* ------------------------------------------------------------------ */
/* Двери                                                                */
/* ------------------------------------------------------------------ */

export function hingeCount(doorHeight: number): number {
  if (doorHeight <= 900) return 2;
  if (doorHeight <= 1600) return 3;
  if (doorHeight <= 2000) return 4;
  if (doorHeight <= 2400) return 5;
  return 6;
}

export function computeDoors(w: Wardrobe): Door[] {
  const d = carcassDims(w);
  const { doors } = w;
  if (doors.kind === 'none') return [];
  const n = doors.kind === 'sliding' ? clamp(Math.round(doors.count), 2, 3) : Math.max(1, Math.round(doors.count));
  const mat = (i: number) => doors.overrides[i] ?? doors.material;

  if (doors.kind === 'sliding') {
    const opening = d.innerWidth;
    const width = Math.round((opening + SLIDING_OVERLAP * (n - 1)) / n);
    const height = d.innerHeight - SLIDING_HEIGHT_CLEARANCE;
    const thickness = 20;
    return Array.from({ length: n }, (_, i) => {
      const x = Math.min(d.t + i * (width - SLIDING_OVERLAP), d.t + opening - width);
      const track = i % 2 === 1 ? 1 : 0;
      return {
        index: i,
        kind: 'sliding' as const,
        x,
        y: d.innerBottom + SLIDING_HEIGHT_CLEARANCE / 2,
        width,
        height,
        thickness,
        material: mat(i),
        track,
      };
    });
  }

  const gap = doors.gap;
  const width = Math.floor((w.width - n * gap) / n);
  const height = Math.floor(w.height - d.plinthH - gap);
  return Array.from({ length: n }, (_, i) => ({
    index: i,
    kind: doors.kind as 'swing' | 'lift',
    x: round1(gap / 2 + i * (width + gap)),
    y: round1(d.plinthH + gap / 2),
    width,
    height,
    thickness: d.t,
    material: mat(i),
    hingeSide: i % 2 === 0 ? ('left' as const) : ('right' as const),
  }));
}

/** Z-координата передней плоскости двери (для 3D/вида сбоку). */
export function doorZ(w: Wardrobe, door: Door): number {
  const d = carcassDims(w);
  if (door.kind === 'sliding') {
    return d.carcassDepth - SLIDING_ZONE + 20 + (door.track ?? 0) * 40;
  }
  return d.carcassDepth + 2;
}

/* ------------------------------------------------------------------ */
/* Детали                                                               */
/* ------------------------------------------------------------------ */

interface EdgeSides {
  front: EdgeThickness;
  back: EdgeThickness;
  s1: EdgeThickness;
  s2: EdgeThickness;
}

/**
 * Раскладывает кромку по торцам в терминах длины/ширины детали.
 * a — размер вдоль лицевого торца, b — поперечный.
 */
export function makeEdges(a: number, b: number, e: EdgeSides): PartEdges {
  if (a >= b) return { L1: e.front, L2: e.back, W1: e.s1, W2: e.s2 };
  return { L1: e.s1, L2: e.s2, W1: e.front, W2: e.back };
}

const NO_EDGES: PartEdges = { L1: 0, L2: 0, W1: 0, W2: 0 };

function panel(
  p: Omit<Panel, 'length' | 'widthMm' | 'thickness' | 'edges'> & {
    /** Ось толщины детали. */
    thick: 'x' | 'y' | 'z';
    /** Ось, вдоль которой идёт лицевой торец. */
    frontAlong?: 'x' | 'y' | 'z';
    edgeSides?: EdgeSides;
  },
): Panel {
  const dims = { x: p.sx, y: p.sy, z: p.sz };
  const axes = (['x', 'y', 'z'] as const).filter((a) => a !== p.thick);
  const thickness = dims[p.thick];
  const fa = p.frontAlong ?? axes[0];
  const other = axes.find((a) => a !== fa) ?? axes[1];
  const a = dims[fa];
  const b = dims[other];
  const edges = p.edgeSides ? makeEdges(a, b, p.edgeSides) : NO_EDGES;
  const { thick: _t, frontAlong: _f, edgeSides: _e, ...rest } = p;
  return {
    ...rest,
    length: round1(Math.max(a, b)),
    widthMm: round1(Math.min(a, b)),
    thickness: round1(thickness),
    edges,
  };
}

/** Рассчитывает все детали шкафа с их положением в пространстве. */
export function computePanels(w: Wardrobe): Panel[] {
  const d = carcassDims(w);
  const { t, bt, plinthH, panelDepth, interiorDepth, innerHeight, innerBottom } = d;
  const V = w.edge.visible;
  const H = w.edge.hidden;
  const body = w.bodyMaterial;
  const carcass: EntityRef = { type: 'carcass' };
  const out: Panel[] = [];

  // Боковины
  for (const [i, x] of [0, w.width - t].entries()) {
    out.push(
      panel({
        key: `side-${i}`,
        name: 'side',
        group: 'body',
        material: body,
        x,
        y: 0,
        z: bt,
        sx: t,
        sy: w.height,
        sz: panelDepth,
        thick: 'x',
        frontAlong: 'y',
        edgeSides: { front: V, back: 0, s1: H, s2: H },
        ref: carcass,
      }),
    );
  }
  // Крыша
  out.push(
    panel({
      key: 'top',
      name: 'top',
      group: 'body',
      material: body,
      x: t,
      y: w.height - t,
      z: bt,
      sx: d.innerWidth,
      sy: t,
      sz: panelDepth,
      thick: 'y',
      frontAlong: 'x',
      edgeSides: { front: V, back: 0, s1: 0, s2: 0 },
      ref: carcass,
    }),
  );
  // Дно
  out.push(
    panel({
      key: 'bottom',
      name: 'bottom',
      group: 'body',
      material: body,
      x: t,
      y: plinthH,
      z: bt,
      sx: d.innerWidth,
      sy: t,
      sz: panelDepth,
      thick: 'y',
      frontAlong: 'x',
      edgeSides: { front: V, back: 0, s1: 0, s2: 0 },
      ref: carcass,
    }),
  );
  // Цоколь
  if (w.plinth.enabled) {
    const frontZ = d.carcassDepth - 30 - t;
    out.push(
      panel({
        key: 'plinth-front',
        name: 'plinthFront',
        group: 'plinth',
        material: body,
        x: t,
        y: 0,
        z: frontZ,
        sx: d.innerWidth,
        sy: plinthH,
        sz: t,
        thick: 'z',
        frontAlong: 'x',
        edgeSides: { front: H, back: 0, s1: 0, s2: 0 },
        ref: carcass,
      }),
      panel({
        key: 'plinth-back',
        name: 'plinthBack',
        group: 'plinth',
        material: body,
        x: t,
        y: 0,
        z: bt + 50,
        sx: d.innerWidth,
        sy: plinthH,
        sz: t,
        thick: 'z',
        frontAlong: 'x',
        ref: carcass,
      }),
    );
  }
  // Задняя стенка
  if (d.hasBack) {
    out.push(
      panel({
        key: 'back',
        name: 'back',
        group: 'back',
        material: w.backMaterial,
        x: 2,
        y: plinthH + 2,
        z: 0,
        sx: w.width - 4,
        sy: w.height - plinthH - 4,
        sz: bt,
        thick: 'z',
        ref: carcass,
      }),
    );
  }

  const layout = layoutSections(w);
  // Перегородки
  layout.slice(0, -1).forEach((s, i) => {
    out.push(
      panel({
        key: `divider-${i}`,
        name: 'divider',
        group: 'body',
        material: body,
        x: s.x + s.width,
        y: innerBottom,
        z: bt,
        sx: t,
        sy: innerHeight,
        sz: interiorDepth,
        thick: 'x',
        frontAlong: 'y',
        edgeSides: { front: V, back: 0, s1: H, s2: H },
        ref: { type: 'divider', index: i },
      }),
    );
  });

  // Наполнение секций
  layout.forEach((sl) => {
    const section = w.sections[sl.index];
    for (const item of section.items) {
      out.push(...itemPanels(w, d, sl, section.id, item));
    }
  });

  // Фасады
  for (const door of computeDoors(w)) {
    const glassy = !isSheetGoods(door.material);
    const isSliding = door.kind === 'sliding';
    const e: EdgeThickness = glassy || isSliding ? 0 : V;
    out.push(
      panel({
        key: `door-${door.index}`,
        name: isSliding ? 'doorSliding' : door.kind === 'lift' ? 'doorLift' : 'doorSwing',
        group: 'facade',
        material: door.material,
        x: door.x,
        y: door.y,
        z: doorZ(w, door),
        sx: door.width,
        sy: door.height,
        sz: door.thickness,
        thick: 'z',
        edgeSides: { front: e, back: e, s1: e, s2: e },
        ref: { type: 'door', index: door.index },
      }),
    );
  }
  return out;
}

function itemPanels(w: Wardrobe, d: CarcassDims, sl: SectionLayout, sectionId: string, item: SectionItem): Panel[] {
  const { t, bt, interiorDepth, innerBottom } = d;
  const V = w.edge.visible;
  const H = w.edge.hidden;
  const ref: EntityRef = { type: 'item', sectionId, itemId: item.id };
  const y0 = innerBottom + item.y;
  const frontZ = bt + interiorDepth;

  switch (item.kind) {
    case 'shelf': {
      const fixed = !!item.fixed;
      const len = fixed ? sl.width : sl.width - 2;
      const depth = fixed ? interiorDepth : interiorDepth - SHELF_FRONT_SETBACK;
      return [
        panel({
          key: `shelf-${item.id}`,
          name: fixed ? 'shelfFixed' : 'shelfRemovable',
          group: 'body',
          material: w.bodyMaterial,
          x: sl.x + (sl.width - len) / 2,
          y: y0,
          z: bt,
          sx: len,
          sy: t,
          sz: depth,
          thick: 'y',
          frontAlong: 'x',
          edgeSides: { front: V, back: H, s1: fixed ? 0 : H, s2: fixed ? 0 : H },
          ref,
        }),
      ];
    }
    case 'drawer': {
      const L = drawerSlideLength(interiorDepth, t);
      const boxW = drawerBoxWidth(sl.width, item.slide);
      const hb = Math.max(80, item.height - 40);
      const boxX = sl.x + (sl.width - boxW) / 2;
      const boxZ = frontZ - t - L;
      const boxY = y0 + 15;
      const parts: Panel[] = [
        panel({
          key: `drawer-front-${item.id}`,
          name: 'drawerFront',
          group: 'drawer',
          material: w.bodyMaterial,
          x: sl.x + 2,
          y: y0,
          z: frontZ - t,
          sx: sl.width - 4,
          sy: item.height - 4,
          sz: t,
          thick: 'z',
          edgeSides: { front: V, back: V, s1: V, s2: V },
          ref,
        }),
      ];
      for (const [i, x] of [boxX, boxX + boxW - t].entries()) {
        parts.push(
          panel({
            key: `drawer-side-${item.id}-${i}`,
            name: 'drawerSide',
            group: 'drawer',
            material: w.bodyMaterial,
            x,
            y: boxY,
            z: boxZ,
            sx: t,
            sy: hb,
            sz: L,
            thick: 'x',
            frontAlong: 'z',
            edgeSides: { front: H, back: 0, s1: 0, s2: 0 },
            ref,
          }),
        );
      }
      for (const [i, z] of [boxZ, boxZ + L - t].entries()) {
        parts.push(
          panel({
            key: `drawer-fb-${item.id}-${i}`,
            name: 'drawerFrontBack',
            group: 'drawer',
            material: w.bodyMaterial,
            x: boxX + t,
            y: boxY,
            z,
            sx: boxW - 2 * t,
            sy: hb,
            sz: t,
            thick: 'z',
            frontAlong: 'x',
            edgeSides: { front: H, back: 0, s1: 0, s2: 0 },
            ref,
          }),
        );
      }
      parts.push(
        panel({
          key: `drawer-bottom-${item.id}`,
          name: 'drawerBottom',
          group: 'drawer',
          material: w.backMaterial,
          x: boxX,
          y: boxY - w.backThickness,
          z: boxZ,
          sx: boxW,
          sy: w.backThickness,
          sz: L,
          thick: 'y',
          ref,
        }),
      );
      return parts;
    }
    case 'rod':
      return [
        {
          key: `rod-${item.id}`,
          name: 'rod',
          group: 'body',
          material: 'rod',
          x: sl.x,
          y: y0 - 12.5,
          z: bt + interiorDepth / 2 - 12.5,
          sx: sl.width,
          sy: 25,
          sz: 25,
          length: sl.width,
          widthMm: 25,
          thickness: 25,
          edges: NO_EDGES,
          ref,
          nonBoard: true,
        },
      ];
    case 'basket':
      return [
        {
          key: `basket-${item.id}`,
          name: 'basket',
          group: 'body',
          material: 'basket',
          x: sl.x + 13,
          y: y0,
          z: bt + 20,
          sx: sl.width - 26,
          sy: item.height,
          sz: interiorDepth - 40,
          length: sl.width - 26,
          widthMm: interiorDepth - 40,
          thickness: item.height,
          edges: NO_EDGES,
          ref,
          nonBoard: true,
        },
      ];
    case 'pantograph':
      return [
        {
          key: `panto-${item.id}`,
          name: 'pantograph',
          group: 'body',
          material: 'rod',
          x: sl.x,
          y: y0 - 12.5,
          z: bt + interiorDepth / 2 - 12.5,
          sx: sl.width,
          sy: 25,
          sz: 25,
          length: sl.width,
          widthMm: 25,
          thickness: 25,
          edges: NO_EDGES,
          ref,
          nonBoard: true,
        },
      ];
  }
}

/* ------------------------------------------------------------------ */
/* Спецификация                                                         */
/* ------------------------------------------------------------------ */

const EDGE_NAMES: (keyof PartEdges)[] = ['L1', 'L2', 'W1', 'W2'];

/** Подпись торца: буквы длины/ширины зависят от языка (Д/Ш, L/W, I/P). */
export type EdgeLetters = { L: string; W: string };

/** Кромка в виде строки: «2: Д1 · 0,4: Д2 Ш1 Ш2». */
export function formatEdges(e: PartEdges, letters: EdgeLetters = { L: 'Д', W: 'Ш' }, decimal = ','): string {
  const by = new Map<number, string[]>();
  for (const k of EDGE_NAMES) {
    const v = e[k];
    if (v > 0) by.set(v, [...(by.get(v) ?? []), `${k[0] === 'L' ? letters.L : letters.W}${k[1]}`]);
  }
  if (by.size === 0) return '—';
  return [...by.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([v, names]) => `${String(v).replace('.', decimal)}: ${names.join(' ')}`)
    .join(' · ');
}

/** Длина кромки по толщинам, м (без учёта припуска). */
export function edgeTotals(panels: Panel[]): Record<string, number> {
  const res: Record<string, number> = {};
  for (const p of panels) {
    if (p.nonBoard) continue;
    for (const k of EDGE_NAMES) {
      const v = p.edges[k];
      if (v <= 0) continue;
      const len = k.startsWith('L') ? p.length : p.widthMm;
      const key = String(v);
      res[key] = (res[key] ?? 0) + len / 1000;
    }
  }
  for (const k of Object.keys(res)) res[k] = Math.round(res[k] * 100) / 100;
  return res;
}

export const GROUP_ORDER: PartGroup[] = ['body', 'plinth', 'back', 'drawer', 'facade'];

const PART_ORDER: PartName[] = [
  'side', 'top', 'bottom', 'divider', 'shelfFixed', 'shelfRemovable', 'plinthFront', 'plinthBack', 'back',
  'drawerFront', 'drawerSide', 'drawerFrontBack', 'drawerBottom', 'doorSwing', 'doorLift', 'doorSliding', 'rod', 'basket', 'pantograph',
];

export function computeSpec(panels: Panel[]): SpecRow[] {
  const map = new Map<string, SpecRow>();
  for (const p of panels) {
    if (p.nonBoard) continue;
    const e = p.edges;
    const key = [p.name, p.length, p.widthMm, p.thickness, p.material, e.L1, e.L2, e.W1, e.W2].join('|');
    const row = map.get(key);
    if (row) row.qty += 1;
    else
      map.set(key, {
        pos: 0,
        name: p.name,
        qty: 1,
        length: p.length,
        width: p.widthMm,
        thickness: p.thickness,
        material: p.material,
        edges: e,
        group: p.group,
      });
  }
  const rows = [...map.values()].sort(
    (a, b) =>
      GROUP_ORDER.indexOf(a.group) - GROUP_ORDER.indexOf(b.group) ||
      PART_ORDER.indexOf(a.name) - PART_ORDER.indexOf(b.name) ||
      b.length - a.length ||
      b.width - a.width,
  );
  rows.forEach((r, i) => (r.pos = i + 1));
  return rows;
}

/** Площадь плитных материалов по материалам, м². */
export function materialAreas(rows: SpecRow[]): { material: string; area: number }[] {
  const m = new Map<string, number>();
  for (const r of rows) m.set(r.material, (m.get(r.material) ?? 0) + (r.length * r.width * r.qty) / 1e6);
  return [...m.entries()].map(([material, area]) => ({ material, area: Math.round(area * 100) / 100 }));
}

/* ------------------------------------------------------------------ */
/* Фурнитура                                                            */
/* ------------------------------------------------------------------ */

export type HardwareKey =
  | 'slides'
  | 'rodTube'
  | 'rodHolder'
  | 'basket'
  | 'pantograph'
  | 'confirmat'
  | 'confirmatCap'
  | 'shelfSupport'
  | 'backNail'
  | 'leg'
  | 'hingeOverlay'
  | 'hingeHalf'
  | 'hingeInset'
  | 'liftMechanism'
  | 'slidingRollers'
  | 'slidingProfile'
  | 'trackTop'
  | 'trackBottom'
  | 'pushLatch'
  | 'handleBar'
  | 'handleKnob'
  | 'custom';

export interface HardwareRow {
  key: HardwareKey;
  params: MessageParams;
  qty: number;
  unit: Unit;
}

export function computeHardware(w: Wardrobe): HardwareRow[] {
  const d = carcassDims(w);
  const rows = new Map<string, HardwareRow>();
  const add = (key: HardwareKey, qty: number, unit: Unit = 'pcs', params: MessageParams = {}) => {
    if (qty <= 0) return;
    const id = key + JSON.stringify(params);
    const r = rows.get(id);
    if (r) r.qty = Math.round((r.qty + qty) * 100) / 100;
    else rows.set(id, { key, params, qty: Math.round(qty * 100) / 100, unit });
  };
  const layout = layoutSections(w);

  let confirmats = 8 + (layout.length - 1) * 4;
  if (w.plinth.enabled) confirmats += 8;
  let supports = 0;
  let drawerCount = 0;
  layout.forEach((sl) => {
    for (const it of w.sections[sl.index].items) {
      if (it.kind === 'shelf') {
        if (it.fixed) confirmats += 4;
        else supports += 4;
      }
      if (it.kind === 'drawer') {
        drawerCount += 1;
        add('slides', 1, 'pair', { type: it.slide, length: drawerSlideLength(d.interiorDepth, d.t) });
        confirmats += 4;
      }
      if (it.kind === 'rod') {
        add('rodTube', sl.width / 1000, 'm');
        add('rodHolder', 2);
      }
      if (it.kind === 'basket') add('basket', 1, 'pcs', { width: sl.width });
      if (it.kind === 'pantograph') add('pantograph', 1, 'pcs', { width: sl.width });
    }
  });
  add('confirmat', confirmats);
  add('confirmatCap', confirmats);
  add('shelfSupport', supports);
  if (d.hasBack) add('backNail', Math.ceil(((w.width + w.height) * 2) / 150));
  if (!w.plinth.enabled) add('leg', 4 + (layout.length - 1) * 2);

  const doors = computeDoors(w);
  const hingeKey: Record<Wardrobe['hinge'], HardwareKey> = {
    overlay: 'hingeOverlay',
    'half-overlay': 'hingeHalf',
    inset: 'hingeInset',
  };
  for (const door of doors) {
    if (door.kind === 'swing') add(hingeKey[w.hinge], hingeCount(door.height));
    if (door.kind === 'lift') add('liftMechanism', 1, 'set');
    if (door.kind === 'sliding') {
      add('slidingRollers', 1, 'set');
      add('slidingProfile', 2);
    }
  }
  if (w.doors.kind === 'sliding') {
    add('trackTop', d.innerWidth / 1000, 'm');
    add('trackBottom', d.innerWidth / 1000, 'm');
  }
  if (w.doors.kind === 'swing' || w.doors.kind === 'lift') {
    if (w.doors.handle === 'push') add('pushLatch', doors.length);
    else add(w.doors.handle === 'bar' ? 'handleBar' : 'handleKnob', doors.length);
  }
  if (w.doors.kind === 'none' && drawerCount > 0) {
    add(w.doors.handle === 'push' ? 'pushLatch' : 'handleBar', drawerCount);
  }
  for (const h of w.hardware) add('custom', h.qty, h.unit, { name: h.name });
  return [...rows.values()];
}

/* ------------------------------------------------------------------ */
/* Валидация                                                            */
/* ------------------------------------------------------------------ */

/**
 * Проверяет модель. Сообщения возвращаются кодами (см. i18n: `v.<code>`),
 * чтобы их можно было показать на любом языке.
 */
export function validate(w: Wardrobe): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const d = carcassDims(w);
  const push = (severity: ValidationIssue['severity'], code: string, params: MessageParams = {}, ref?: EntityRef) =>
    issues.push({ severity, code, params, ref });
  const carcass: EntityRef = { type: 'carcass' };

  const checkRange = (dim: string, v: number, lim: { min: number; max: number }) => {
    if (v < lim.min || v > lim.max) push('error', 'range', { dim, value: v, min: lim.min, max: lim.max }, carcass);
  };
  checkRange('width', w.width, LIMITS.width);
  checkRange('height', w.height, LIMITS.height);
  checkRange('depth', w.depth, LIMITS.depth);
  if (w.plinth.enabled) checkRange('plinth', w.plinth.height, LIMITS.plinth);
  if (d.interiorDepth < 200) push('error', 'interiorDepth', { value: d.interiorDepth }, carcass);
  if (d.slidingDoors && w.depth < 450) push('warning', 'slidingDepth', {}, carcass);
  if (w.type === 'corner') push('warning', 'cornerTodo', {}, carcass);

  const layout = layoutSections(w);
  layout.forEach((sl) => {
    const s = w.sections[sl.index];
    const sref: EntityRef = { type: 'section', sectionId: s.id };
    const n = sl.index + 1;
    if (sl.width < LIMITS.sectionWidth.min) push('error', 'sectionNarrow', { n, value: sl.width, min: LIMITS.sectionWidth.min }, sref);
    if (sl.width > LIMITS.sectionWidth.max) push('warning', 'sectionWide', { n, value: sl.width, max: LIMITS.sectionWidth.max }, sref);

    const items = sortItems(s.items);
    items.forEach((it, i) => {
      const ref: EntityRef = { type: 'item', sectionId: s.id, itemId: it.id };
      const ext = itemExtent(it, d.t);
      const p = { n, kind: it.kind, y: it.y };
      if (ext.bottom < 0 || ext.top > d.innerHeight) push('error', 'itemOutside', p, ref);
      for (const other of items.slice(i + 1)) {
        if (itemsOverlap(it, other, d.t)) push('error', 'itemOverlap', { ...p, other: other.kind, otherY: other.y }, ref);
      }
      if (it.kind === 'shelf' && !it.fixed && sl.width - 2 > SHELF_MAX_UNSUPPORTED)
        push('warning', 'shelfSag', { ...p, length: sl.width - 2, max: SHELF_MAX_UNSUPPORTED }, ref);
      if (it.kind === 'rod' && sl.width > 1200) push('warning', 'rodLong', p, ref);
      if (it.kind === 'rod' && d.innerHeight - it.y < 50) push('warning', 'rodTop', p, ref);
      if (it.kind === 'drawer') {
        if (it.height < 100) push('error', 'drawerLow', p, ref);
        if (sl.width > 1000) push('warning', 'drawerWide', p, ref);
        if (d.interiorDepth < 280) push('error', 'drawerDepth', p, ref);
      }
      if (it.kind === 'pantograph' && (sl.width < 450 || sl.width > 1150)) push('warning', 'pantographWidth', p, ref);
    });
    const shelves = items.filter((x) => x.kind === 'shelf');
    for (let i = 1; i < shelves.length; i++) {
      const gap = shelves[i].y - shelves[i - 1].y - d.t;
      if (gap > 0 && gap < 100)
        push('warning', 'shelfGap', { n, gap }, { type: 'item', sectionId: s.id, itemId: shelves[i].id });
    }
  });

  for (const door of computeDoors(w)) {
    const ref: EntityRef = { type: 'door', index: door.index };
    const p = { n: door.index + 1, width: door.width, height: door.height };
    if (door.kind === 'swing' && door.width > 600) push('warning', 'doorWide', p, ref);
    if (door.kind === 'swing' && door.width < 150) push('error', 'doorNarrow', p, ref);
    if (door.kind === 'sliding' && door.width > 1200) push('warning', 'slidingWide', p, ref);
    if (door.kind === 'sliding' && door.width < 450) push('warning', 'slidingNarrow', p, ref);
    if (door.height > 2400 && door.kind !== 'sliding') push('warning', 'doorTall', p, ref);
    if (door.kind === 'lift' && door.height > 900) push('warning', 'liftTall', p, ref);
  }
  return issues;
}

/* ------------------------------------------------------------------ */
/* Раскрой                                                              */
/* ------------------------------------------------------------------ */

export interface CutPlacement {
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
  pos: number;
  rotated: boolean;
}

export interface CutSheet {
  material: string;
  index: number;
  length: number;
  width: number;
  placements: CutPlacement[];
  usage: number;
}

/**
 * Упрощённая гильотинная раскладка «полосами»: детали сортируются по ширине,
 * укладываются в горизонтальные полосы вдоль длины листа.
 */
export function computeCutting(rows: SpecRow[], sheet: { length: number; width: number; kerf: number; trim: number } = SHEET): CutSheet[] {
  const byMat = new Map<string, { w: number; h: number; label: string; pos: number; grain: boolean }[]>();
  for (const r of rows) {
    if (!isSheetGoods(r.material) || r.thickness < 8) continue;
    const grain = getMaterial(r.material).grain;
    for (let i = 0; i < r.qty; i++) {
      const list = byMat.get(r.material) ?? [];
      list.push({ w: r.length, h: r.width, label: `${r.pos}`, pos: r.pos, grain });
      byMat.set(r.material, list);
    }
  }
  const L = sheet.length - 2 * sheet.trim;
  const W = sheet.width - 2 * sheet.trim;
  const result: CutSheet[] = [];
  for (const [material, parts] of byMat) {
    // Без текстуры можно поворачивать: кладём длинной стороной вдоль листа
    const items = parts
      .map((p) => {
        if (p.w > L && !p.grain && p.w <= W) return { ...p, w: p.h, h: p.w, rotated: true };
        return { ...p, rotated: false };
      })
      .sort((a, b) => b.h - a.h || b.w - a.w);
    type Strip = { y: number; h: number; x: number };
    type Sheet = { strips: Strip[]; usedY: number; placements: CutPlacement[] };
    const sheets: Sheet[] = [];
    const newSheet = (): Sheet => {
      const s: Sheet = { strips: [], usedY: 0, placements: [] };
      sheets.push(s);
      return s;
    };
    for (const it of items) {
      if (it.w > L || it.h > W) continue; // не помещается на лист — пропускаем
      let placed = false;
      for (const s of sheets) {
        for (const st of s.strips) {
          if (it.h <= st.h && st.x + it.w <= L) {
            s.placements.push({ x: sheet.trim + st.x, y: sheet.trim + st.y, w: it.w, h: it.h, label: it.label, pos: it.pos, rotated: it.rotated });
            st.x += it.w + sheet.kerf;
            placed = true;
            break;
          }
        }
        if (placed) break;
        if (s.usedY + it.h <= W) {
          const st: Strip = { y: s.usedY, h: it.h, x: it.w + sheet.kerf };
          s.strips.push(st);
          s.placements.push({ x: sheet.trim, y: sheet.trim + s.usedY, w: it.w, h: it.h, label: it.label, pos: it.pos, rotated: it.rotated });
          s.usedY += it.h + sheet.kerf;
          placed = true;
          break;
        }
      }
      if (!placed) {
        const s = newSheet();
        s.strips.push({ y: 0, h: it.h, x: it.w + sheet.kerf });
        s.placements.push({ x: sheet.trim, y: sheet.trim, w: it.w, h: it.h, label: it.label, pos: it.pos, rotated: it.rotated });
        s.usedY = it.h + sheet.kerf;
      }
    }
    sheets.forEach((s, i) => {
      const area = s.placements.reduce((a, p) => a + p.w * p.h, 0);
      result.push({
        material,
        index: i + 1,
        length: sheet.length,
        width: sheet.width,
        placements: s.placements,
        usage: Math.round((area / (sheet.length * sheet.width)) * 1000) / 10,
      });
    });
  }
  return result;
}

/* ------------------------------------------------------------------ */
/* Шаблоны                                                              */
/* ------------------------------------------------------------------ */

export function createWardrobe(type: WardrobeType = 'swing', name = 'Новый шкаф'): Wardrobe {
  const now = Date.now();
  const sliding = type === 'sliding' || type === 'built-in';
  const base: Wardrobe = {
    id: uid('wr'),
    name,
    type,
    width: sliding ? 2000 : 1800,
    height: 2400,
    depth: sliding ? 600 : 600,
    boardThickness: 16,
    backThickness: 4,
    bodyMaterial: 'ldsp-white',
    backMaterial: 'hdf-white',
    edge: { visible: 2, hidden: 0.4 },
    plinth: { enabled: true, height: 80 },
    hinge: 'overlay',
    defaultSlide: 'ball',
    doors: {
      kind: sliding ? 'sliding' : 'swing',
      count: sliding ? 2 : 4,
      material: sliding ? 'mirror-silver' : 'ldsp-oak-sonoma',
      overrides: [],
      gap: 3,
      handle: 'bar',
    },
    sections: [],
    hardware: [],
    createdAt: now,
    updatedAt: now,
  };
  if (sliding) base.doors.overrides = [null, 'ldsp-oak-sonoma'];

  const n = type === 'combined' ? 4 : 3;
  const avail = availableSectionsWidth(base, n);
  const widths = fitSectionWidths(Array(n).fill(avail / n), avail);
  const innerH = carcassDims(base).innerHeight;
  const top = Math.floor((innerH - 450) / 10) * 10;
  const mk = createItem;

  const sections: Section[] = widths.map((width) => ({ id: uid('sec'), width, items: [] }));
  // 1: штанга и антресоль
  sections[0].items = [{ ...mk('shelf', top), fixed: true } as SectionItem, mk('rod', top - 60)];
  // 2: полки и ящики
  sections[1].items = [
    mk('drawer', 0, base.defaultSlide),
    mk('drawer', 190, base.defaultSlide),
    ...[600, 900, 1200, 1500].map((y) => mk('shelf', y)),
    { ...mk('shelf', top), fixed: true } as SectionItem,
  ];
  // 3: штанга
  sections[2].items = [{ ...mk('shelf', top), fixed: true } as SectionItem, mk('rod', top - 60), mk('shelf', 300)];
  if (n === 4) {
    sections[3].items = [mk('basket', 0), mk('basket', 200), mk('shelf', 700), { ...mk('shelf', top), fixed: true } as SectionItem];
    base.doors.kind = 'swing';
    base.doors.count = 4;
  }
  return normalizeWardrobe({ ...base, sections });
}

/** Простейшая проверка импортируемого JSON на соответствие модели. */
export function isWardrobe(x: unknown): x is Wardrobe {
  if (!x || typeof x !== 'object') return false;
  const o = x as Record<string, unknown>;
  return (
    typeof o.width === 'number' &&
    typeof o.height === 'number' &&
    typeof o.depth === 'number' &&
    Array.isArray(o.sections) &&
    typeof o.doors === 'object' &&
    o.doors !== null
  );
}
